// Closing prices from the data feed: funds and BIST stocks in TRY (Feed['securities']) and US
// stocks, ETFs and crypto in USD (Feed['usQuotes']). Like the withholding table, the store hands
// each new feed to this module, so pricing code anywhere can read it.

import type { Feed } from './feed-types';
import type { FundBook } from './funds';
import { assetCode } from './lookup';
import { isUsdPriced, type Holding } from './types';

let book: Feed['securities'];
let usBook: Feed['usQuotes'];
/** TEFAS fund prices from funds/latest.json (fund-service.ts); preferred over Feed['securities'].funds */
let fundBook: FundBook | undefined;

export function setFundBook(next: FundBook | undefined) {
  fundBook = next;
}

export function setSecurityPrices(next: Feed['securities'], us?: Feed['usQuotes']) {
  book = next;
  usBook = us;
}

/** `price` is TRY per unit, or USD per unit when `currency` is 'USD'. */
export type FeedQuote = { price: number; date: string; source: string; currency?: 'USD'; name?: string };

/** "brk.b", "BRK-B", "btc" → "BRK.B", "BTC"; undefined if it does not look like a US ticker or coin. */
export function usSymbol(name: string): string | undefined {
  const s = name.trim().toUpperCase().replace(/-/g, '.');
  return /^[A-Z][A-Z0-9.]{0,9}$/.test(s) ? s : undefined;
}

/** The feed's closing price for a fund, stock, US stock, ETF or coin, matched by its code; undefined if none. */
export function feedQuote(
  h: Pick<Holding, 'kind' | 'name'>,
  securities: Feed['securities'] = book,
  us: Feed['usQuotes'] = usBook,
): FeedQuote | undefined {
  if (isUsdPriced(h.kind)) {
    const sym = usSymbol(h.name);
    const q = sym && us ? (h.kind === 'crypto' ? us.crypto : us.stocks)[sym] : undefined;
    return q && { price: q.price, date: q.date, source: us!.source, currency: 'USD', name: q.name };
  }
  const code = assetCode(h.name);
  if (h.kind === 'fund' && code && fundBook?.funds[code]) {
    const f = fundBook.funds[code];
    return { price: f.price, date: f.date, source: fundBook.source, name: f.name };
  }
  if (!securities || (h.kind !== 'fund' && h.kind !== 'stock')) return undefined;
  const q = code ? (h.kind === 'fund' ? securities.funds : securities.stocks)[code] : undefined;
  return q && { ...q, source: securities.source };
}

/** Symbols the feed prices for a kind, with their names: suggestions for the add form. */
export function knownSymbols(kind: Holding['kind'], us: Feed['usQuotes'] = usBook): { symbol: string; name: string }[] {
  if (kind === 'fund') return Object.values(fundBook?.funds ?? {}).map((f) => ({ symbol: f.code, name: f.name }));
  if (!us || !isUsdPriced(kind)) return [];
  const map = kind === 'crypto' ? us.crypto : us.stocks;
  return Object.entries(map)
    .filter(([, q]) => kind === 'crypto' || (kind === 'etf') === !!q.etf)
    .map(([symbol, q]) => ({ symbol, name: q.name ?? symbol }));
}
