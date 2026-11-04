// "Senin enflasyonun kaç?" — the user's own inflation from their own spending. Each budget category
// maps to a TÜİK main group; the user's spending shares are the weights and TÜİK's yearly change for
// each group is the rate. Until a full month of spending exists, the five-question basket stands in,
// clearly labelled as an estimate.

import { BASKET_GROUPS, basketRate, type Basket, type BasketGroup } from '../basket';
import type { Feed } from '../feed-types';
import { monthRange, toTry, type Rates } from './calc';
import type { Account, Transaction } from './types';

/** Budget category → TÜİK group. Debt payments and money set aside for investing are not consumption. */
export const CATEGORY_GROUP: Record<string, BasketGroup | null> = {
  market: 'food',
  rent: 'housing',
  bills: 'housing',
  food: 'other', // restaurants and cafés: TÜİK's "lokanta ve oteller", part of "other" here
  transport: 'transport',
  shopping: 'other',
  health: 'health',
  education: 'education',
  fun: 'other',
  subscriptions: 'other',
  'other-out': 'other',
  credit: null,
  'invest-out': null,
};

export const GROUP_LABEL: Record<BasketGroup, string> = Object.fromEntries(BASKET_GROUPS.map((g) => [g.id, g.label])) as Record<
  BasketGroup,
  string
>;

/** Fewer expenses than this in the last full month is not yet a spending pattern. */
export const MIN_EXPENSES = 5;

export type InflationRow = { group: BasketGroup; label: string; weight: number; yoy: number; contribution: number };

export type PersonalInflation =
  | { source: 'none' }
  | {
      source: 'spending' | 'questions';
      /** yearly %, e.g. 34.2 */
      rate: number;
      /** TÜİK headline yearly % for the same month */
      official: number;
      /** the month whose spending set the weights ('spending' only) */
      month?: string;
      /** groups by contribution to the rate, largest first */
      rows: InflationRow[];
    };

function previousMonth(today: string): string {
  const [y, m] = today.slice(0, 7).split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Spending per TÜİK group in `month`, TRY. */
export function groupSpending(txs: Transaction[], month: string, accounts: Account[], rates: Rates): { sums: Record<BasketGroup, number>; count: number } {
  const range = monthRange(month);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const sums = Object.fromEntries(BASKET_GROUPS.map((g) => [g.id, 0])) as Record<BasketGroup, number>;
  let count = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || t.date < range.from || t.date > range.to) continue;
    const group = CATEGORY_GROUP[t.categoryId ?? 'other-out'] ?? null;
    const a = byId.get(t.accountId);
    const v = a && toTry(t.amount, a.currency, rates);
    if (!group || v === undefined || v === null) continue;
    sums[group] += v;
    count++;
  }
  return { sums, count };
}

function rowsFor(weights: Record<BasketGroup, number>, yoy: Record<BasketGroup, number>): { rate: number; rows: InflationRow[] } | undefined {
  const total = BASKET_GROUPS.reduce((a, g) => a + Math.max(0, weights[g.id] ?? 0), 0);
  if (total <= 0) return undefined;
  const rows = BASKET_GROUPS.map((g) => {
    const weight = Math.max(0, weights[g.id] ?? 0) / total;
    return { group: g.id, label: g.label, weight, yoy: yoy[g.id], contribution: weight * yoy[g.id] };
  })
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.contribution - a.contribution);
  return { rate: rows.reduce((a, r) => a + r.contribution, 0), rows };
}

/**
 * The user's inflation: from last month's spending when it holds at least `MIN_EXPENSES` expenses
 * and the budget was in use for the whole month; else from the five-question basket; else none.
 */
export function personalInflation(opts: {
  txs: Transaction[];
  accounts: Account[];
  rates: Rates;
  today: string;
  groups: Feed['cpiGroups'];
  basket?: Basket;
  officialYoy: number;
}): PersonalInflation {
  const { txs, accounts, rates, today, groups, basket, officialYoy } = opts;
  const month = previousMonth(today);
  const first = txs.reduce<string | undefined>((min, t) => (!min || t.date < min ? t.date : min), undefined);
  const wholeMonth = !!first && first <= `${month}-03`;
  if (groups && wholeMonth) {
    const { sums, count } = groupSpending(txs, month, accounts, rates);
    const result = count >= MIN_EXPENSES ? rowsFor(sums, groups.yoy) : undefined;
    if (result) return { source: 'spending', official: groups.general, month, ...result };
  }
  if (basket && basketRate(basket) !== undefined) {
    const result = rowsFor(basket.weights, basket.rates);
    if (result) return { source: 'questions', official: groups?.general ?? officialYoy, ...result };
  }
  return { source: 'none' };
}

/** Days of spending still needed before the number comes from the user's own spending. */
export function daysUntilOwnInflation(txs: Transaction[], today: string): number {
  const first = txs.reduce<string | undefined>((min, t) => (!min || t.date < min ? t.date : min), undefined);
  // The first whole month starts on the 1st after (or on) the first transaction; it counts once it ends.
  const start = first ? new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - (Number(first.slice(8, 10)) <= 3 ? 1 : 0), 1) : new Date(today);
  const ready = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return Math.max(0, Math.ceil((ready.getTime() - new Date(today).getTime()) / 86_400_000));
}
