import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import snapshot from '@/data/feed-snapshot.json';
import { rateDecisionDates } from '@/lib/calendar';
import { buildCpiIndex, type CpiIndex } from '@/lib/cpi';
import { parseTcmbCpiHtml, TCMB_CPI_URL, type CpiRow } from '@/lib/cpi-parse';
import { setWithholdingRules } from '@/lib/deposit';
import { checkAlerts, goalTarget, type AlertState } from '@/lib/alerts';
import { NO_PREMIUM, type PremiumStatus } from '@/lib/entitlements';
import { fetchFeed, isFeed, newerFeed } from '@/lib/feed';
import type { Feed } from '@/lib/feed-types';
import {
  cancelMaturityReminders,
  cancelTrialEndReminder,
  disableReminders,
  enableReminders,
  notifyNow,
  scheduleMaturityReminders,
  scheduleTrialEndReminder,
  type ReminderKind,
} from '@/lib/notify';
import { nextMaturity } from '@/lib/renew';
import { deleteSnapshot, readSnapshot, writeSnapshot } from '@/lib/auto-backup';
import { setAmountsMasked } from '@/lib/format';
import { shouldAskForReview } from '@/lib/review';
import { requestReview } from '@/lib/store-review';
import { refreshPriceBook, toLivePrices, type PriceBook } from '@/lib/prices';
import { buy, initPurchases, restore, type Plan } from '@/lib/purchases';
import { analyzeHolding, analyzePortfolio } from '@/lib/returns';
import type { Holding, LivePrices, Portfolio, Settings } from '@/lib/types';

type State = {
  ready: boolean;
  /** every holding, in every portfolio; this is what is saved */
  allHoldings: Holding[];
  /** the holdings of the portfolio being viewed */
  holdings: Holding[];
  /** what the user chose; kept even when Premium lapses */
  settings: Settings;
  /** what the calculations use: Premium-only choices fall back to the free defaults */
  calcSettings: Settings;
  premium: PremiumStatus;
  /** the store subscription, before the development switch is applied */
  storePremium: PremiumStatus;
  /** development builds only: pretend to be Premium to test gated screens */
  devPremium: boolean;
  /** last automatic snapshot (native only) */
  autoBackupAt?: string;
  /** set when the holdings were recovered from the automatic snapshot at launch */
  restoredFromSnapshot?: boolean;
  meta: Meta;
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
  devPremium: 'gg.devPremium.v1',
  meta: 'gg.meta.v1',
};

type Meta = { opens: number; reviewAskedAt?: string; alerts?: AlertState };

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
const defaultSettings: Settings = { inflationSource: 'tuik', customAnnualRate: 0, notifyCpi: false };

let state: State = {
  ready: false,
  allHoldings: [],
  holdings: [],
  settings: defaultSettings,
  calcSettings: defaultSettings,
  premium: NO_PREMIUM,
  storePremium: NO_PREMIUM,
  devPremium: false,
  meta: { opens: 0 },
  prices: {},
  priceBook: {},
  ...initialFeed,
  cpi: initialFeed.cpi!,
};

const lastCpiMonth = () => state.cpi.rows.at(-1)!.month;

const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  const next = { ...state, ...patch };
  if (patch.storePremium || patch.devPremium !== undefined) {
    next.premium = __DEV__ && next.devPremium ? { ...NO_PREMIUM, active: true, source: 'dev' } : next.storePremium;
  }
  next.calcSettings = next.premium.active ? next.settings : { ...next.settings, inflationSource: 'tuik' };
  setAmountsMasked(next.settings.hideAmounts ?? false);
  if (patch.allHoldings || patch.settings) {
    const id = next.settings.activePortfolio;
    const active = next.settings.portfolios?.some((p) => p.id === id) ? id : undefined;
    next.holdings = next.allHoldings.filter((h) => h.portfolioId === active);
  }
  state = next;
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
  if (key === KEYS.holdings || key === KEYS.settings) scheduleSnapshot();
}

