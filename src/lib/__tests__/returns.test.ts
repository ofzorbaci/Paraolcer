import { describe, expect, it } from 'vitest';

import feed from '../../data/feed-snapshot.json';
import { buildCpiIndex, customInflation, tuikInflation } from '../cpi';
import { parseTcmbCpiHtml } from '../cpi-parse';
import { formatPct, parseAmount, parseDate } from '../format';
import { analyzeHolding, analyzePortfolio, holdingValue, realReturn } from '../returns';
import type { Holding, Settings } from '../types';

const snapshot = feed.cpi;

const index = buildCpiIndex(snapshot.rows);
const tuik: Settings = { inflationSource: 'tuik', customAnnualRate: 0, notifyCpi: false };

function holding(over: Partial<Holding>): Holding {
  return { id: 'h', kind: 'other', name: 'x', buyDate: '2024-01-15', quantity: 1, unitCost: 100, ...over };
}

describe('CPI index', () => {
  it('reproduces the published annual rate from chained monthly changes', () => {
    // Monthly figures are rounded to 2 decimals, so allow a small drift.
    for (const row of snapshot.rows.slice(12)) {
      const [y, m] = row.month.split('-');
      const prev = `${Number(y) - 1}-${m}`;
      const chained = (index.levels.get(row.month)! / index.levels.get(prev)! - 1) * 100;
      expect(Math.abs(chained - row.yoy)).toBeLessThan(0.6);
    }
  });

  it('uses the TÜİK convention: index of the buy month to the latest month', () => {
    const r = tuikInflation(index, '2024-12-10', '2025-12-31');
    expect(r.fromMonth).toBe('2024-12');
    expect(r.toMonth).toBe('2025-12');
    const dec2025 = snapshot.rows.find((x) => x.month === '2025-12')!;
    expect((r.factor - 1) * 100).toBeCloseTo(dec2025.yoy, 0);
  });

  it('marks periods past the latest published month as incomplete', () => {
    const r = tuikInflation(index, '2025-01-01', '2099-01-01');
    expect(r.complete).toBe(false);
    expect(r.toMonth).toBe(index.last);
  });

  it('returns no inflation for a purchase in the latest month', () => {
    const r = tuikInflation(index, `${index.last}-20`, `${index.last}-28`);
    expect(r.factor).toBe(1);
  });

  it('compounds a custom annual rate', () => {
    expect(customInflation(50, '2025-01-01', '2026-01-01').factor).toBeCloseTo(1.5, 5);
  });
});

describe('parseTcmbCpiHtml', () => {
  const row = (mm: string, y: string, yoy: string, mom: string) =>
    `<tr><td>${mm}-${y}</td><td>${yoy}</td><td>${mom}</td></tr>`;

  it('rejects a page with too few rows', () => {
    expect(() => parseTcmbCpiHtml(row('01', '2026', '30', '4'))).toThrow();
  });

  it('rejects a series with a gap', () => {
    const rows = Array.from({ length: 30 }, (_, i) => {
      const month = (i % 12) + 1;
      const year = 2020 + Math.floor(i / 12);
      return i === 10 ? '' : row(String(month).padStart(2, '0'), String(year), '10', '1');
    }).join('');
    expect(() => parseTcmbCpiHtml(rows)).toThrow(/boşluk/);
  });
});

describe('returns', () => {
  it('applies the Fisher equation', () => {
    expect(realReturn(0.5, 0.4)).toBeCloseTo(0.0714, 4);
    expect(realReturn(0.2, 0.3)).toBeLessThan(0);
  });

  it('compounds a deposit at its annual rate', () => {
    const d = holding({ kind: 'deposit', unitCost: 1000, depositRate: 40, buyDate: '2025-01-01' });
    expect(holdingValue(d, '2026-01-01', {})).toBeCloseTo(1400, 0);
  });

  it('prices currency holdings from live rates, falling back to the manual price', () => {
    const usd = holding({ kind: 'usd', quantity: 100, unitCost: 30, currentPrice: 40 });
    expect(holdingValue(usd, '2026-10-01', { usd: 50 })).toBe(5000);
    expect(holdingValue(usd, '2026-10-01', {})).toBe(4000);
  });

  it('leaves unpriced holdings without a return', () => {
    const a = analyzeHolding(holding({ kind: 'stock' }), '2026-10-01', {}, tuik, index);
    expect(a.real).toBeUndefined();
    expect(a.breakEven).toBeGreaterThan(a.cost);
  });

  it('beats inflation only when value exceeds the break-even', () => {
    const custom: Settings = { inflationSource: 'custom', customAnnualRate: 30, notifyCpi: false };
    const win = analyzeHolding(
      holding({ unitCost: 100, currentPrice: 140, buyDate: '2025-01-01' }),
      '2026-01-01', {}, custom, index,
    );
    expect(win.breakEven).toBeCloseTo(130, 5);
    expect(win.realGain).toBeCloseTo(10, 5);
    expect(win.real!).toBeGreaterThan(0);

    const lose = analyzeHolding(
      holding({ unitCost: 100, currentPrice: 120, buyDate: '2025-01-01' }),
      '2026-01-01', {}, custom, index,
    );
    expect(lose.nominal!).toBeCloseTo(0.2, 5);
    expect(lose.real!).toBeLessThan(0);
  });

  it('aggregates a portfolio against each holding’s own inflation', () => {
    const custom: Settings = { inflationSource: 'custom', customAnnualRate: 30, notifyCpi: false };
    const items = [
      analyzeHolding(holding({ unitCost: 100, currentPrice: 140, buyDate: '2025-01-01' }), '2026-01-01', {}, custom, index),
      analyzeHolding(holding({ unitCost: 100, currentPrice: 120, buyDate: '2025-01-01' }), '2026-01-01', {}, custom, index),
      analyzeHolding(holding({ kind: 'stock' }), '2026-01-01', {}, custom, index),
    ];
    const p = analyzePortfolio(items)!;
    expect(p.cost).toBe(200);
    expect(p.value).toBe(260);
    expect(p.breakEven).toBeCloseTo(260, 5);
    expect(p.real).toBeCloseTo(0, 5);
    expect(p.unpriced).toBe(1);
  });
});

describe('format', () => {
  it('parses Turkish dates and rejects impossible or future ones', () => {
    expect(parseDate('5.3.2024', '2026-10-28')).toBe('2024-03-05');
    expect(parseDate('31.02.2024', '2026-10-28')).toBeUndefined();
    expect(parseDate('01.01.2030', '2026-10-28')).toBeUndefined();
  });

  it('parses Turkish and plain amounts', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('2500')).toBe(2500);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('100.000')).toBe(100000);
    expect(parseAmount('1.250.000')).toBe(1250000);
    expect(parseAmount('38.25')).toBe(38.25);
    expect(parseAmount('abc')).toBeUndefined();
  });

  it('formats signed percentages', () => {
    expect(formatPct(0.123)).toBe('+%12,3');
    expect(formatPct(-0.05)).toBe('−%5,0');
  });
});
