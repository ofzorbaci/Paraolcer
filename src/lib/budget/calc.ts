// Pure budget arithmetic. Transfers move money between the user's own accounts and are never
// income or expense, so they change balances but not totals.

import { category } from './categories';
import type { Account, BudgetCurrency, Transaction } from './types';

/** TRY per unit for foreign currencies; TRY itself is always 1. */
export type Rates = Partial<Record<Exclude<BudgetCurrency, 'TRY'>, number>>;

export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

/** Minor units of `currency` in TRY (a number, not minor units); undefined without a rate. */
export function toTry(minor: number, currency: BudgetCurrency, rates: Rates): number | undefined {
  if (currency === 'TRY') return minor / 100;
  const r = rates[currency];
  return r === undefined ? undefined : (minor / 100) * r;
}

/** Balance in the account's own currency, minor units. */
export function accountBalance(account: Account, txs: Transaction[]): number {
  let b = account.opening;
  for (const t of txs) {
    if (t.accountId === account.id) b += t.type === 'income' ? t.amount : -t.amount;
    if (t.type === 'transfer' && t.toAccountId === account.id) b += t.toAmount ?? t.amount;
  }
  return b;
}

/** Sum of all balances in TRY; accounts without a rate are listed instead of guessed. */
export function totalBalance(accounts: Account[], txs: Transaction[], rates: Rates): { total: number; missing: Account[] } {
  let total = 0;
  const missing: Account[] = [];
  for (const a of accounts) {
    const v = toTry(accountBalance(a, txs), a.currency, rates);
    if (v === undefined) missing.push(a);
    else total += v;
  }
  return { total, missing };
}

export type Range = { from: string; to: string };

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Monday to Sunday around `today` (the Turkish week). */
export function weekRange(today: string): Range {
  const d = parse(today);
  const back = (d.getDay() + 6) % 7;
  const from = addDays(today, -back);
  return { from, to: addDays(from, 6) };
}

export type PeriodKey = 'week' | 'month' | 'lastMonth' | 'last3';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'week', label: 'Bu hafta' },
  { key: 'month', label: 'Bu ay' },
  { key: 'lastMonth', label: 'Geçen ay' },
  { key: 'last3', label: 'Son 3 ay' },
];

export function monthRange(month: string): Range {
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: iso(new Date(y, m, 0)) };
}

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return iso(d).slice(0, 7);
}

export function periodRange(key: PeriodKey, today: string): Range {
  const month = today.slice(0, 7);
  if (key === 'week') return weekRange(today);
  if (key === 'month') return monthRange(month);
  if (key === 'lastMonth') return monthRange(shiftMonth(month, -1));
  return { from: monthRange(shiftMonth(month, -2)).from, to: monthRange(month).to };
}

/** The same-length period just before `range`, for "+12% vs before". */
export function previousRange(key: PeriodKey, today: string): Range {
  if (key === 'week') {
    const w = weekRange(today);
    return { from: addDays(w.from, -7), to: addDays(w.from, -1) };
  }
  const month = today.slice(0, 7);
  if (key === 'month') return monthRange(shiftMonth(month, -1));
  if (key === 'lastMonth') return monthRange(shiftMonth(month, -2));
  return { from: monthRange(shiftMonth(month, -5)).from, to: monthRange(shiftMonth(month, -3)).to };
}

const inRange = (t: Transaction, r: Range) => t.date >= r.from && t.date <= r.to;

/** A transaction's amount in TRY, using its account's currency. */
function txTry(t: Transaction, accounts: Map<string, Account>, rates: Rates): number | undefined {
  const a = accounts.get(t.accountId);
  return a ? toTry(t.amount, a.currency, rates) : undefined;
}

export function totals(txs: Transaction[], range: Range, accounts: Account[], rates: Rates): { income: number; expense: number; count: number } {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const t of txs) {
    if (t.type === 'transfer' || !inRange(t, range)) continue;
    const v = txTry(t, byId, rates);
    if (v === undefined) continue;
    count++;
    if (t.type === 'income') income += v;
    else expense += v;
  }
  return { income, expense, count };
}

export type BreakdownRow = { id: string; label: string; color: string; icon: string; amount: number; share: number; count: number };

export function byCategory(txs: Transaction[], range: Range, accounts: Account[], rates: Rates, kind: 'expense' | 'income' = 'expense'): BreakdownRow[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rows = new Map<string, BreakdownRow>();
  for (const t of txs) {
    if (t.type !== kind || !inRange(t, range)) continue;
    const v = txTry(t, byId, rates);
    if (v === undefined) continue;
    const c = category(t.categoryId);
    const row = rows.get(c.id) ?? { id: c.id, label: c.name, color: c.color, icon: c.icon, amount: 0, share: 0, count: 0 };
    row.amount += v;
    row.count++;
    rows.set(c.id, row);
  }
  return withShares([...rows.values()]);
}

export function byAccount(txs: Transaction[], range: Range, accounts: Account[], rates: Rates): BreakdownRow[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rows = new Map<string, BreakdownRow>();
  for (const t of txs) {
    if (t.type !== 'expense' || !inRange(t, range)) continue;
    const a = byId.get(t.accountId);
    const v = txTry(t, byId, rates);
    if (!a || v === undefined) continue;
    const row = rows.get(a.id) ?? { id: a.id, label: a.name, color: '#1D4ED8', icon: a.type, amount: 0, share: 0, count: 0 };
    row.amount += v;
    row.count++;
    rows.set(a.id, row);
  }
  return withShares([...rows.values()]);
}

function withShares(rows: BreakdownRow[]): BreakdownRow[] {
  const sum = rows.reduce((a, r) => a + r.amount, 0);
  return rows.map((r) => ({ ...r, share: sum > 0 ? r.amount / sum : 0 })).sort((a, b) => b.amount - a.amount);
}

export type HeatDay = { date: string; amount: number; level: 0 | 1 | 2 | 3 | 4 };

/** Spending per day of `month`, with a 0–4 intensity relative to the month's biggest day. */
export function dailyHeat(txs: Transaction[], month: string, accounts: Account[], rates: Rates): HeatDay[] {
  const range = monthRange(month);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const sums = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== 'expense' || !inRange(t, range)) continue;
    const v = txTry(t, byId, rates);
    if (v !== undefined) sums.set(t.date, (sums.get(t.date) ?? 0) + v);
  }
  const max = Math.max(0, ...sums.values());
  const days: HeatDay[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const amount = sums.get(d) ?? 0;
    const level = amount <= 0 || max <= 0 ? 0 : (Math.min(4, Math.ceil((amount / max) * 4)) as HeatDay['level']);
    days.push({ date: d, amount, level });
  }
  return days;
}

/** Monday-first column (0–6) of a date, for laying out the heat map. */
export function weekdayIndex(date: string): number {
  return (parse(date).getDay() + 6) % 7;
}
