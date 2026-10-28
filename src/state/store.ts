import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import snapshot from '@/data/cpi-tuik.json';
import { buildCpiIndex, type CpiIndex } from '@/lib/cpi';
import { parseTcmbCpiHtml, TCMB_CPI_URL, type CpiRow } from '@/lib/cpi-parse';
import { fetchTryRate } from '@/lib/fx';
import { fetchGoldUsdPerOunce, gramGoldTry } from '@/lib/gold';
import { disableCpiReminders, enableCpiReminders } from '@/lib/notify';
import type { Holding, LivePrices, Settings } from '@/lib/types';

type State = {
  ready: boolean;
  holdings: Holding[];
  settings: Settings;
  cpi: { rows: CpiRow[]; index: CpiIndex; fetchedAt: string; live: boolean };
  prices: LivePrices;
  pricesUpdatedAt?: string;
  priceError?: string;
};

const KEYS = { holdings: 'gg.holdings.v1', settings: 'gg.settings.v1', cpi: 'gg.cpi.v1' };

const bundledRows = snapshot.rows as CpiRow[];

let state: State = {
  ready: false,
  holdings: [],
  settings: { inflationSource: 'tuik', customAnnualRate: 0, notifyCpi: false },
  cpi: { rows: bundledRows, index: buildCpiIndex(bundledRows), fetchedAt: snapshot.fetchedAt, live: false },
  prices: {},
};

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

/** Loads saved data, then refreshes CPI and FX in the background. */
export function loadStore(): Promise<void> {
  loading ??= (async () => {
    const [holdings, settings, cpi] = await Promise.all([
      readJSON<Holding[]>(KEYS.holdings),
      readJSON<Settings>(KEYS.settings),
      readJSON<{ rows: CpiRow[]; fetchedAt: string }>(KEYS.cpi),
    ]);
    const patch: Partial<State> = { ready: true };
    if (holdings) patch.holdings = holdings;
    if (settings) patch.settings = { ...state.settings, ...settings };
    if (cpi && cpi.rows.at(-1)!.month > bundledRows.at(-1)!.month) {
      patch.cpi = { rows: cpi.rows, index: buildCpiIndex(cpi.rows), fetchedAt: cpi.fetchedAt, live: true };
    }
    set(patch);
    void refreshCpi();
    void refreshPrices();
    if (state.settings.notifyCpi) void enableCpiReminders();
  })();
  return loading;
}

/** Fetches the latest CPI table from TCMB; keeps the current data if anything fails. */
export async function refreshCpi(): Promise<boolean> {
  // TCMB sends no CORS headers, so browsers block it; web uses the bundled snapshot.
  if (Platform.OS === 'web') return false;
  try {
    const res = await fetch(TCMB_CPI_URL);
    if (!res.ok) return false;
    const rows = parseTcmbCpiHtml(await res.text());
    if (rows.at(-1)!.month < state.cpi.rows.at(-1)!.month) return false;
    const fetchedAt = new Date().toISOString();
    set({ cpi: { rows, index: buildCpiIndex(rows), fetchedAt, live: true } });
    persist(KEYS.cpi, { rows, fetchedAt });
    return true;
  } catch {
    return false;
  }
}

/** USD and EUR from ECB reference rates; gram gold from spot gold × USD/TRY. */
export async function refreshPrices(): Promise<void> {
  const [usd, eur, gold] = await Promise.allSettled([
    fetchTryRate('usd', 'latest'),
    fetchTryRate('eur', 'latest'),
    fetchGoldUsdPerOunce(),
  ]);
  const prices: LivePrices = { ...state.prices };
  if (usd.status === 'fulfilled') prices.usd = usd.value;
  if (eur.status === 'fulfilled') prices.eur = eur.value;
  if (gold.status === 'fulfilled' && prices.usd) prices.gold = gramGoldTry(gold.value, prices.usd);
  const failed = [usd, eur, gold].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
  set({
    prices,
    pricesUpdatedAt: new Date().toISOString(),
    priceError: failed ? (failed.reason instanceof Error ? failed.reason.message : 'Fiyat alınamadı') : undefined,
  });
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

/** Turns CPI release reminders on or off; returns false if notifications are not permitted. */
export async function setCpiReminders(on: boolean): Promise<boolean> {
  if (!on) {
    await disableCpiReminders();
    updateSettings({ notifyCpi: false });
    return true;
  }
  const ok = await enableCpiReminders();
  updateSettings({ notifyCpi: ok });
  return ok;
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
