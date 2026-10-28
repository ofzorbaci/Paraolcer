import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import snapshot from '@/data/feed-snapshot.json';
import { rateDecisionDates } from '@/lib/calendar';
import { buildCpiIndex, type CpiIndex } from '@/lib/cpi';
import { parseTcmbCpiHtml, TCMB_CPI_URL, type CpiRow } from '@/lib/cpi-parse';
import { setWithholdingRules } from '@/lib/deposit';
import { fetchFeed, isFeed, newerFeed } from '@/lib/feed';
import type { Feed } from '@/lib/feed-types';
import { disableReminders, enableReminders, type ReminderKind } from '@/lib/notify';
import { refreshPriceBook, toLivePrices, type PriceBook } from '@/lib/prices';
import type { Holding, LivePrices, Settings } from '@/lib/types';

type State = {
  ready: boolean;
  holdings: Holding[];
  settings: Settings;
  /** official data: CPI, policy rate, PPK calendar, expectations, withholding */
  feed: Feed;
  /** 'bundled' until a downloaded feed replaces it */
  feedOrigin: 'bundled' | 'cached' | 'live';
  cpi: { rows: CpiRow[]; index: CpiIndex; live: boolean };
  rateSchedule: Date[];
  /** plain numbers for the calculators */
  prices: LivePrices;
  /** the same prices with source and time */
  priceBook: PriceBook;
  priceError?: string;
};

const KEYS = {
  holdings: 'gg.holdings.v1',
  settings: 'gg.settings.v1',
  feed: 'gg.feed.v1',
  cpi: 'gg.cpi.v1',
  prices: 'gg.prices.v1',
};

/** GitHub Pages address of feed.json, set in app.json → expo.extra.feedUrl. */
const FEED_URL = Constants.expoConfig?.extra?.feedUrl as string | undefined;

const bundled = snapshot as Feed;

/** Applies a feed; its CPI replaces the current series unless that one (read straight from TCMB) is newer. */
function feedPatch(feed: Feed, origin: State['feedOrigin'], currentCpiMonth = '') {
  setWithholdingRules(feed.withholding);
  const rows = feed.cpi.rows;
  return {
    feed,
    feedOrigin: origin,
    rateSchedule: rateDecisionDates(feed.rateDecisions.dates, feed.rateDecisions.time),
    ...(rows.at(-1)!.month >= currentCpiMonth && {
      cpi: { rows, index: buildCpiIndex(rows), live: origin === 'live' },
    }),
  };
}

const initialFeed = feedPatch(bundled, 'bundled');
let state: State = {
  ready: false,
  holdings: [],
  settings: { inflationSource: 'tuik', customAnnualRate: 0, notifyCpi: false },
  prices: {},
  priceBook: {},
  ...initialFeed,
  cpi: initialFeed.cpi!,
};

const lastCpiMonth = () => state.cpi.rows.at(-1)!.month;

const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

