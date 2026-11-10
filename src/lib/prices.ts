// Live price layer: each quote carries its source and time, has a fallback source,
// and is rejected if it is implausible or jumps too far from the last good value.

import { fetchGoldUsdPerOunce, gramGoldTry } from './gold';
import type { LivePrices } from './types';

export type PriceKey = 'usd' | 'eur' | 'gbp' | 'gold';

export type PriceQuote = {
  value: number;
  /** short source name shown next to the number */
  source: string;
  /** ISO time the app fetched it */
  fetchedAt: string;
  /** 'YYYY-MM-DD' the source dates the value to, when it says */
  asOf?: string;
};

export type PriceBook = Partial<Record<PriceKey, PriceQuote>>;

/** TRY per unit; anything outside is a feed error, not a market move. */
const SANE: Record<PriceKey, [number, number]> = { usd: [1, 1000], eur: [1, 1000], gbp: [1, 1000], gold: [50, 200_000] };
/** Largest believable change between two refreshes. */
export const MAX_JUMP = 0.25;

export function checkQuote(key: PriceKey, value: number, prev: PriceQuote | undefined): string | undefined {
  const [lo, hi] = SANE[key];
  if (!Number.isFinite(value) || value < lo || value > hi) return `${key} fiyatı makul aralıkta değil (${value})`;
  if (prev && Math.abs(value / prev.value - 1) > MAX_JUMP) {
    return `${key} fiyatı son değerden %${Math.round(Math.abs(value / prev.value - 1) * 100)} farklı, doğrulanana kadar eski değer kullanılıyor`;
  }
  return undefined;
}

export function toLivePrices(book: PriceBook): LivePrices {
  return { usd: book.usd?.value, eur: book.eur?.value, gbp: book.gbp?.value, gold: book.gold?.value };
}

/** Mid rates from TCMB's daily indicative rates file (kurlar/today.xml). */
export function parseTcmbRates(xml: string): { usd?: number; eur?: number; gbp?: number; asOf?: string } {
  const pick = (code: string) => {
    const block = new RegExp(`Kod="${code}"[\\s\\S]*?</Currency>`).exec(xml)?.[0];
    if (!block) return undefined;
    const buy = Number(/<ForexBuying>([\d.]+)</.exec(block)?.[1]);
    const sell = Number(/<ForexSelling>([\d.]+)</.exec(block)?.[1]);
    return buy > 0 && sell > 0 ? (buy + sell) / 2 : undefined;
  };
  const date = /Tarih="(\d{2})\.(\d{2})\.(\d{4})"/.exec(xml);
  return { usd: pick('USD'), eur: pick('EUR'), gbp: pick('GBP'), asOf: date ? `${date[3]}-${date[2]}-${date[1]}` : undefined };
}

type FxQuote = { usd: number; eur: number; gbp?: number; asOf?: string; source: string };

async function fromEcb(): Promise<FxQuote> {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY,EUR,GBP');
  if (!res.ok) throw new Error(`ECB kuru alınamadı (${res.status})`);
  const body = (await res.json()) as { date?: string; rates?: { TRY?: number; EUR?: number; GBP?: number } };
  const usd = body.rates?.TRY;
  const eurPerUsd = body.rates?.EUR;
  if (!usd || !eurPerUsd) throw new Error('ECB yanıtı geçersiz');
  const gbpPerUsd = body.rates?.GBP;
  return { usd, eur: usd / eurPerUsd, gbp: gbpPerUsd ? usd / gbpPerUsd : undefined, asOf: body.date, source: 'ECB' };
}

async function fromTcmb(): Promise<FxQuote> {
  const res = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml');
  if (!res.ok) throw new Error(`TCMB kuru alınamadı (${res.status})`);
  const { usd, eur, gbp, asOf } = parseTcmbRates(await res.text());
  if (!usd || !eur) throw new Error('TCMB yanıtı geçersiz');
  return { usd, eur, gbp, asOf, source: 'TCMB' };
}

