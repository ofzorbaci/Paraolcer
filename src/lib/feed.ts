import { FEED_VERSION, type Feed } from './feed-types';

/** Shape check for a downloaded feed; anything unexpected is rejected and the cached feed stays. */
export function isFeed(x: unknown): x is Feed {
  const f = x as Feed;
  return (
    !!f &&
    f.version === FEED_VERSION &&
    typeof f.generatedAt === 'string' &&
    Array.isArray(f.cpi?.rows) &&
    f.cpi.rows.length > 24 &&
    Array.isArray(f.policyRate?.history) &&
    f.policyRate.history.length > 0 &&
    Array.isArray(f.rateDecisions?.dates) &&
    typeof f.rateDecisions.time === 'string' &&
    typeof f.expectations?.next12m?.market === 'number' &&
    Array.isArray(f.withholding?.tiers) &&
    f.withholding.tiers.length > 0
  );
}

export async function fetchFeed(url: string): Promise<Feed> {
  // No custom headers: they would trigger a CORS preflight that GitHub Pages does not answer.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Veri akışı alınamadı (${res.status})`);
  const body: unknown = await res.json();
  if (!isFeed(body)) throw new Error('Veri akışı beklenen biçimde değil');
  return body;
}

/** The newer of two feeds by build time. */
export function newerFeed(a: Feed, b: Feed | undefined): Feed {
  return b && b.generatedAt > a.generatedAt ? b : a;
}

export function currentPolicyRate(feed: Feed): { rate: number; from: string; previous?: number } {
  const h = feed.policyRate.history;
  return { ...h[h.length - 1], previous: h[h.length - 2]?.rate };
}
