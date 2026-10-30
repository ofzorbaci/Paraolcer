import { describe, expect, it } from 'vitest';

import feed from '../../data/feed-snapshot.json';
import { buildCpiIndex } from '../cpi';
import type { Feed } from '../feed-types';
import type { RenewResult } from '../renew';
import { averageRateFor, forwardReal, lastTermReal, liraOutcomes, liraSpread, renewRanking } from '../renew-forward';
import type { Holding, Settings } from '../types';
import { usdReal } from '../usd-real';

const index = buildCpiIndex(feed.cpi.rows);
const custom24: Settings = { inflationSource: 'custom', customAnnualRate: 24, notifyCpi: false };

const deposit: Holding = {
  id: 'd',
  kind: 'deposit',
  name: 'Mevduat',
  buyDate: '2026-01-01',
  quantity: 1,
  unitCost: 100_000,
  grossRate: 40,
  termDays: 32,
  withholding: 17.5,
};

describe('forward estimate', () => {
  it('matches a hand calculation: net rate compounded per term, Fisher against expected CPI', () => {
    // 40% gross, 17.5% withholding → 33% net simple; 32-day rollovers → (1 + 0.33·32/365)^(365/32)
    const nominal = Math.pow(1 + 0.33 * (32 / 365), 365 / 32) - 1;
    expect(forwardReal(40, 32, 17.5, 25)).toBeCloseTo((1 + nominal) / 1.25 - 1, 10);
    expect(forwardReal(40, 32, 17.5, 25)).toBeCloseTo(0.1076, 3);
  });

  it('picks the average rate for the term and waits when there is none', () => {
    const rates: Feed['depositRates'] = {
      date: '2026-10-24',
      byTerm: [
        { maxDays: 31, rate: 38 },
        { maxDays: 92, rate: 41 },
        { maxDays: null, rate: 35 },
      ],
      source: 'test',
    };
    expect(averageRateFor(rates, 32)).toBe(41);
    expect(averageRateFor(rates, 400)).toBe(35);
    expect(averageRateFor(undefined, 32)).toBeUndefined();
  });

  it('measures the last completed term and nothing before the first rollover', () => {
    expect(lastTermReal(deposit, '2026-01-20', custom24, index)).toBeUndefined();
    const r = lastTermReal(deposit, '2026-02-10', custom24, index)!;
    const growth = 1 + 0.33 * (32 / 365);
    expect(r).toBeCloseTo(growth / Math.pow(1.24, 32 / 365) - 1, 8);
  });
});

describe('maturity ranking and lira amounts', () => {
  const result: RenewResult = {
    from: '2026-09-01',
    inflation: 0.02,
    options: [
      { key: 'deposit', label: 'Mevduat', nominal: 0.03, real: 0.01 },
      { key: 'usd', label: 'Dolar', nominal: 0.01, real: -0.01 },
      { key: 'gold', label: 'Altın', nominal: 0.05, real: 0.03 },
    ],
  };

  it('orders options from best to worst', () => {
    expect(renewRanking(result).map((o) => o.key)).toEqual(['gold', 'deposit', 'usd']);
  });

  it('expresses each option on the deposit’s current value', () => {
    const today = '2026-01-01';
    const lira = liraOutcomes(result, deposit, today);
    expect(lira.find((x) => x.key === 'gold')!.lira).toBeCloseTo(3000, 6);
    expect(liraSpread(result, deposit, today)).toBeCloseTo(4000, 6);
  });
});

describe('dollar-based real return', () => {
  const f = {
    markets: { usdTry: [{ month: '2025-10', value: 40 }], goldUsdOz: [], source: 't' },
    usCpi: { rows: [{ month: '2025-10', value: 300 }, { month: '2026-09', value: 309 }], source: 't' },
  };

  it('loses US inflation on dollars held', () => {
    const usd: Holding = { id: 'u', kind: 'usd', name: 'Dolar', buyDate: '2025-10-05', quantity: 1000, unitCost: 40 };
    const r = usdReal(usd, { cost: 40_000, value: 50_000 }, { usd: 50 }, f);
    expect(r).toBeCloseTo(1 / 1.03 - 1, 8);
  });

  it('converts other holdings at the buy month’s rate', () => {
    const gold: Holding = { id: 'g', kind: 'gold', name: 'Altın', buyDate: '2025-10-05', quantity: 10, unitCost: 4000 };
    const r = usdReal(gold, { cost: 40_000, value: 60_000 }, { usd: 50 }, f);
    // $1000 then, $1200 now, US prices +3%
    expect(r).toBeCloseTo(1.2 / 1.03 - 1, 8);
    expect(usdReal(gold, { cost: 40_000, value: undefined }, { usd: 50 }, f)).toBeUndefined();
  });
});
