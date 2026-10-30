import { describe, expect, it } from 'vitest';

import feed from '../../data/feed-snapshot.json';
import { buildCpiIndex } from '../cpi';
import { nextMaturity, renewComparison, valueAt } from '../renew';
import type { Holding, Settings } from '../types';

const index = buildCpiIndex(feed.cpi.rows);
const custom24: Settings = { inflationSource: 'custom', customAnnualRate: 24, notifyCpi: false };

const deposit: Holding = {
  id: 'd',
  kind: 'deposit',
  name: 'Mevduat',
  buyDate: '2026-09-27',
  quantity: 1,
  unitCost: 100_000,
  grossRate: 40,
  termDays: 32,
};

const markets = {
  usdTry: [
    { month: '2025-09', value: 41 },
    { month: '2025-10', value: 42 },
    { month: '2026-09', value: 49 },
    { month: '2026-10', value: 49.8 },
  ],
  goldUsdOz: [
    { month: '2025-09', value: 3600 },
    { month: '2025-10', value: 4000 },
    { month: '2026-09', value: 4300 },
  ],
  source: '',
};

describe('next maturity', () => {
  it('finds the next rollover on or after today', () => {
    expect(nextMaturity(deposit, '2026-10-28')).toBe('2026-10-29');
    expect(nextMaturity(deposit, '2026-10-29')).toBe('2026-10-29');
    expect(nextMaturity(deposit, '2026-10-30')).toBe('2026-11-30');
  });

  it('has none for holdings without a term', () => {
    expect(nextMaturity({ ...deposit, kind: 'usd' }, '2026-10-28')).toBeUndefined();
  });
});

describe('valueAt', () => {
  it('takes the month or the latest one before it', () => {
    expect(valueAt(markets.usdTry, '2026-09')).toBe(49);
    expect(valueAt(markets.usdTry, '2026-03')).toBe(42);
    expect(valueAt(markets.usdTry, '2020-01')).toBeUndefined();
  });
});

describe('renew comparison', () => {
  it('measures the deposit, dollars and gold against the same inflation', () => {
    const r = renewComparison(deposit, 12, '2026-10-29', { usd: 49.8, gold: 6500 }, markets, custom24, index)!;
    expect(r.from).toBe('2025-10-01');
    expect(r.options.map((o) => o.key)).toEqual(['deposit', 'usd', 'gold']);
    const usd = r.options[1];
    // Dollars from the September 2025 month-end rate.
    expect(usd.nominal).toBeCloseTo(49.8 / 41 - 1, 6);
    expect(usd.real).toBeCloseTo((49.8 / 41) / (1 + r.inflation) - 1, 6);
    const dep = r.options[0];
    expect(dep.nominal).toBeGreaterThan(0.3);
    expect(dep.real).toBeCloseTo((1 + dep.nominal) / (1 + r.inflation) - 1, 6);
  });

  it('leaves out an asset with no history for the window', () => {
    const r = renewComparison(deposit, 12, '2026-10-29', {}, undefined, custom24, index)!;
    expect(r.options.map((o) => o.key)).toEqual(['deposit']);
  });

  it('only applies to deposits', () => {
    expect(renewComparison({ ...deposit, kind: 'usd' }, 3, '2026-10-29', {}, markets, custom24, index)).toBeUndefined();
  });
});
