import { describe, expect, it } from 'vitest';

import { parseBlsCpi, parseNagerHolidays, parseWorldBankInflation } from '../extras';
import { buildUsQuotes, parseAlphaCrypto, parseAlphaStock, parseFinnhubQuote } from '../us-quotes';

describe('Nager.Date holidays', () => {
  it('keeps nationwide days, sorted, with the Turkish name', () => {
    const list = Array.from({ length: 9 }, (_, i) => ({ date: `2026-0${(i % 9) + 1}-15`, localName: `Gün ${i}`, global: true }));
    list.push({ date: '2026-03-20', localName: 'Ramazan Bayramı 1. Gün', global: true });
    list.push({ date: '2026-05-05', localName: 'Bölgesel', global: false });
    const out = parseNagerHolidays(list);
    expect(out.find((h) => h.date === '2026-03-20')?.name).toBe('Ramazan Bayramı 1. Gün');
    expect(out.some((h) => h.name === 'Bölgesel')).toBe(false);
    expect(out.map((h) => h.date)).toEqual([...out.map((h) => h.date)].sort());
  });

  it('rejects a short or broken answer', () => {
    expect(() => parseNagerHolidays([{ date: '2026-01-01', localName: 'Yılbaşı' }])).toThrow();
    expect(() => parseNagerHolidays({})).toThrow();
  });
});

describe('World Bank inflation', () => {
  const body = [
    { page: 1 },
    [
      { countryiso3code: 'DEU', date: '2025', value: 2.1717 },
      { countryiso3code: 'TUR', date: '2025', value: 34.88 },
      { countryiso3code: 'ARG', date: '2024', value: 219.88 },
      { countryiso3code: 'XXX', date: '2025', value: 5 },
      { countryiso3code: 'USA', date: '2025', value: null },
    ],
  ];

  it('names countries in Turkish, rounds to one decimal and keeps the country order', () => {
    expect(parseWorldBankInflation(body)).toEqual([
      { code: 'TUR', name: 'Türkiye', year: '2025', value: 34.9 },
      { code: 'ARG', name: 'Arjantin', year: '2024', value: 219.9 },
      { code: 'DEU', name: 'Almanya', year: '2025', value: 2.2 },
    ]);
  });

  it('needs Türkiye', () => {
    expect(() => parseWorldBankInflation([{}, [{ countryiso3code: 'DEU', date: '2025', value: 2 }]])).toThrow();
  });
});

describe('BLS CPI', () => {
  it('reads monthly values oldest first and skips annual averages', () => {
    const data = [];
    for (let y = 2024; y <= 2025; y++) for (let m = 1; m <= 12; m++) data.push({ year: String(y), period: `M${String(m).padStart(2, '0')}`, value: String(300 + m) });
    data.push({ year: '2025', period: 'M13', value: '999' });
    const rows = parseBlsCpi({ status: 'REQUEST_SUCCEEDED', Results: { series: [{ data: data.reverse() }] } });
    expect(rows).toHaveLength(24);
    expect(rows[0]).toEqual({ month: '2024-01', value: 301 });
    expect(rows.at(-1)).toEqual({ month: '2025-12', value: 312 });
  });
});

describe('US quotes', () => {
  it('parses Finnhub and Alpha Vantage answers', () => {
    expect(parseFinnhubQuote({ c: 227.5, t: 1794268800 })).toEqual({ price: 227.5, date: '2026-11-10' });
    expect(parseFinnhubQuote({ c: 0, t: 0 })).toBeUndefined();
    expect(parseAlphaStock({ 'Global Quote': { '05. price': '512.30', '07. latest trading day': '2026-11-07' } })).toEqual({
      price: 512.3,
      date: '2026-11-07',
    });
    expect(parseAlphaStock({ Information: 'rate limit' })).toBeUndefined();
    expect(
      parseAlphaCrypto({ 'Realtime Currency Exchange Rate': { '5. Exchange Rate': '72900.1', '6. Last Refreshed': '2026-11-10 08:00:01' } }),
    ).toEqual({ price: 72900.1, date: '2026-11-10' });
  });

  it('keeps the previous price of a symbol that fails and prices stablecoins at $1', async () => {
    const universe = { stocks: { AAPL: 'Apple' }, etfs: { SPY: 'SPDR S&P 500' }, crypto: { USDT: 'Tether' } };
    const previous = { stocks: { AAPL: { price: 200, date: '2026-11-01', name: 'Apple' } }, crypto: {} };
    // No keys: nothing is fetched, the old price stays, SPY is reported missing.
    const out = await buildUsQuotes(universe, previous, { today: '2026-11-10', delayMs: 0 });
    expect(out.stocks.AAPL.price).toBe(200);
    expect(out.crypto.USDT).toEqual({ price: 1, date: '2026-11-10', name: 'Tether' });
    expect(out.missing).toEqual(['AAPL', 'SPY']);
  });
});
