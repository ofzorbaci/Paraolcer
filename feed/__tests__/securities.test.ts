import { describe, expect, it } from 'vitest';

import { mergeSecurityPrices, parseSecurityPrices, securitiesConfig } from '../securities';

const today = '2026-11-03';

describe('provider formats', () => {
  it('reads Turkish CSV with semicolons and decimal commas', () => {
    const csv = 'Fon Kodu;Fiyat;Tarih\nTTE;1,234567;31.10.2026\nAFT;"12,50";31.10.2026\n;5;31.10.2026\n';
    expect(parseSecurityPrices(csv, today)).toEqual({
      TTE: { price: 1.234567, date: '2026-10-31' },
      AFT: { price: 12.5, date: '2026-10-31' },
    });
  });

  it('reads an English CSV with comma separators', () => {
    const csv = 'symbol,close,date\nTHYAO,312.75,2026-10-31\nasels,98.1,2026-10-31\n';
    expect(parseSecurityPrices(csv, today)).toEqual({
      THYAO: { price: 312.75, date: '2026-10-31' },
      ASELS: { price: 98.1, date: '2026-10-31' },
    });
  });

  it('reads JSON arrays, wrapped arrays and objects keyed by code', () => {
    expect(parseSecurityPrices('[{"code":"TTE","price":1.5,"date":"2026-10-31"}]', today).TTE.price).toBe(1.5);
    expect(parseSecurityPrices('{"data":[{"ticker":"GARAN","last":"141,2"}]}', today).GARAN).toEqual({ price: 141.2, date: today });
    expect(parseSecurityPrices('{"TTE":1.5,"AFT":{"price":12,"date":"2026-10-30"}}', today)).toEqual({
      TTE: { price: 1.5, date: today },
      AFT: { price: 12, date: '2026-10-30' },
    });
  });

  it('skips rows without a code or a positive price', () => {
    expect(parseSecurityPrices('code,price\nTTE,0\nTOO-LONG-CODE,5\nAFT,abc\n', today)).toEqual({});
  });
});

describe('validation', () => {
  it('keeps the previous price when a code jumps more than 60%', () => {
    const { prices, warnings } = mergeSecurityPrices(
      { THYAO: { price: 900, date: '2026-10-31' }, ASELS: { price: 100, date: '2026-10-31' } },
      { THYAO: { price: 300, date: '2026-10-30' }, ASELS: { price: 95, date: '2026-10-30' } },
      today,
    );
    expect(prices.THYAO.price).toBe(300);
    expect(prices.ASELS.price).toBe(100);
    expect(warnings).toEqual(['THYAO: 300 → 900']);
  });

  it('drops prices older than ten days or dated in the future', () => {
    const { prices } = mergeSecurityPrices(
      { OLD: { price: 1, date: '2026-10-01' }, FUTURE: { price: 1, date: '2026-12-01' }, NEW: { price: 1, date: '2026-11-02' } },
      { GONE: { price: 1, date: '2026-10-02' }, KEPT: { price: 2, date: '2026-10-30' } },
      today,
    );
    expect(Object.keys(prices).sort()).toEqual(['KEPT', 'NEW']);
  });

  it('is configured only when a price list address is set', () => {
    expect(securitiesConfig({})).toBeUndefined();
    expect(securitiesConfig({ SECURITIES_API_KEY: 'x' })).toBeUndefined();
    expect(securitiesConfig({ SECURITIES_FUNDS_URL: 'https://example.com/f.csv', SECURITIES_SOURCE: 'Sağlayıcı' })?.source).toBe('Sağlayıcı');
  });
});
