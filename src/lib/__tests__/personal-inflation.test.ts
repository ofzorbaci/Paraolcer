import { describe, expect, it } from 'vitest';

import { defaultBasket } from '../basket';
import { daysUntilOwnInflation, personalInflation } from '../budget/personal-inflation';
import type { Account, Transaction } from '../budget/types';

const groups = {
  month: '2026-10',
  yoy: { housing: 40, food: 30, transport: 35, education: 50, health: 45, other: 25 },
  weights: { housing: 15, food: 25, transport: 16, education: 2, health: 3, other: 39 },
  general: 30,
  source: 'test',
};
const accounts: Account[] = [{ id: 'a', name: 'Banka', type: 'bank', currency: 'TRY', opening: 0, createdAt: '2026-09-01' }];

let n = 0;
const spend = (categoryId: string, lira: number, date = '2026-10-10'): Transaction => ({
  id: `t${n++}`,
  type: 'expense',
  amount: lira * 100,
  accountId: 'a',
  categoryId,
  date,
  createdAt: date,
});

const run = (txs: Transaction[], today = '2026-11-04', basket = undefined as ReturnType<typeof defaultBasket> | undefined) =>
  personalInflation({ txs, accounts, rates: {}, today, groups, basket, officialYoy: 30 });

describe('personal inflation from spending', () => {
  const october = [
    spend('rent', 20_000, '2026-10-01'),
    spend('market', 8_000),
    spend('market', 2_000),
    spend('transport', 5_000),
    spend('fun', 5_000),
    // Debt payments are not consumption and stay out of the weights.
    spend('credit', 50_000),
  ];

  it('weights TÜİK group rates by last month’s spending', () => {
    const r = run(october);
    expect(r.source).toBe('spending');
    if (r.source !== 'spending') return;
    // 20k housing 40%, 10k food 30%, 5k transport 35%, 5k other 25% → (800+300+175+125)/40
    expect(r.rate).toBeCloseTo(35, 10);
    expect(r.month).toBe('2026-10');
    expect(r.rows[0].label).toBe('Kira ve konut');
    expect(r.rows.reduce((a, x) => a + x.weight, 0)).toBeCloseTo(1, 10);
  });

  it('needs a whole month and at least five expenses', () => {
    const late = october.map((t) => ({ ...t, date: '2026-10-15' }));
    expect(run(late).source).toBe('none');
    expect(run(october.slice(0, 3)).source).toBe('none');
  });

  it('falls back to the five-question basket, labelled as such', () => {
    const r = run([], '2026-11-04', defaultBasket(30, groups));
    expect(r.source).toBe('questions');
    if (r.source === 'questions') expect(r.rate).toBeCloseTo(31.2, 10);
  });

  it('counts down to the first whole month', () => {
    expect(daysUntilOwnInflation([spend('market', 1, '2026-11-02')], '2026-11-04')).toBe(27);
    expect(daysUntilOwnInflation([spend('market', 1, '2026-11-10')], '2026-11-10')).toBe(52);
  });
});
