import { describe, expect, it } from 'vitest';

import feed from '../../data/feed-snapshot.json';
import { netWorth, salaryPower } from '../budget/month-end';
import type { Account, Transaction } from '../budget/types';
import { buildCpiIndex } from '../cpi';
import type { Settings } from '../types';

const index = buildCpiIndex(feed.cpi.rows);
const custom24: Settings = { inflationSource: 'custom', customAnnualRate: 24, notifyCpi: false };
const accounts: Account[] = [
  { id: 'b', name: 'Banka', type: 'bank', currency: 'TRY', opening: 1_000_000, createdAt: '2025-01-01' },
  { id: 'u', name: 'Dolar', type: 'bank', currency: 'usd', opening: 100_000, createdAt: '2025-01-01' },
];
const salary = (date: string, lira: number): Transaction => ({
  id: date,
  type: 'income',
  amount: lira * 100,
  accountId: 'b',
  categoryId: 'salary',
  date,
  createdAt: date,
});

describe('net worth', () => {
  it('adds savings and every account, in TRY and in dollars', () => {
    const w = netWorth(50_000, accounts, [], { usd: 40 });
    // savings 50k + bank 10k + $1000 × 40
    expect(w.total).toBeCloseTo(100_000, 6);
    expect(w.usd).toBeCloseTo(2_500, 6);
    expect(netWorth(0, accounts, [], {}).missing).toEqual(['Dolar']);
  });
});

describe('salary purchasing power', () => {
  it('compares with the same month a year earlier, in its prices', () => {
    const txs = [salary('2025-10-01', 40_000), salary('2026-04-01', 45_000), salary('2026-10-01', 49_600)];
    const p = salaryPower(txs, accounts, {}, custom24, index)!;
    expect(p.baseMonth).toBe('2025-10');
    expect(p.latestInBasePrices).toBeCloseTo(40_000, -1);
    expect(p.real).toBeCloseTo(0, 2);
  });

  it('needs two different salary months', () => {
    expect(salaryPower([salary('2026-10-01', 1)], accounts, {}, custom24, index)).toBeUndefined();
  });
});
