import { describe, expect, it } from 'vitest';

import { defaultWithholding, depositGrowth, depositValue, FX_WITHHOLDING, isTlDeposit } from '../deposit';
import { parseTcmbRates } from '../prices';
import { holdingValue } from '../returns';
import { depositTerms } from '../scenario';
import { exportWorkbook, parseSpreadsheet } from '../spreadsheet';
import type { Holding } from '../types';
import { plausibilityWarnings } from '../validate';

const usdDeposit: Holding = {
  id: 'u',
  kind: 'deposit',
  name: 'Dolar mevduat',
  buyDate: '2025-10-30',
  quantity: 10_000,
  unitCost: 42,
  grossRate: 3,
  termDays: 32,
  depositCurrency: 'usd',
};

describe('foreign-currency deposits', () => {
  it('withholds 25% on interest regardless of term', () => {
    expect(FX_WITHHOLDING).toBe(25);
    expect(defaultWithholding(32, 'usd')).toBe(25);
    expect(defaultWithholding(400, 'eur')).toBe(25);
    expect(defaultWithholding(32)).not.toBe(25);
  });

  it('grows in its own currency and converts at today’s rate', () => {
    const growth = depositGrowth(usdDeposit, '2026-10-30');
    // 3% gross, 25% withholding → 2.25% net, rolled every 32 days
    expect(growth).toBeCloseTo(Math.pow(1 + 0.0225 * (32 / 365), 365 / 32), 3);
    expect(holdingValue(usdDeposit, '2026-10-30', { usd: 50 })).toBeCloseTo(10_000 * 50 * growth, 6);
    expect(holdingValue(usdDeposit, '2026-10-30', {})).toBeUndefined();
    // Cost is the principal at the deposit-day rate.
    expect(depositValue(usdDeposit, usdDeposit.buyDate)).toBeCloseTo(420_000, 6);
  });

  it('stays out of the TRY deposit yardsticks', () => {
    expect(isTlDeposit(usdDeposit)).toBe(false);
    expect(depositTerms([usdDeposit]).fromPortfolio).toBe(false);
  });

  it('accepts low foreign-currency rates without a warning', () => {
    expect(plausibilityWarnings(usdDeposit, { prices: {} }).some((w) => w.field === 'gross')).toBe(false);
    expect(plausibilityWarnings({ ...usdDeposit, grossRate: 40 }, { prices: {} }).some((w) => w.field === 'gross')).toBe(true);
  });

  it('round-trips through Excel', () => {
    const rows = parseSpreadsheet(exportWorkbook([usdDeposit]), '2026-10-30', () => 'x');
    const h = rows[0].holding!;
    expect(h.kind).toBe('deposit');
    expect(h.depositCurrency).toBe('usd');
    expect(h.quantity).toBe(10_000);
    expect(h.unitCost).toBe(42);
  });
});

describe('pound sterling', () => {
  it('reads GBP from the TCMB rates file', () => {
    const xml = `<Tarih_Date Tarih="30.10.2026"><Currency Kod="USD"><ForexBuying>49.8</ForexBuying><ForexSelling>50.0</ForexSelling></Currency>
      <Currency Kod="EUR"><ForexBuying>57.9</ForexBuying><ForexSelling>58.1</ForexSelling></Currency>
      <Currency Kod="GBP"><ForexBuying>66.4</ForexBuying><ForexSelling>66.6</ForexSelling></Currency></Tarih_Date>`;
    expect(parseTcmbRates(xml).gbp).toBeCloseTo(66.5, 6);
  });

  it('is priced live like the dollar', () => {
    const gbp: Holding = { id: 'g', kind: 'gbp', name: 'Sterlin', buyDate: '2026-01-01', quantity: 100, unitCost: 60 };
    expect(holdingValue(gbp, '2026-10-30', { gbp: 66.5 })).toBeCloseTo(6650, 6);
  });
});
