import { describe, expect, it } from 'vitest';

import { closeLabel, fundBookStale, fundLatestUrl, fundSourceLine, parseFundLatest } from '../funds';
import { feedQuote, setFundBook } from '../securities';

const latest = {
  schema: 1,
  source: 'TEFAS',
  updatedAt: '2026-11-11T05:31:02+00:00',
  funds: [
    { code: 'AAK', name: 'ATA PORTFÖY ÇOKLU VARLIK DEĞİŞKEN FON', kind: 'YAT', price: 41.25, date: '2026-11-10', aum: 1e8, investors: 1200, returns: { m1: 0.03 } },
    { code: 'tte', name: 'İŞ PORTFÖY BIST TEKNOLOJİ', kind: 'YAT', price: 2.5, date: '2026-11-10', aum: null, investors: null, returns: {} },
    { code: 'BAD', price: 0, date: '2026-11-10' },
  ],
};

describe('TEFAS fund book', () => {
  it('parses latest.json and keys funds by uppercase code', () => {
    const book = parseFundLatest(latest)!;
    expect(book.source).toBe('TEFAS');
    expect(Object.keys(book.funds).sort()).toEqual(['AAK', 'TTE']);
    expect(book.funds.AAK.returns.m1).toBe(0.03);
  });

  it('rejects another schema or an empty list', () => {
    expect(parseFundLatest({ ...latest, schema: 2 })).toBeUndefined();
    expect(parseFundLatest({ ...latest, funds: [] })).toBeUndefined();
    expect(parseFundLatest(null)).toBeUndefined();
  });

  it('says how old a price is instead of calling it today’s', () => {
    expect(closeLabel('2026-11-10', '2026-11-11')).toBe('Dünkü kapanış · 10 Kasım');
    expect(closeLabel('2026-11-11', '2026-11-11')).toBe('Bugünkü fiyat · 11 Kasım');
    expect(closeLabel('2026-11-06', '2026-11-09')).toBe('Son kapanış · 6 Kasım');
    expect(fundSourceLine({ date: '2026-11-10' }, 'TEFAS', '2026-11-11')).toBe('TEFAS · Dünkü kapanış · 10 Kasım');
  });

  it('downloads at most once per calendar day, from the file next to feed.json', () => {
    expect(fundBookStale(undefined, '2026-11-11')).toBe(true);
    expect(fundBookStale('2026-11-10T20:00:00.000Z', '2026-11-11')).toBe(true);
    expect(fundBookStale('2026-11-11T06:00:00.000Z', '2026-11-11')).toBe(false);
    expect(fundLatestUrl('https://ofzorbaci.github.io/Paraolcer/feed.json')).toBe('https://ofzorbaci.github.io/Paraolcer/funds/latest.json');
  });

  it('prices a fund holding from the TEFAS book, matched by its code', () => {
    setFundBook(parseFundLatest(latest));
    expect(feedQuote({ kind: 'fund', name: 'aak' })).toMatchObject({ price: 41.25, date: '2026-11-10', source: 'TEFAS' });
    expect(feedQuote({ kind: 'fund', name: 'XYZ' })).toBeUndefined();
    setFundBook(undefined);
  });
});

describe('price on the purchase day', () => {
  it('reads a month file and falls back to the last trading day before the date', async () => {
    const { parseFundMonth, priceOnDate, previousMonth, fundMonthUrl } = await import('../funds');
    const month = parseFundMonth({
      schema: 1,
      source: 'TEFAS',
      month: '2025-10',
      dates: ['2025-10-01', '2025-10-02', '2025-10-03', '2025-10-06'],
      prices: { AAL: [2.6, 2.61, null, 2.63] },
    })!;
    expect(priceOnDate(month, 'aal', '2025-10-02')).toEqual({ price: 2.61, date: '2025-10-02' });
    // Saturday the 4th → Thursday the 2nd (Friday had no price)
    expect(priceOnDate(month, 'AAL', '2025-10-04')).toEqual({ price: 2.61, date: '2025-10-02' });
    expect(priceOnDate(month, 'AAL', '2025-09-30')).toBeUndefined();
    expect(priceOnDate(month, 'XYZ', '2025-10-02')).toBeUndefined();
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(fundMonthUrl('https://ofzorbaci.github.io/Paraolcer/feed.json', '2025-10')).toBe(
      'https://ofzorbaci.github.io/Paraolcer/funds/daily/2025-10.json',
    );
    expect(parseFundMonth({ schema: 2 })).toBeUndefined();
  });
});

describe('US closes on the purchase day', () => {
  it('reads the US month file per group', async () => {
    const { parseUsMonth, usGroup, priceOnDate, usMonthUrl } = await import('../funds');
    const m = parseUsMonth({
      schema: 1,
      month: '2025-10',
      dates: ['2025-10-09', '2025-10-10'],
      stocks: { SPY: [670.1, 668.5] },
      crypto: { BTC: [121000, null] },
    })!;
    expect(priceOnDate(usGroup(m, false), 'spy', '2025-10-11')).toEqual({ price: 668.5, date: '2025-10-10' });
    expect(priceOnDate(usGroup(m, true), 'BTC', '2025-10-10')).toEqual({ price: 121000, date: '2025-10-09' });
    expect(priceOnDate(usGroup(m, true), 'SPY', '2025-10-10')).toBeUndefined();
    expect(usMonthUrl('https://x.io/P/feed.json', '2025-10')).toBe('https://x.io/P/us/daily/2025-10.json');
  });
});
