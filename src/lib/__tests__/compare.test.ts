import { describe, expect, it } from 'vitest';

import feed from '../../data/feed-snapshot.json';
import { compareSeries } from '../compare';
import { buildCpiIndex } from '../cpi';
import type { Feed } from '../feed-types';
import type { Holding, Settings } from '../types';

const index = buildCpiIndex(feed.cpi.rows);
const custom24: Settings = { inflationSource: 'custom', customAnnualRate: 24, notifyCpi: false };
const today = '2026-10-15';

const markets: Feed['markets'] = {
  usdTry: [
    { month: '2025-10', value: 40 },
    { month: '2026-04', value: 45 },
    { month: '2026-10', value: 50 },
  ],
  goldUsdOz: [
    { month: '2025-10', value: 3000 },
    { month: '2026-10', value: 3300 },
  ],
  source: 'test',
};
const testFeed = { markets, policyRate: { history: [{ from: '2020-01-01', rate: 36 }], source: 'test' } };

function holding(over: Partial<Holding>): Holding {
  return { id: 'h', kind: 'other', name: 'x', buyDate: '2025-01-01', quantity: 1, unitCost: 100, ...over };
}

describe('compareSeries', () => {
  const run = (holdings: Holding[], prices = {}) =>
    compareSeries({ holdings, months: 12, today, prices, feed: testFeed, settings: custom24, index });

  it('starts every line at 100 and deflates by the same inflation', () => {
    const c = run([]);
    for (const l of c.lines) expect(l.points[0].value).toBeCloseTo(100, 6);
    const cash = c.lines.find((l) => l.key === 'cash')!;
    expect(cash.real).toBeCloseTo(1 / 1.24 - 1, 6);
    const usd = c.lines.find((l) => l.key === 'usd')!;
    expect(usd.real).toBeCloseTo(50 / 40 / 1.24 - 1, 6);
    const gold = c.lines.find((l) => l.key === 'gold')!;
    expect(gold.real).toBeCloseTo((3300 * 50) / (3000 * 40) / 1.24 - 1, 6);
  });

  it('rolls the deposit line monthly at the policy rate after withholding', () => {
    const deposit = run([]).lines.find((l) => l.key === 'deposit')!;
    expect(deposit.real).toBeGreaterThan(0);
    expect(deposit.real).toBeLessThan(0.36 / 1.24);
  });

  it('prefers live prices for the current month', () => {
    const usd = run([], { usd: 60 }).lines.find((l) => l.key === 'usd')!;
    expect(usd.real).toBeCloseTo(60 / 40 / 1.24 - 1, 6);
  });

  it('leaves out holdings bought inside the window', () => {
    const c = run([
      holding({ id: 'a', currentPrice: 124 }),
      holding({ id: 'b', buyDate: '2026-06-01', currentPrice: 500 }),
    ]);
    expect(c.excluded).toBe(1);
    expect(c.lines.some((l) => l.key === 'portfolio')).toBe(true);
    expect(c.timeMachine!.now).toBeCloseTo(124, 6);
  });

  it('time machine expresses the starting value in today’s prices', () => {
    const c = run([holding({ unitCost: 100, currentPrice: 100, buyDate: '2024-01-01' })]);
    const tm = c.timeMachine!;
    expect(tm.month).toBe('2025-10');
    expect(tm.thenToday).toBeCloseTo(tm.then * 1.24, 6);
  });

  it('has no portfolio line when nothing was owned at the start', () => {
    const c = run([holding({ buyDate: '2026-09-01', currentPrice: 110 })]);
    expect(c.lines.some((l) => l.key === 'portfolio')).toBe(false);
    expect(c.timeMachine).toBeUndefined();
  });
});
