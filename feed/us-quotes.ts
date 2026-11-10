// US stock, ETF and crypto closing prices in USD for the symbols in feed/us-universe.json.
// Finnhub is the main source (FINNHUB_API_KEY, 60 calls a minute on the free plan); Alpha Vantage
// (ALPHAVANTAGE_API_KEY, 25 calls a day on the free plan) fills a few gaps per run. A symbol that
// fails keeps its previous price and date. Keys come from GitHub secrets, never from the repo.

import type { UsQuote } from '../src/lib/feed-types.ts';

export type Universe = { stocks: Record<string, string>; etfs: Record<string, string>; crypto: Record<string, string> };

/** Stablecoins tracked 1:1 against the dollar; no request needed. */
const STABLE = new Set(['USDT', 'USDC', 'DAI']);

export function parseFinnhubQuote(body: unknown): { price: number; date: string } | undefined {
  const q = body as { c?: number; t?: number };
  if (!q || typeof q.c !== 'number' || !(q.c > 0) || typeof q.t !== 'number' || !(q.t > 0)) return undefined;
  return { price: q.c, date: new Date(q.t * 1000).toISOString().slice(0, 10) };
}

export function parseAlphaStock(body: unknown): { price: number; date: string } | undefined {
  const q = (body as { 'Global Quote'?: Record<string, string> })?.['Global Quote'];
  const price = Number(q?.['05. price']);
  const date = q?.['07. latest trading day'];
  return price > 0 && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { price, date } : undefined;
}

export function parseAlphaCrypto(body: unknown): { price: number; date: string } | undefined {
  const q = (body as { 'Realtime Currency Exchange Rate'?: Record<string, string> })?.['Realtime Currency Exchange Rate'];
  const price = Number(q?.['5. Exchange Rate']);
  const date = q?.['6. Last Refreshed']?.slice(0, 10);
  return price > 0 && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { price, date } : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Cfg = { finnhubKey?: string; alphaKey?: string; today: string; alphaBudget?: number; delayMs?: number };

/**
 * Fetches every symbol; returns the merged book (fresh prices over the previous ones) and how
 * many symbols each source answered.
 */
export async function buildUsQuotes(
  universe: Universe,
  previous: { stocks: Record<string, UsQuote>; crypto: Record<string, UsQuote> } | undefined,
  cfg: Cfg,
): Promise<{ stocks: Record<string, UsQuote>; crypto: Record<string, UsQuote>; source: string; missing: string[] }> {
  const stocks: Record<string, UsQuote> = { ...previous?.stocks };
  const crypto: Record<string, UsQuote> = { ...previous?.crypto };
  const delay = cfg.delayMs ?? 1100;
  const used = new Set<string>();
  const missing: { sym: string; name: string; type: 'stock' | 'etf' | 'crypto' }[] = [];

  const finnhub = async (symbol: string) => {
    if (!cfg.finnhubKey) return undefined;
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`, {
      headers: { 'X-Finnhub-Token': cfg.finnhubKey },
    });
    if (res.status === 429) {
      await sleep(5000);
      return undefined;
    }
    return res.ok ? parseFinnhubQuote(await res.json()) : undefined;
  };

  const entries: { sym: string; name: string; type: 'stock' | 'etf' | 'crypto' }[] = [
    ...Object.entries(universe.stocks).map(([sym, name]) => ({ sym, name, type: 'stock' as const })),
    ...Object.entries(universe.etfs).map(([sym, name]) => ({ sym, name, type: 'etf' as const })),
    ...Object.entries(universe.crypto).map(([sym, name]) => ({ sym, name, type: 'crypto' as const })),
  ];

  for (const e of entries) {
    if (e.type === 'crypto' && STABLE.has(e.sym)) {
      crypto[e.sym] = { price: 1, date: cfg.today, name: e.name };
      continue;
    }
    let q: { price: number; date: string } | undefined;
    try {
      q = await finnhub(e.type === 'crypto' ? `BINANCE:${e.sym}USDT` : e.sym);
    } catch {
      q = undefined;
    }
    if (q) {
      used.add('Finnhub');
      const target = e.type === 'crypto' ? crypto : stocks;
      target[e.sym] = { ...q, name: e.name, ...(e.type === 'etf' && { etf: true }) };
    } else {
      missing.push(e);
    }
    if (cfg.finnhubKey) await sleep(delay);
  }

  // Alpha Vantage: only a handful per run, so the daily allowance lasts across scheduled runs.
  let budget = cfg.alphaKey ? (cfg.alphaBudget ?? 10) : 0;
  const stillMissing: string[] = [];
  for (const e of missing) {
    if (budget <= 0) {
      stillMissing.push(e.sym);
      continue;
    }
    budget--;
    const fn = e.type === 'crypto' ? `CURRENCY_EXCHANGE_RATE&from_currency=${e.sym}&to_currency=USD` : `GLOBAL_QUOTE&symbol=${e.sym}`;
    try {
      const res = await fetch(`https://www.alphavantage.co/query?function=${fn}&apikey=${cfg.alphaKey}`);
      const body = res.ok ? await res.json() : undefined;
      const q = e.type === 'crypto' ? parseAlphaCrypto(body) : parseAlphaStock(body);
      if (q) {
        used.add('Alpha Vantage');
        const target = e.type === 'crypto' ? crypto : stocks;
        target[e.sym] = { ...q, name: e.name, ...(e.type === 'etf' && { etf: true }) };
      } else stillMissing.push(e.sym);
    } catch {
      stillMissing.push(e.sym);
    }
    await sleep(1500);
  }

  return { stocks, crypto, source: [...used].join(', ') || 'Finnhub, Alpha Vantage', missing: stillMissing };
}