async function readJSON<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function persist(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

let loading: Promise<void> | undefined;

/** Loads saved data, then refreshes the feed, CPI and prices in the background. */
export function loadStore(): Promise<void> {
  loading ??= (async () => {
    const [holdings, settings, cachedFeed, cpi, priceBook] = await Promise.all([
      readJSON<Holding[]>(KEYS.holdings),
      readJSON<Settings>(KEYS.settings),
      readJSON<Feed>(KEYS.feed),
      readJSON<{ rows: CpiRow[] }>(KEYS.cpi),
      readJSON<PriceBook>(KEYS.prices),
    ]);
    const patch: Partial<State> = { ready: true };
    if (holdings) patch.holdings = holdings;
    if (settings) patch.settings = { ...state.settings, ...settings };
    // Last good prices, so the app still works offline; their time shows how old they are.
    if (priceBook) Object.assign(patch, { priceBook, prices: toLivePrices(priceBook) });
    if (isFeed(cachedFeed) && newerFeed(bundled, cachedFeed) === cachedFeed) {
      Object.assign(patch, feedPatch(cachedFeed, 'cached', lastCpiMonth()));
    }
    set(patch);
    if (cpi && cpi.rows.at(-1)!.month > lastCpiMonth()) {
      set({ cpi: { rows: cpi.rows, index: buildCpiIndex(cpi.rows), live: true } });
    }
    await refreshFeed();
    void refreshCpi();
    void refreshPrices();
    // Re-schedule so the reminders roll forward as dates pass.
    if (state.settings.notifyCpi) void enableReminders('cpi', state.rateSchedule);
    if (state.settings.notifyRate) void enableReminders('rate', state.rateSchedule);
  })();
  return loading;
}

/** Downloads the published feed; keeps the current one if anything fails. */
export async function refreshFeed(): Promise<boolean> {
  if (!FEED_URL) return false;
  try {
    const feed = await fetchFeed(FEED_URL);
    // An identical build still counts: it confirms the data on the phone is current.
    if (feed.generatedAt < state.feed.generatedAt) return false;
    const before = state.feed.rateDecisions.dates.join();
    set(feedPatch(feed, 'live', lastCpiMonth()));
    persist(KEYS.feed, feed);
    if (state.settings.notifyRate && feed.rateDecisions.dates.join() !== before) {
      void enableReminders('rate', state.rateSchedule);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads TCMB's CPI page directly as well, so a new CPI release shows up even if the
 * feed has not been rebuilt yet. TCMB sends no CORS headers, so this is native only.
 */
export async function refreshCpi(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const res = await fetch(TCMB_CPI_URL);
    if (!res.ok) return false;
    const rows = parseTcmbCpiHtml(await res.text());
    if (rows.at(-1)!.month <= lastCpiMonth()) return false;
    set({ cpi: { rows, index: buildCpiIndex(rows), live: true } });
    persist(KEYS.cpi, { rows });
    return true;
  } catch {
    return false;
  }
}

/** USD and EUR (ECB, TCMB as fallback) and gram gold; implausible quotes are rejected. */
export async function refreshPrices(): Promise<void> {
  const { book, errors } = await refreshPriceBook(state.priceBook, Platform.OS !== 'web');
  set({ priceBook: book, prices: toLivePrices(book), priceError: errors[0] });
  persist(KEYS.prices, book);
}

export function saveHolding(h: Holding) {
  const exists = state.holdings.some((x) => x.id === h.id);
  const holdings = exists ? state.holdings.map((x) => (x.id === h.id ? h : x)) : [...state.holdings, h];
  set({ holdings });
  persist(KEYS.holdings, holdings);
}

export function deleteHolding(id: string) {
  const holdings = state.holdings.filter((x) => x.id !== id);
  set({ holdings });
  persist(KEYS.holdings, holdings);
}

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch };
  set({ settings });
  persist(KEYS.settings, settings);
}

const SETTING: Record<ReminderKind, 'notifyCpi' | 'notifyRate'> = { cpi: 'notifyCpi', rate: 'notifyRate' };

/** Turns CPI or rate-decision reminders on or off; returns false if notifications are not permitted. */
export async function setReminders(kind: ReminderKind, on: boolean): Promise<boolean> {
  if (!on) {
    await disableReminders(kind);
    updateSettings({ [SETTING[kind]]: false });
    return true;
  }
  const ok = await enableReminders(kind, state.rateSchedule);
  updateSettings({ [SETTING[kind]]: ok });
  return ok;
}

/** Replaces all holdings and settings with a restored backup. */
export function restoreData(holdings: Holding[], settings: Settings) {
  // Reminders belong to this phone's permissions, not to the backup.
  set({ holdings, settings: { ...settings, notifyCpi: state.settings.notifyCpi, notifyRate: state.settings.notifyRate } });
  persist(KEYS.holdings, holdings);
  persist(KEYS.settings, state.settings);
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
