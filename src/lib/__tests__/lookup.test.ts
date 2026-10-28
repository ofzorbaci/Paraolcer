import { describe, expect, it } from 'vitest';

import { assetCode, priceAgeDays, priceLookup } from '../lookup';
import type { Holding } from '../types';

describe('priceLookup', () => {
  it('links BIST tickers to TradingView', () => {
    expect(priceLookup('stock', 'thyao')).toEqual({
      url: 'https://www.tradingview.com/symbols/BIST-THYAO/',
      site: 'TradingView',
    });
  });

  it('links fund codes to TEFAS', () => {
    expect(priceLookup('fund', ' TTE ')?.url).toBe('https://www.tefas.gov.tr/tr/fon-detayli-analiz/TTE');
  });

  it('handles the Turkish dotted i in codes', () => {
    expect(assetCode('sise')).toBe('SISE');
  });

  it('gives no link for names that are not codes or kinds without a page', () => {
    expect(priceLookup('stock', 'Türk Hava Yolları')).toBeUndefined();
    expect(priceLookup('other', 'ABC')).toBeUndefined();
  });
});

describe('priceAgeDays', () => {
  const h = { priceUpdatedAt: '2026-10-20T09:00:00.000Z' } as Holding;

  it('counts whole days since the price was entered', () => {
    expect(priceAgeDays(h, new Date('2026-10-28T10:00:00.000Z'))).toBe(8);
  });

  it('is undefined when no price was entered', () => {
    expect(priceAgeDays({} as Holding, new Date())).toBeUndefined();
  });
});