/** fawazahmed0/currency-api (CC0, daily, keyless; jsDelivr with a Cloudflare mirror): USD base. */
export function parseCurrencyApi(body: unknown): (FxQuote & { goldUsdOz?: number }) | undefined {
  const b = body as { date?: string; usd?: Record<string, number> };
  const r = b?.usd;
  const usd = r?.try;
  if (!r || !(usd && usd > 0) || !(r.eur > 0)) return undefined;
  return {
    usd,
    eur: usd / r.eur,
    gbp: r.gbp > 0 ? usd / r.gbp : undefined,
    asOf: b.date,
    source: 'currency-api',
    // xau is ounces per dollar
    goldUsdOz: r.xau > 0 ? 1 / r.xau : undefined,
  };
}

const CURRENCY_API = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
];

async function fromCurrencyApi(): Promise<FxQuote & { goldUsdOz?: number }> {
  for (const url of CURRENCY_API) {
    try {
      const res = await fetch(url);
      const q = res.ok ? parseCurrencyApi(await res.json()) : undefined;
      if (q) return q;
    } catch {
      // try the mirror
    }
  }
  throw new Error('Yedek kur kaynağı (currency-api) yanıt vermedi');
}

/** goldprice.dev keyless spot (15 minutes delayed), USD per troy ounce. */
export function parseGoldpriceDev(body: unknown): number | undefined {
  const s = (body as { symbols?: { symbol?: string; price?: string | number; is_stale?: boolean }[] })?.symbols?.find((x) => x.symbol === 'XAU');
  const price = Number(s?.price);
  return s && !s.is_stale && price > 0 ? price : undefined;
}

async function goldFromGoldpriceDev(): Promise<number> {
  const res = await fetch('https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT');
  const price = res.ok ? parseGoldpriceDev(await res.json()) : undefined;
  if (!price) throw new Error('goldprice.dev yanıtı geçersiz');
  return price;
}

/**
 * Refreshes USD, EUR, GBP and gram gold. Currencies: ECB first, then TCMB (`useTcmb` is false on
 * web, where TCMB blocks cross-origin requests), then currency-api. Gold: gold-api.com, then
 * goldprice.dev, then currency-api's ounce price.
 */
export async function refreshPriceBook(prev: PriceBook, useTcmb: boolean): Promise<{ book: PriceBook; errors: string[] }> {
  const errors: string[] = [];
  const book: PriceBook = { ...prev };
  const fetchedAt = new Date().toISOString();

  let fx: FxQuote | undefined;
  let backup: (FxQuote & { goldUsdOz?: number }) | undefined;
  const loadBackup = async () => {
    backup ??= await fromCurrencyApi();
    return backup;
  };
  try {
    fx = await fromEcb();
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'ECB kuru alınamadı');
    if (useTcmb) {
      try {
        fx = await fromTcmb();
      } catch (e2) {
        errors.push(e2 instanceof Error ? e2.message : 'TCMB kuru alınamadı');
      }
    }
    if (!fx) {
      try {
        fx = await loadBackup();
      } catch (e3) {
        errors.push(e3 instanceof Error ? e3.message : 'Yedek kur alınamadı');
      }
    }
  }

  const accept = (key: PriceKey, value: number, source: string, asOf?: string) => {
    const problem = checkQuote(key, value, prev[key]);
    if (problem) errors.push(problem);
    else book[key] = { value, source, fetchedAt, asOf };
  };

  if (fx) {
    accept('usd', fx.usd, fx.source, fx.asOf);
    accept('eur', fx.eur, fx.source, fx.asOf);
    if (fx.gbp) accept('gbp', fx.gbp, fx.source, fx.asOf);
  }

  const usd = book.usd?.value;
  if (usd) {
    const fxSource = book.usd?.source ?? 'ECB';
    const sources: [string, () => Promise<number>][] = [
      ['gold-api', fetchGoldUsdPerOunce],
      ['goldprice.dev', goldFromGoldpriceDev],
      [
        'currency-api',
        async () => {
          const oz = (await loadBackup()).goldUsdOz;
          if (!oz) throw new Error('currency-api altın fiyatı yok');
          return oz;
        },
      ],
    ];
    let lastError: unknown;
    for (const [name, load] of sources) {
      try {
        accept('gold', gramGoldTry(await load(), usd), `${name} × ${fxSource}`);
        lastError = undefined;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError) errors.push(lastError instanceof Error ? lastError.message : 'Altın fiyatı alınamadı');
  }
  return { book, errors };
}
