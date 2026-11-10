// Downloads funds/latest.json once a day, keeps it on the phone and serves it offline.
// The request is a plain GET of a public file: no query string, no headers about the user,
// so the server learns nothing about what the user holds.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { fundBookStale, fundLatestUrl, parseFundLatest, type FundBook } from './funds';

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