let snapshotTimer: ReturnType<typeof setTimeout> | undefined;

/** Rewrites the automatic snapshot a moment after the last change. */
function scheduleSnapshot() {
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(async () => {
    const savedAt = await writeSnapshot(state.allHoldings, state.settings);
    if (savedAt) set({ autoBackupAt: savedAt });
  }, 1000);
}

let loading: Promise<void> | undefined;

/** Loads saved data, then refreshes the feed, CPI and prices in the background. */
export function loadStore(): Promise<void> {
  loading ??= (async () => {
    const [holdings, settings, cachedFeed, cpi, priceBook, devPremium, meta, snapshot] = await Promise.all([
      readJSON<Holding[]>(KEYS.holdings),
      readJSON<Settings>(KEYS.settings),
      readJSON<Feed>(KEYS.feed),
      readJSON<{ rows: CpiRow[] }>(KEYS.cpi),
      readJSON<PriceBook>(KEYS.prices),
      __DEV__ ? readJSON<boolean>(KEYS.devPremium) : Promise.resolve(undefined),
      readJSON<Meta>(KEYS.meta),
      readSnapshot(),
    ]);
    const patch: Partial<State> = { ready: true };
    if (holdings) patch.allHoldings = holdings;
    if (settings) patch.settings = { ...state.settings, ...settings };
    // Storage came back empty but the snapshot has data: recover instead of starting from zero.
    if (!holdings && snapshot?.holdings.length) {
      patch.allHoldings = snapshot.holdings;
      patch.settings = { ...state.settings, ...snapshot.settings };
      patch.restoredFromSnapshot = true;
      persist(KEYS.holdings, snapshot.holdings);
      persist(KEYS.settings, patch.settings);
    }
    if (snapshot) patch.autoBackupAt = snapshot.savedAt;
    patch.meta = { ...meta, opens: (meta?.opens ?? 0) + 1 };
    persist(KEYS.meta, patch.meta);
    if (devPremium) patch.devPremium = true;
    // Last good prices, so the app still works offline; their time shows how old they are.
    if (priceBook) Object.assign(patch, { priceBook, prices: toLivePrices(priceBook) });
    if (isFeed(cachedFeed) && newerFeed(bundled, cachedFeed) === cachedFeed) {
      Object.assign(patch, feedPatch(cachedFeed, 'cached', lastCpiMonth()));
    }
    set(patch);
    if (cpi && cpi.rows.at(-1)!.month > lastCpiMonth()) {
      set({ cpi: { rows: cpi.rows, index: buildCpiIndex(cpi.rows), live: true } });
    }
    void initPurchases(applyStorePremium).then((s) => s && applyStorePremium(s));
    void refreshCpi();
    void refreshPrices();
    // In the background, so a slow network never holds the splash screen. Reminders are
    // re-scheduled afterwards so they roll forward and pick up a newly published PPK calendar.
    void refreshFeed().finally(rescheduleReminders);
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
    set(feedPatch(feed, 'live', lastCpiMonth()));
    persist(KEYS.feed, feed);
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
    void runAlertCheck();
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
  void runAlertCheck();
}

function setHoldings(allHoldings: Holding[]) {
  set({ allHoldings });
  persist(KEYS.holdings, allHoldings);
  void runAlertCheck();
}

export function saveHolding(h: Holding) {
  const exists = state.allHoldings.some((x) => x.id === h.id);
  // A new holding goes into the portfolio on screen.
  const saved = exists ? h : { ...h, portfolioId: state.settings.activePortfolio };
  setHoldings(exists ? state.allHoldings.map((x) => (x.id === h.id ? h : x)) : [...state.allHoldings, saved]);
  if (state.settings.notifyMaturity && h.kind === 'deposit') void scheduleMaturityReminders(maturities());
}

/** Adds several holdings at once (example portfolio, imports). */
export function addHoldings(list: Holding[]) {
  const portfolioId = state.settings.activePortfolio;
  setHoldings([...state.allHoldings, ...list.map((h) => ({ ...h, portfolioId }))]);
}

/** Removes the example portfolio. */
export function removeSamples() {
  setHoldings(state.allHoldings.filter((h) => !h.sample));
}

export function deleteHolding(id: string) {
  setHoldings(state.allHoldings.filter((x) => x.id !== id));
}

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch };
  set({ settings });
  persist(KEYS.settings, settings);
}

