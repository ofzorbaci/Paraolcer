// Downloads funds/latest.json once a day, keeps it on the phone and serves it offline.
// The request is a plain GET of a public file: no query string, no headers about the user,
// so the server learns nothing about what the user holds.

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fundBookStale,
  fundLatestUrl,
  fundMonthUrl,
  parseFundLatest,
  parseFundMonth,
  parseUsMonth,
  previousMonth,
  priceOnDate,
  usGroup,
  usMonthUrl,
  type FundBook,
  type FundMonth,
  type UsMonth,
} from './funds';

const KEY = 'gg.funds.v1';

export type CachedFundBook = { book: FundBook; fetchedAt: string };

export async function readCachedFundBook(): Promise<CachedFundBook | undefined> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const cached = raw ? (JSON.parse(raw) as CachedFundBook) : undefined;
    return cached?.book?.funds ? cached : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns a fresh book when the cache is from an earlier day (or `force`), else the cache.
 * On any network or format problem the cache is kept and returned; undefined only when there
 * has never been a successful download.
 */
export async function loadFundBook(
  feedUrl: string,
  today: string,
  opts: { force?: boolean; cached?: CachedFundBook } = {},
): Promise<{ result?: CachedFundBook; fresh: boolean; error?: string }> {
  const cached = opts.cached ?? (await readCachedFundBook());
  if (cached && !opts.force && !fundBookStale(cached.fetchedAt, today)) return { result: cached, fresh: false };
  try {
    const res = await fetch(fundLatestUrl(feedUrl));
    if (!res.ok) throw new Error(`Fon verisi alınamadı (${res.status})`);
    const book = parseFundLatest(await res.json());
    if (!book) throw new Error('Fon verisi beklenen biçimde değil');
    // Never go backwards: a stale CDN copy must not replace newer prices.
    if (cached && book.updatedAt && cached.book.updatedAt > book.updatedAt) return { result: cached, fresh: false };
    const result = { book, fetchedAt: new Date().toISOString() };
    AsyncStorage.setItem(KEY, JSON.stringify(result)).catch(() => {});
    return { result, fresh: true };
  } catch (e) {
    return { result: cached, fresh: false, error: e instanceof Error ? e.message : 'Fon verisi alınamadı' };
  }
}

export async function clearFundCache(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

const MONTH_KEY = 'gg.fundmonth.';
const months = new Map<string, FundMonth>();
const US_MONTH_KEY = 'gg.usmonth.';
const usMonths = new Map<string, UsMonth>();

/**
 * A month file (TEFAS funds or US closes): past months are kept on the phone for good, the
 * current month is downloaded again on another day. Only the month is requested.
 */
async function loadMonthFile<T>(
  url: string,
  storageKey: string,
  memo: Map<string, T>,
  month: string,
  today: string,
  parse: (body: unknown) => T | undefined,
): Promise<T | undefined> {
  const current = month >= today.slice(0, 7);
  const hit = memo.get(month);
  if (hit && !current) return hit;
  let cached: { month: T; fetchedAt: string } | undefined;
  try {
    const raw = await AsyncStorage.getItem(storageKey + month);
    cached = raw ? JSON.parse(raw) : undefined;
  } catch {
    cached = undefined;
  }
  if (cached && (!current || !fundBookStale(cached.fetchedAt, today))) {
    memo.set(month, cached.month);
    return cached.month;
  }
  try {
    const res = await fetch(url);
    const parsed = res.ok ? parse(await res.json()) : undefined;
    if (!parsed) return cached?.month;
    memo.set(month, parsed);
    AsyncStorage.setItem(storageKey + month, JSON.stringify({ month: parsed, fetchedAt: new Date().toISOString() })).catch(() => {});
    return parsed;
  } catch {
    return cached?.month;
  }
}

/** US stock, ETF or coin close on the purchase day, USD (or the last trading day before it). */
export async function usPriceOn(
  feedUrl: string,
  symbol: string,
  crypto: boolean,
  date: string,
  today: string,
): Promise<{ price: number; date: string } | undefined> {
  const load = (m: string) => loadMonthFile(usMonthUrl(feedUrl, m), US_MONTH_KEY, usMonths, m, today, parseUsMonth);
  const month = date.slice(0, 7);
  const here = await load(month);
  const found = here && priceOnDate(usGroup(here, crypto), symbol, date);
  if (found) return found;
  const before = await load(previousMonth(month));
  return before && priceOnDate(usGroup(before, crypto), symbol, date);
}

/** One month of every TEFAS fund's prices; the server cannot tell which fund the user looks at. */
export function loadFundMonth(feedUrl: string, month: string, today: string): Promise<FundMonth | undefined> {
  return loadMonthFile(fundMonthUrl(feedUrl, month), MONTH_KEY, months, month, today, parseFundMonth);
}

/** The fund's price on the purchase day (or the last trading day before it, looking one month back). */
export async function fundPriceOn(feedUrl: string, code: string, date: string, today: string): Promise<{ price: number; date: string } | undefined> {
  const month = date.slice(0, 7);
  const here = await loadFundMonth(feedUrl, month, today);
  const found = here && priceOnDate(here, code, date);
  if (found) return found;
  // Bought on the 1st and that was a weekend or holiday: the last price of the previous month.
  const before = await loadFundMonth(feedUrl, previousMonth(month), today);
  return before && priceOnDate(before, code, date);
}
