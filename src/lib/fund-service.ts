// Downloads funds/latest.json once a day, keeps it on the phone and serves it offline.
// The request is a plain GET of a public file: no query string, no headers about the user,
// so the server learns nothing about what the user holds.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { fundBookStale, fundLatestUrl, fundMonthUrl, parseFundLatest, parseFundMonth, previousMonth, priceOnDate, type FundBook, type FundMonth } from './funds';

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

/**
 * One month of every fund's prices. Past months never change, so they are kept on the phone for
 * good; the current month is downloaded again on another day. Only the month is requested: the
 * server cannot tell which fund the user is looking at.
 */
export async function loadFundMonth(feedUrl: string, month: string, today: string): Promise<FundMonth | undefined> {
  const current = month >= today.slice(0, 7);
  const memo = months.get(month);
  if (memo && !current) return memo;
  let cached: { month: FundMonth; fetchedAt: string } | undefined;
  try {
    const raw = await AsyncStorage.getItem(MONTH_KEY + month);
    cached = raw ? JSON.parse(raw) : undefined;
  } catch {
    cached = undefined;
  }
  if (cached && (!current || !fundBookStale(cached.fetchedAt, today))) {
    months.set(month, cached.month);
    return cached.month;
  }
  try {
    const res = await fetch(fundMonthUrl(feedUrl, month));
    const parsed = res.ok ? parseFundMonth(await res.json()) : undefined;
    if (!parsed) return cached?.month;
    months.set(month, parsed);
    AsyncStorage.setItem(MONTH_KEY + month, JSON.stringify({ month: parsed, fetchedAt: new Date().toISOString() })).catch(() => {});
    return parsed;
  } catch {
    return cached?.month;
  }
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
