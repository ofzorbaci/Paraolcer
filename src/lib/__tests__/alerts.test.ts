import { describe, expect, it } from 'vitest';

import feed from '../../data/feed-snapshot.json';
import { checkAlerts, goalProgress, goalTarget } from '../alerts';
import { buildCpiIndex } from '../cpi';
import { cpiPendingMonth, gradeFor, karneFresh, renewSavingsThisYear } from '../karne';
import type { Settings } from '../types';

const index = buildCpiIndex(feed.cpi.rows);
const custom24: Settings = { inflationSource: 'custom', customAnnualRate: 24, notifyCpi: false };
const both = { realBelowZero: true, goal: true };

describe('alerts', () => {
  it('grows the goal with inflation so it keeps the same purchasing power', () => {
    expect(goalTarget({ amount: 1_000_000, setAt: '2025-10-15' }, '2026-10-15', custom24, index)).toBeCloseTo(1_240_000, -1);
    expect(goalProgress(620_000, 1_240_000)).toBeCloseTo(0.5, 6);
    expect(goalProgress(2_000_000, 1_240_000)).toBe(1);
  });

  it('fires once when the real return turns negative, again only after it recovers', () => {
    const a = checkAlerts({}, { real: -0.01 }, both);
    expect(a.fire).toHaveLength(1);
    const b = checkAlerts(a.state, { real: -0.03 }, both);
    expect(b.fire).toHaveLength(0);
    const c = checkAlerts(b.state, { real: 0.02 }, both);
    expect(c.fire).toHaveLength(0);
    expect(checkAlerts(c.state, { real: -0.02 }, both).fire).toHaveLength(1);
  });

  it('fires when the goal is reached and stays quiet while it holds', () => {
    const a = checkAlerts({}, { value: 900, target: 1000 }, both);
    expect(a.fire).toHaveLength(0);
    const b = checkAlerts(a.state, { value: 1100, target: 1000 }, both);
    expect(b.fire.map((m) => m.title)).toEqual(['Hedefine ulaştın']);
    expect(checkAlerts(b.state, { value: 1200, target: 1000 }, both).fire).toHaveLength(0);
  });

  it('forgets the state of a switched-off alarm', () => {
    const a = checkAlerts({ realNegative: true }, { real: -0.1 }, { realBelowZero: false, goal: false });
    expect(a.fire).toHaveLength(0);
    expect(a.state.realNegative).toBeUndefined();
  });
});

describe('karne', () => {
  it('grades the real return', () => {
    expect(gradeFor(0.08).letter).toBe('A');
    expect(gradeFor(0.01).letter).toBe('B');
    expect(gradeFor(-0.02).letter).toBe('C');
    expect(gradeFor(-0.2).letter).toBe('D');
  });

  it('is fresh in the release month until the 20th', () => {
    expect(karneFresh('2026-09', '2026-10-03')).toBe(true);
    expect(karneFresh('2026-09', '2026-10-21')).toBe(false);
    expect(karneFresh('2026-12', '2027-01-05')).toBe(true);
    expect(karneFresh('2026-08', '2026-10-05')).toBe(false);
  });
});

describe('CPI pending', () => {
  it('flags the new month only after its release moment', () => {
    // November 3, 2026 is a Tuesday: October CPI at 10:00.
    expect(cpiPendingMonth(new Date(2026, 10, 3, 9, 0), '2026-09')).toBeUndefined();
    expect(cpiPendingMonth(new Date(2026, 10, 3, 10, 30), '2026-09')).toBe('2026-10');
    expect(cpiPendingMonth(new Date(2026, 10, 3, 10, 30), '2026-10')).toBeUndefined();
    expect(cpiPendingMonth(new Date(2027, 0, 4, 11, 0), '2026-11')).toBe('2026-12');
  });

  it('adds up this year’s maturity gaps only', () => {
    const log = [
      { maturity: '2026-03-01', diff: 100 },
      { maturity: '2026-11-01', diff: 50 },
      { maturity: '2025-12-01', diff: 999 },
    ];
    expect(renewSavingsThisYear(log, '2026-11-15')).toBe(150);
    expect(renewSavingsThisYear(undefined, '2026-11-15')).toBe(0);
  });
});
