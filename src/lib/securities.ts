// Fund and stock closing prices from the data feed (Feed['securities']). Like the withholding
// table, the store hands each new feed to this module, so pricing code anywhere can read it.

import type { Feed } from './feed-types';
import { assetCode } from './lookup';
import type { Holding } from './types';

let book: Feed['securities'];

export function setSecurityPrices(next: Feed['securities']) {
  book = next;
}

export type FeedQuote = { price: number; date: string; source: string };

/** The feed's closing price for a fund or stock holding, matched by its code; undefined if none. */
export function feedQuote(h: Pick<Holding, 'kind' | 'name'>, securities: Feed['securities'] = book): FeedQuote | undefined {
  if (!securities || (h.kind !== 'fund' && h.kind !== 'stock')) return undefined;
  const code = assetCode(h.name);
  const q = code ? (h.kind === 'fund' ? securities.funds : securities.stocks)[code] : undefined;
  return q && { ...q, source: securities.source };
}
