import { describe, expect, it } from 'vitest';

import snapshot from '../../data/cpi-tuik.json';
import { nextCpiReleases } from '../calendar';
import { buildCpiIndex } from '../cpi';
import { defaultWithholding, depositValue, effectiveAnnualYield, netAnnualRate } from '../deposit';
import { gramGoldTry } from '../gold';
import { analyzeHolding, holdingValue, summarizeByKind } from '../returns';
import { salaryErosion } from '../salary';
import { depositTerms, scenarioReal } from '../scenario';
import { purchasingPowerSeries, windowStart } from '../series';
import type { Holding, Settings } from '../types';

const index = buildCpiIndex(snapshot.rows);
const custom30: Settings = { inflationSource: 'custom', customAnnualRate: 30, notifyCpi: false };
const tuik: Settings = { inflationSource: 'tuik', customAnnualRate: 0, notifyCpi: false };

function holding(over: Partial<Holding>): Holding {
  return { id: 'h', kind: 'other', name: 'x', buyDate: '2025-10-01', quantity: 1, unitCost: 100, ...over };
}

describe('deposit', () => {
  it('picks the withholding rate by term', () => {
    expect(defaultWithholding(32)).toBe(17.5);
    expect(defaultWithholding(182)).toBe(17.5);
    expect(defaultWithholding(183)).toBe(15);
    expect(defaultWithholding(365)).toBe(15);
    expect(defaultWithholding(400)).toBe(10);
  });

  it('nets out withholding', () => {
    expect(netAnnualRate(40, 15)).toBeCloseTo(34, 10);
  });

  it('compounds at each rollover', () => {
    const d = holding({ kind: 'deposit', unitCost: 100_000, grossRate: 40, termDays: 365, withholding: 15 });
    expect(depositValue(d, '2026-10-01')).toBeCloseTo(134_000, 0);
    // Monthly rollover earns more than one annual payout at the same net rate.
    expect(effectiveAnnualYield(34, 32)).toBeGreaterThan(0.34);
  });

  it('still values v1 deposits saved with a net rate', () => {
    const d = holding({ kind: 'deposit', unitCost: 1000, depositRate: 40, buyDate: '2025-01-01' });
    expect(depositValue(d, '2026-01-01')).toBeCloseTo(1400, 0);
  });
});

describe('live prices', () => {
  it('converts ounce spot to gram TRY', () => {
    expect(gramGoldTry(4049.5, 49.787)).toBeCloseTo(6482, 0);
  });

  it('prices gold live, falling back to the manual price', () => {
    const g = holding({ kind: 'gold', quantity: 20, unitCost: 4000, currentPrice: 6000 });
    expect(holdingValue(g, '2026-10-28', { gold: 6500 })).toBe(130_000);
    expect(holdingValue(g, '2026-10-28', {})).toBe(120_000);
  });
});

describe('summarizeByKind', () => {
  it('groups by asset class and sorts the best protector first', () => {
    const items = [
      holding({ id: 'a', kind: 'gold', unitCost: 100, currentPrice: 150 }),
      holding({ id: 'b', kind: 'usd', unitCost: 100, currentPrice: 110 }),
      holding({ id: 'c', kind: 'gold', unitCost: 100, currentPrice: 140 }),
    ].map((h) => ({ holding: h, analysis: analyzeHolding(h, '2026-10-01', {}, custom30, index) }));
    const s = summarizeByKind(items);
    expect(s.map((x) => x.kind)).toEqual(['gold', 'usd']);
    expect(s[0].value).toBe(290);
    expect(s[1].real).toBeLessThan(0);
  });
});

describe('scenario', () => {
  it('uses the example deposit when there are none', () => {
    const t = depositTerms([]);
    expect(t.fromPortfolio).toBe(false);
    expect(t.withholding).toBe(17.5);
  });

  it('weights the user’s deposits by principal', () => {
    const t = depositTerms([
      holding({ kind: 'deposit', unitCost: 300, grossRate: 40, termDays: 32 }),
      holding({ kind: 'deposit', unitCost: 100, grossRate: 48, termDays: 32 }),
    ]);
    expect(t.grossRate).toBeCloseTo(42, 10);
    expect(t.fromPortfolio).toBe(true);
  });

  it('turns negative when inflation beats the deposit', () => {
    const t = { grossRate: 40, termDays: 365, withholding: 15, fromPortfolio: true };
    expect(scenarioReal(t, 34)).toBeCloseTo(0, 10);
    expect(scenarioReal(t, 25)).toBeGreaterThan(0);
    expect(scenarioReal(t, 40)).toBeLessThan(0);
  });
});

describe('calendar', () => {
  it('releases on the 3rd at 10:00, moving weekends to Monday', () => {
    const [oct, nov, dec, jan] = nextCpiReleases(new Date(2026, 8, 20), 4);
    expect([oct.getDate(), oct.getMonth()]).toEqual([5, 9]); // 3 Oct 2026 is a Saturday
    expect([nov.getDate(), nov.getMonth()]).toEqual([3, 10]);
    expect([dec.getDate(), dec.getHours()]).toEqual([3, 10]);
    expect([jan.getFullYear(), jan.getMonth(), jan.getDate()]).toEqual([2027, 0, 4]); // 3 Jan 2027 is a Sunday
  });

  it('skips a release that already happened today', () => {
    const [next] = nextCpiReleases(new Date(2026, 10, 3, 11, 0), 1);
    expect(next.getMonth()).toBe(11);
  });
});

describe('salary', () => {
  it('measures erosion since the last raise', () => {
    const s = salaryErosion(50_000, '2025-10-15', '2026-10-15', custom30, index);
    expect(s.needed).toBeCloseTo(65_000, -1);
    expect(s.realValue).toBeCloseTo(50_000 / 1.3, -1);
    expect(s.raiseNeeded).toBeCloseTo(0.3, 2);
  });
});

describe('purchasing power series', () => {
  it('starts twelve months back, or at the first purchase if later', () => {
    expect(windowStart([holding({ buyDate: '2020-01-01' })], '2026-10-28')).toBe('2025-10');
    expect(windowStart([holding({ buyDate: '2026-03-10' })], '2026-10-28')).toBe('2026-03');
  });

  it('deflates the account value into start-month prices', () => {
    const d = holding({ kind: 'deposit', unitCost: 100_000, grossRate: 0, termDays: 32, buyDate: '2025-10-01' });
    const s = purchasingPowerSeries([d], '2026-10-01', {}, {}, custom30, index)!;
    expect(s.start).toBe('2025-10');
    expect(s.points[0]).toEqual({ month: '2025-10', nominal: 100_000, real: 100_000 });
    const last = s.points.at(-1)!;
    expect(last.nominal).toBeCloseTo(100_000, 5);
    expect(last.real).toBeCloseTo(100_000 / 1.3, -1);
    expect(s.estimated).toBe(false);
  });

  it('flags interpolated values for assets without price history', () => {
    const g = holding({ kind: 'stock', unitCost: 100, currentPrice: 200, buyDate: '2026-01-01' });
    const s = purchasingPowerSeries([g], '2026-10-28', {}, {}, tuik, index)!;
    expect(s.estimated).toBe(true);
    expect(s.points.at(-1)!.nominal).toBe(200);
  });
});
