import { describe, expect, it } from 'vitest';

import { closedReason, nextBusinessDay, payout } from '../business-day';
import { parseCurrencyApi, parseGoldpriceDev } from '../prices';
import { holdingValue, unitPrice } from '../returns';
import { feedQuote, knownSymbols, setSecurityPrices, usSymbol } from '../securities';
import type { Holding } from '../types';
import { usdReal } from '../usd-real';
import { plausibilityWarnings } from '../validate';

const holidays = new Map([
  ['2026-03-20', 'Ramazan Bayramı 1. Gün'],
  ['2026-03-21', 'Ramazan Bayramı 2. Gün'],
  ['2026-03-22', 'Ramazan Bayramı 3. Gün'],
]);

describe('business days', () => {
  it('moves a weekend or holiday maturity to the next business day', () => {
    // 2026-03-20 is a Friday holiday, then Saturday and Sunday (also holidays): paid Monday the 23rd.
    expect(nextBusinessDay('2026-03-20', holidays)).toBe('2026-03-23');
    expect(payout('2026-03-20', holidays)).toEqual({ date: '2026-03-23', reason: 'Ramazan Bayramı 1. Gün' });
    expect(payout('2026-11-14', holidays)).toEqual({ date: '2026-11-16', reason: 'Cumartesi' });
    expect(payout('2026-11-10', holidays)).toEqual({ date: '2026-11-10' });
    expect(closedReason('2026-11-15', holidays)).toBe('Pazar');
  });
});

describe('backup price sources', () => {
  it('reads currency-api (USD base) and goldprice.dev', () => {
    const q = parseCurrencyApi({ date: '2026-11-10', usd: { try: 50, eur: 0.8, gbp: 0.75, xau: 0.00025 } });
    expect(q?.usd).toBe(50);
    expect(q?.eur).toBeCloseTo(62.5, 6);
    expect(q?.gbp).toBeCloseTo(66.667, 3);
    expect(q?.goldUsdOz).toBeCloseTo(4000, 6);
    expect(parseCurrencyApi({ usd: { eur: 0.8 } })).toBeUndefined();
    expect(parseGoldpriceDev({ symbols: [{ symbol: 'XAU', price: '4026.48', is_stale: false }] })).toBe(4026.48);
    expect(parseGoldpriceDev({ symbols: [{ symbol: 'XAU', price: '4026.48', is_stale: true }] })).toBeUndefined();
  });
});

describe('US stocks, ETFs and crypto', () => {
  const us = {
    stocks: { AAPL: { price: 250, date: '2026-11-09', name: 'Apple' }, SPY: { price: 700, date: '2026-11-09', name: 'SPDR S&P 500', etf: true } },
    crypto: { BTC: { price: 72_000, date: '2026-11-10', name: 'Bitcoin' } },
    source: 'Finnhub',
  };
  const apple: Holding = { id: 'a', kind: 'usStock', name: 'AAPL', buyDate: '2025-11-10', quantity: 10, usdUnitCost: 200, unitCost: 200 * 40 };

  it('normalises symbols', () => {
    expect(usSymbol(' brk-b ')).toBe('BRK.B');
    expect(usSymbol('btc')).toBe('BTC');
    expect(usSymbol('Apple Inc')).toBeUndefined();
  });

  it('prices in dollars from the feed and converts at today’s USD/TRY', () => {
    setSecurityPrices(undefined, us);
    expect(feedQuote(apple)).toMatchObject({ price: 250, currency: 'USD', source: 'Finnhub' });
    expect(unitPrice(apple, { usd: 50 })).toBe(12_500);
    expect(holdingValue(apple, '2026-11-10', { usd: 50 })).toBe(125_000);
    const btc: Holding = { id: 'b', kind: 'crypto', name: 'btc', buyDate: '2026-01-01', quantity: 0.5, usdUnitCost: 90_000, unitCost: 90_000 * 43 };
    expect(holdingValue(btc, '2026-11-10', { usd: 50 })).toBe(0.5 * 72_000 * 50);
    // No USD/TRY yet: no value rather than a wrong one.
    expect(unitPrice(apple, {})).toBeUndefined();
  });

  it('falls back to the hand-entered dollar price for symbols the feed does not list', () => {
    setSecurityPrices(undefined, us);
    const odd: Holding = { ...apple, name: 'XYZQ', currentPriceUsd: 12 };
    expect(feedQuote(odd)).toBeUndefined();
    expect(unitPrice(odd, { usd: 50 })).toBe(600);
  });

  it('splits stocks from ETFs in the suggestions', () => {
    setSecurityPrices(undefined, us);
    expect(knownSymbols('usStock').map((s) => s.symbol)).toEqual(['AAPL']);
    expect(knownSymbols('etf').map((s) => s.symbol)).toEqual(['SPY']);
    expect(knownSymbols('crypto').map((s) => s.symbol)).toEqual(['BTC']);
  });

  it('uses the exact dollar cost for the dollar-based real return', () => {
    // $2.000 → $2.500 with US prices up 3%: +21,4% in real dollars.
    const r = usdReal(
      apple,
      { cost: apple.unitCost * apple.quantity, value: 125_000 },
      { usd: 50 },
      { usCpi: { rows: [{ month: '2025-11', value: 100 }, { month: '2026-10', value: 103 }], source: '' } },
    );
    expect(r).toBeCloseTo(2500 / 2000 / 1.03 - 1, 9);
  });

  it('warns when the purchase-day dollar rate looks wrong', () => {
    const w = plausibilityWarnings({ ...apple, unitCost: 200 * 4 }, { referenceRate: 40, prices: {} });
    expect(w.some((x) => x.field === 'cost')).toBe(true);
    expect(plausibilityWarnings(apple, { referenceRate: 40, prices: {} })).toEqual([]);
  });
});

describe('hand-entered prices', () => {
  it('lists hand-priced holdings oldest first and labels them as entered by the user', async () => {
    const { enteredLabel, manualHoldings, staleHoldings, withEnteredPrice } = await import('../stale');
    setSecurityPrices(undefined, undefined);
    const now = new Date('2026-11-10T12:00:00');
    const thy: Holding = { id: 't', kind: 'stock', name: 'THYAO', buyDate: '2026-01-02', quantity: 10, unitCost: 300, currentPrice: 320, priceUpdatedAt: '2026-11-06T09:00:00' };
    const asels: Holding = { ...thy, id: 'a', name: 'ASELS', priceUpdatedAt: '2026-11-09T09:00:00' };
    const usd: Holding = { id: 'u', kind: 'usd', name: '', buyDate: '2026-01-02', quantity: 100, unitCost: 40 };
    expect(manualHoldings([asels, usd, thy]).map((h) => h.id)).toEqual(['t', 'a']);
    expect(staleHoldings([asels, thy], now).map((h) => h.id)).toEqual(['t']);
    expect(enteredLabel(asels, now)).toBe('Senin girdiğin · 9 Kasım');
    expect(enteredLabel(thy, now)).toBe('Senin girdiğin · 6 Kasım · 4 gün önce');
    const checked = withEnteredPrice(thy, 320, now);
    expect(checked.currentPrice).toBe(320);
    expect(staleHoldings([checked], now)).toEqual([]);
    const coin = withEnteredPrice({ ...thy, kind: 'crypto', name: 'ZZZ' }, 1.5, now);
    expect(coin.currentPriceUsd).toBe(1.5);
  });
});
