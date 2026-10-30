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

/**
 * Refreshes USD, EUR, GBP and gram gold. ECB first, TCMB as the fallback for currencies
 * (`useTcmb` is false on web, where TCMB blocks cross-origin requests).
 */
export async function refreshPriceBook(prev: PriceBook, useTcmb: boolean): Promise<{ book: PriceBook; errors: string[] }> {
  const errors: string[] = [];
  const book: PriceBook = { ...prev };
  const fetchedAt = new Date().toISOString();

  let fx: FxQuote | undefined;
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
    try {
      accept('gold', gramGoldTry(await fetchGoldUsdPerOunce(), usd), 'gold-api × ' + (book.usd?.source ?? 'ECB'));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Altın fiyatı alınamadı');
    }
  }
  return { book, errors };
}
