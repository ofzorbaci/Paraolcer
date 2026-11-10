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