/** A subscription change from the store: trial start, renewal, expiry or refund. */
function applyStorePremium(status: PremiumStatus) {
  set({ storePremium: status });
  // Promised on the paywall: a reminder two days before a trial would start charging.
  if (status.trial && status.willRenew && status.expiresAt) void scheduleTrialEndReminder(status.expiresAt);
  else void cancelTrialEndReminder();
  // Rate-decision reminders are Premium; stop them when the subscription ends.
  if (!state.premium.active && state.settings.notifyRate) void setReminders('rate', false);
}

/** Opens the store purchase sheet; false if the user cancelled. Throws on store errors. */
export async function purchasePlan(plan: Plan): Promise<boolean> {
  const status = await buy(plan);
  if (!status) return false;
  applyStorePremium(status);
  return status.active;
}

/** Restores a subscription from the user's store account; true if one was found. */
export async function restorePurchases(): Promise<boolean> {
  const status = await restore();
  applyStorePremium(status);
  return status.active;
}

/** Development builds only: switch Premium on to test locked screens without a purchase. */
export function setDevPremium(on: boolean) {
  if (!__DEV__) return;
  set({ devPremium: on });
  persist(KEYS.devPremium, on);
  if (!state.premium.active && state.settings.notifyRate) void setReminders('rate', false);
}

/** Re-schedules the reminders that are on, so they follow the current calendars and deposits. */
export async function rescheduleReminders(): Promise<void> {
  if (state.settings.notifyCpi) await enableReminders('cpi', state.rateSchedule);
  if (state.settings.notifyRate) await enableReminders('rate', state.rateSchedule);
  if (state.settings.notifyMaturity) await scheduleMaturityReminders(maturities());
}

function maturities() {
  const today = new Date().toISOString().slice(0, 10);
  return state.allHoldings
    .filter((h) => h.kind === 'deposit' && !h.sample)
    .map((h) => ({ id: h.id, name: h.name, date: nextMaturity(h, today) }))
    .filter((m): m is { id: string; name: string; date: string } => !!m.date);
}

/** Deposit maturity reminders on or off; false if notifications are not permitted. */
export async function setMaturityReminders(on: boolean): Promise<boolean> {
  if (!on) {
    await cancelMaturityReminders();
    updateSettings({ notifyMaturity: false });
    return true;
  }
  const ok = await scheduleMaturityReminders(maturities());
  updateSettings({ notifyMaturity: ok });
  return ok;
}

/** Records that a free user saw the full "Yenilesem mi?" result for a deposit this month. */
export function recordRenewCheck(id: string) {
  if (state.premium.active) return;
  const month = new Date().toISOString().slice(0, 7);
  const usage = state.settings.renewUsage?.month === month ? state.settings.renewUsage : { month, ids: [] };
  if (!usage.ids.includes(id)) updateSettings({ renewUsage: { month, ids: [...usage.ids, id] } });
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
  set({ allHoldings: holdings, settings: { ...settings, notifyCpi: state.settings.notifyCpi, notifyRate: state.settings.notifyRate } });
  persist(KEYS.holdings, holdings);
  persist(KEYS.settings, state.settings);
}

