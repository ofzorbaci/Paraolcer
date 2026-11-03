import { describe, expect, it } from 'vitest';

import {
  accountBalance,
  byAccount,
  byCategory,
  dailyHeat,
  periodRange,
  previousRange,
  totalBalance,
  totals,
  weekRange,
} from '../budget/calc';
import { afterPaying, monthlyCost, nextAfter, occurrences } from '../budget/planned';
import type { Account, Planned, Transaction } from '../budget/types';

const acc = (id: string, over: Partial<Account> = {}): Account => ({
  id,
  name: id,
  type: 'bank',
  currency: 'TRY',
  opening: 0,
  createdAt: '2026-01-01',
  ...over,
});

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${n++}`,
  type: 'expense',
  amount: 10_000,
  accountId: 'bank',
  categoryId: 'market',
  date: '2026-11-03',
  createdAt: '2026-11-03',
  ...over,
});

const accounts = [acc('bank', { opening: 500_000 }), acc('cash'), acc('usd', { currency: 'usd', opening: 100_000 })];
const rates = { usd: 40 };

describe('balances', () => {
  it('moves money between own accounts without creating income or expense', () => {
    const txs = [tx({ type: 'transfer', amount: 200_000, toAccountId: 'cash', categoryId: undefined })];
    expect(accountBalance(accounts[0], txs)).toBe(300_000);
    expect(accountBalance(accounts[1], txs)).toBe(200_000);
    expect(totals(txs, { from: '2026-11-01', to: '2026-11-30' }, accounts, rates)).toEqual({ income: 0, expense: 0, count: 0 });
  });

  it('credits the converted amount on a cross-currency transfer', () => {
    const txs = [tx({ type: 'transfer', amount: 400_000, toAccountId: 'usd', toAmount: 10_000, categoryId: undefined })];
    expect(accountBalance(accounts[2], txs)).toBe(110_000);
  });

  it('totals accounts in TRY and lists the ones without a rate', () => {
    const txs = [tx({ amount: 50_000 }), tx({ type: 'income', amount: 1_000_000, categoryId: 'salary' })];
    const { total, missing } = totalBalance(accounts, txs, rates);
    // bank 5000 - 500 + 10000 = 14500 TL, cash 0, usd 1000 × 40 = 40000 TL
    expect(total).toBeCloseTo(54_500, 6);
    expect(missing).toEqual([]);
    expect(totalBalance(accounts, txs, {}).missing.map((a) => a.id)).toEqual(['usd']);
  });
});

describe('periods', () => {
  it('starts the week on Monday', () => {
    expect(weekRange('2026-11-03')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(weekRange('2026-11-08')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
  });

  it('builds month windows and the period before them', () => {
    expect(periodRange('month', '2026-11-03')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(periodRange('lastMonth', '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('last3', '2026-01-10')).toEqual({ from: '2025-11-01', to: '2026-01-31' });
    expect(previousRange('last3', '2026-01-10')).toEqual({ from: '2025-08-01', to: '2025-10-31' });
    expect(previousRange('week', '2026-11-03')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
  });
});

describe('breakdowns', () => {
  const txs = [
    tx({ amount: 30_000, categoryId: 'market' }),
    tx({ amount: 10_000, categoryId: 'food', date: '2026-11-05' }),
    tx({ amount: 1_000, categoryId: 'food', accountId: 'usd', date: '2026-11-05' }),
    tx({ type: 'income', amount: 999_999, categoryId: 'salary' }),
  ];
  const nov = { from: '2026-11-01', to: '2026-11-30' };

  it('groups expenses by category with shares in TRY', () => {
    const rows = byCategory(txs, nov, accounts, rates);
    expect(rows.map((r) => [r.id, r.amount, r.count])).toEqual([
      ['market', 300, 1],
      ['food', 500, 2],
    ].sort((a, b) => (b[1] as number) - (a[1] as number)));
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1, 10);
  });

  it('groups expenses by account', () => {
    expect(byAccount(txs, nov, accounts, rates).map((r) => [r.id, r.amount])).toEqual([
      ['bank', 400],
      ['usd', 400],
    ]);
  });

  it('marks the heaviest day at level 4 and quiet days at 0', () => {
    const heat = dailyHeat(txs, '2026-11', accounts, rates);
    expect(heat).toHaveLength(30);
    expect(heat.find((d) => d.date === '2026-11-05')!.level).toBe(4);
    expect(heat.find((d) => d.date === '2026-11-03')!.level).toBe(3);
    expect(heat.find((d) => d.date === '2026-11-10')!.level).toBe(0);
  });
});

describe('planned payments', () => {
  const rent: Planned = {
    id: 'p',
    name: 'Kira',
    kind: 'bill',
    amount: 2_000_000,
    currency: 'TRY',
    categoryId: 'rent',
    dueDate: '2026-01-31',
    repeat: 'monthly',
    anchorDay: 31,
    createdAt: '2026-01-01',
  };

  it('keeps the anchor day through short months', () => {
    expect(nextAfter('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    expect(nextAfter('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
    expect(nextAfter('2028-02-29', 'yearly', 29)).toBe('2029-02-28');
    expect(nextAfter('2026-12-15', 'monthly', 15)).toBe('2027-01-15');
    expect(nextAfter('2026-11-03', 'weekly', 3)).toBe('2026-11-10');
    expect(nextAfter('2026-11-03', 'none', 3)).toBeUndefined();
  });

  it('lists occurrences in a window', () => {
    expect(occurrences(rent, '2026-02-01', '2026-04-30')).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('moves a repeating payment on, and ends a one-off, when paid', () => {
    expect(afterPaying(rent)!.dueDate).toBe('2026-02-28');
    expect(afterPaying({ ...rent, repeat: 'none' })).toBeUndefined();
  });

  it('expresses subscriptions per month', () => {
    expect(monthlyCost({ ...rent, amount: 120_000, repeat: 'yearly' })).toBe(10_000);
    expect(monthlyCost(rent)).toBe(2_000_000);
  });
});
