// The budget's own store: accounts, transactions, planned payments. Same pattern as store.ts,
// kept separate so investments and day-to-day spending never mix. Everything stays on the phone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { deleteBudgetSnapshot, readBudgetSnapshot, writeBudgetSnapshot } from '@/lib/auto-backup';
import { afterPaying, occurrences } from '@/lib/budget/planned';
import { addDays } from '@/lib/budget/calc';
import { CURRENCY_SIGN, EMPTY_BUDGET, type Account, type BudgetData, type BudgetPrefs, type Planned, type Transaction } from '@/lib/budget/types';
import { groupThousands, todayISO } from '@/lib/format';
import { cancelBudgetReminders, scheduleBudgetReminders } from '@/lib/notify';

const KEY = 'gg.budget.v1';
/** Soonest payment reminders kept scheduled (rolled forward at launch). */
const BUDGET_REMINDER_LIMIT = 24;

type BudgetState = BudgetData & { ready: boolean };

let state: BudgetState = { ...EMPTY_BUDGET, ready: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBudget<T>(select: (s: BudgetState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

export function budgetData(): BudgetData {
  const { accounts, transactions, planned, prefs } = state;
  return { accounts, transactions, planned, prefs };
}

let snapshotTimer: ReturnType<typeof setTimeout> | undefined;

function commit(patch: Partial<BudgetData>) {
  state = { ...state, ...patch };
  emit();
  const data = budgetData();
  AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => void writeBudgetSnapshot(data), 1000);
  if (patch.planned || patch.prefs) void rescheduleBudgetReminders();
}

function valid(d: unknown): d is BudgetData {
  const b = d as BudgetData | undefined;
  return !!b && Array.isArray(b.accounts) && Array.isArray(b.transactions) && Array.isArray(b.planned);
}

let loading: Promise<void> | undefined;

/** Loads saved budget data; recovers from the snapshot if storage came back empty. */
export function loadBudget(): Promise<void> {
  loading ??= (async () => {
    let data: BudgetData | undefined;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw) as BudgetData;
    } catch {
      /* fall through to the snapshot */
    }
    if (!valid(data)) {
      const snap = await readBudgetSnapshot<BudgetData>();
      data = valid(snap) ? snap : undefined;
      if (data) AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
    }
    state = { ...EMPTY_BUDGET, ...data, prefs: { ...data?.prefs }, ready: true };
    emit();
    // Reminders cover the next 60 days; roll them forward on every launch.
    if (state.prefs.remindPayments) void rescheduleBudgetReminders();
  })();
  return loading;
}

export function newBudgetId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** The first account, created on first use so adding a transaction never hits a dead end. */
export function ensureDefaultAccount(): Account {
  if (state.accounts[0]) return state.accounts[0];
  const a: Account = { id: newBudgetId(), name: 'Nakit', type: 'cash', currency: 'TRY', opening: 0, createdAt: new Date().toISOString() };
  commit({ accounts: [a] });
  return a;
}

export function saveAccount(a: Account) {
  const exists = state.accounts.some((x) => x.id === a.id);
  commit({ accounts: exists ? state.accounts.map((x) => (x.id === a.id ? a : x)) : [...state.accounts, a] });
}

/** Removes an account with its transactions; planned payments keep running without an account. */
export function deleteAccount(id: string) {
  commit({
    accounts: state.accounts.filter((a) => a.id !== id),
    transactions: state.transactions.filter((t) => t.accountId !== id && t.toAccountId !== id),
    planned: state.planned.map((p) => (p.accountId === id ? { ...p, accountId: undefined } : p)),
  });
}

export function transactionCount(accountId: string): number {
  return state.transactions.filter((t) => t.accountId === accountId || t.toAccountId === accountId).length;
}

/** Rejects what would corrupt balances: zero amounts and transfers to the same account. */
export function checkTransaction(t: Transaction): string | undefined {
  if (!(t.amount > 0)) return 'Sıfırdan büyük bir tutar gir';
  if (!state.accounts.some((a) => a.id === t.accountId)) return 'Bir hesap seç';
  if (t.type === 'transfer') {
    if (!t.toAccountId || t.toAccountId === t.accountId) return 'Farklı bir hedef hesap seç';
    const from = state.accounts.find((a) => a.id === t.accountId);
    const to = state.accounts.find((a) => a.id === t.toAccountId);
    if (from && to && from.currency !== to.currency && !(t.toAmount && t.toAmount > 0)) return 'Hedef hesaba geçen tutarı gir';
  }
  return undefined;
}

export function saveTransaction(t: Transaction) {
  const exists = state.transactions.some((x) => x.id === t.id);
  commit({ transactions: exists ? state.transactions.map((x) => (x.id === t.id ? t : x)) : [...state.transactions, t] });
}

export function deleteTransaction(id: string) {
  commit({ transactions: state.transactions.filter((t) => t.id !== id) });
}

export function setBudgetPrefs(patch: Partial<BudgetPrefs>) {
  commit({ prefs: { ...state.prefs, ...patch } });
}

export function savePlanned(p: Planned) {
  const exists = state.planned.some((x) => x.id === p.id);
  commit({ planned: exists ? state.planned.map((x) => (x.id === p.id ? p : x)) : [...state.planned, p] });
}

export function deletePlanned(id: string) {
  commit({ planned: state.planned.filter((p) => p.id !== id) });
}

/** Records the payment as an expense and moves the plan to its next due date (a one-off ends). */
export function payPlanned(id: string, accountId: string, date: string, amount?: number) {
  const p = state.planned.find((x) => x.id === id);
  if (!p) return;
  const t: Transaction = {
    id: newBudgetId(),
    type: 'expense',
    amount: amount ?? p.amount,
    accountId,
    categoryId: p.categoryId,
    date,
    note: p.name,
    plannedId: p.id,
    createdAt: new Date().toISOString(),
  };
  const next = afterPaying(p);
  commit({
    transactions: [...state.transactions, t],
    planned: next ? state.planned.map((x) => (x.id === id ? next : x)) : state.planned.filter((x) => x.id !== id),
  });
}

/** Moves the plan to its next due date without recording anything. */
export function skipPlanned(id: string) {
  const p = state.planned.find((x) => x.id === id);
  if (!p) return;
  const next = afterPaying(p);
  commit({ planned: next ? state.planned.map((x) => (x.id === id ? next : x)) : state.planned.filter((x) => x.id !== id) });
}

/** Premium: due-date reminders for the next 60 days. */
export async function rescheduleBudgetReminders(): Promise<boolean> {
  if (!state.prefs.remindPayments) {
    await cancelBudgetReminders();
    return true;
  }
  const today = todayISO();
  const items = state.planned
    .flatMap((p) =>
      occurrences(p, today, addDays(today, 60)).map((date) => ({
        id: p.id,
        name: p.name,
        date,
        amount: `${CURRENCY_SIGN[p.currency]}${groupThousands(p.amount / 100, 2)}`,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    // iOS keeps at most 64 scheduled notifications per app; leave room for the other reminders.
    .slice(0, BUDGET_REMINDER_LIMIT);
  return scheduleBudgetReminders(items);
}

/** Replaces the budget with a restored backup. */
export function restoreBudget(data: BudgetData) {
  if (valid(data)) commit({ accounts: data.accounts, transactions: data.transactions, planned: data.planned, prefs: data.prefs ?? {} });
}

export async function deleteBudget(): Promise<void> {
  await cancelBudgetReminders();
  await AsyncStorage.removeItem(KEY).catch(() => {});
  deleteBudgetSnapshot();
  state = { ...EMPTY_BUDGET, ready: true };
  emit();
}