/** After a good moment (a positive result on screen), ask for a store review if it is time. */
export async function maybeAskForReview(goodMoment: boolean): Promise<void> {
  if (!shouldAskForReview(state.meta.opens, state.meta.reviewAskedAt, new Date(), goodMoment)) return;
  const meta = { ...state.meta, reviewAskedAt: new Date().toISOString() };
  set({ meta });
  persist(KEYS.meta, meta);
  await requestReview();
}

/** Deletes everything Paraölçer keeps on this phone. The store subscription is not affected. */
export async function deleteAllData(): Promise<void> {
  await Promise.all([disableReminders('cpi'), disableReminders('rate'), cancelMaturityReminders(), cancelTrialEndReminder()]);
  await AsyncStorage.multiRemove(Object.values(KEYS)).catch(() => {});
  deleteSnapshot();
  set({
    allHoldings: [],
    settings: defaultSettings,
    devPremium: false,
    autoBackupAt: undefined,
    restoredFromSnapshot: false,
    meta: { opens: 0 },
    priceBook: {},
    prices: {},
  });
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Premium alarms: compares the whole portfolio (all portfolios together) with the last check and
 * notifies only when a condition flips — real return turning negative, or the goal reached.
 */
async function runAlertCheck(): Promise<void> {
  const { settings, calcSettings, premium, prices, cpi } = state;
  const enabled = { realBelowZero: !!settings.alertRealBelowZero, goal: !!settings.goal };
  if (!state.ready || !premium.active || (!enabled.realBelowZero && !enabled.goal)) return;
  const today = new Date().toISOString().slice(0, 10);
  const own = state.allHoldings.filter((h) => !h.sample);
  const total = analyzePortfolio(own.map((h) => analyzeHolding(h, today, prices, calcSettings, cpi.index)));
  const target = settings.goal && goalTarget(settings.goal, today, calcSettings, cpi.index);
  const { state: alerts, fire } = checkAlerts(state.meta.alerts ?? {}, { real: total?.real, value: total?.value, target }, enabled);
  if (JSON.stringify(alerts) !== JSON.stringify(state.meta.alerts ?? {})) {
    const meta = { ...state.meta, alerts };
    set({ meta });
    persist(KEYS.meta, meta);
  }
  for (const m of fire) await notifyNow(m.title, m.body, m.url);
}

/** Premium: alarm when the real return turns negative. */
export function setRealAlert(on: boolean) {
  updateSettings({ alertRealBelowZero: on });
  void runAlertCheck();
}

/** Premium: a goal in today's lira; undefined clears it. */
export function setGoal(amount: number | undefined) {
  updateSettings({ goal: amount ? { amount, setAt: new Date().toISOString().slice(0, 10) } : undefined });
  const meta = { ...state.meta, alerts: { ...state.meta.alerts, goalReached: undefined } };
  set({ meta });
  persist(KEYS.meta, meta);
  void runAlertCheck();
}

/** Shows another portfolio on the summary; undefined is the main one. */
export function selectPortfolio(id: string | undefined) {
  updateSettings({ activePortfolio: id });
}

/** Premium: a new, empty portfolio, selected right away. */
export function addPortfolio(name: string): Portfolio {
  const p = { id: newId(), name: name.trim() || 'Yeni portföy' };
  updateSettings({ portfolios: [...(state.settings.portfolios ?? []), p], activePortfolio: p.id });
  return p;
}

export function renamePortfolio(id: string, name: string) {
  updateSettings({ portfolios: (state.settings.portfolios ?? []).map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) });
}

/** Removes a portfolio together with its holdings. */
export function deletePortfolio(id: string) {
  const allHoldings = state.allHoldings.filter((h) => h.portfolioId !== id);
  const settings = {
    ...state.settings,
    portfolios: (state.settings.portfolios ?? []).filter((p) => p.id !== id),
    activePortfolio: state.settings.activePortfolio === id ? undefined : state.settings.activePortfolio,
  };
  set({ allHoldings, settings });
  persist(KEYS.holdings, allHoldings);
  persist(KEYS.settings, settings);
}
