import { describe, expect, it } from 'vitest';

import { guessCategory, parseStatement } from '../budget/statement';

describe('statement import', () => {
  it('reads a Turkish CSV with one signed amount column', () => {
    const csv = [
      'Hesap Hareketleri',
      'Tarih;Açıklama;Tutar;Bakiye',
      '01.10.2026;MAAŞ ÖDEMESİ ACME AŞ;45.000,00;52.000,00',
      '03.10.2026;MIGROS KADIKOY;-1.234,56;50.765,44',
      '05.10.2026;KIRA EKIM;-20.000,00;30.765,44',
      '06.10.2026;NETFLIX.COM;-229,99;30.535,45',
      ';;;',
    ].join('\n');
    const rows = parseStatement(csv, []);
    expect(rows.map((r) => [r.date, r.amount, r.categoryId])).toEqual([
      ['2026-10-01', 45000, 'salary'],
      ['2026-10-03', -1234.56, 'market'],
      ['2026-10-05', -20000, 'rent'],
      ['2026-10-06', -229.99, 'subscriptions'],
    ]);
  });

  it('reads separate debit and credit columns', () => {
    const csv = 'Date,Description,Debit,Credit\n2026-10-10,SHELL ISTANBUL,850.50,\n2026-10-11,REFUND,,100\n';
    const rows = parseStatement(csv, []);
    expect(rows.map((r) => [r.amount, r.categoryId])).toEqual([
      [-850.5, 'transport'],
      [100, 'other-in'],
    ]);
  });

  it('flips card statements, where purchases are positive', () => {
    const rows = parseStatement('Tarih;İşlem;Tutar\n12.10.2026;TRENDYOL;499,90\n', [], true);
    expect(rows[0].amount).toBe(-499.9);
    expect(rows[0].categoryId).toBe('shopping');
  });

  it('marks rows already in the budget as duplicates', () => {
    const csv = 'Tarih;Açıklama;Tutar\n03.10.2026;MIGROS KADIKOY;-1.234,56\n';
    const rows = parseStatement(csv, [{ date: '2026-10-03', amount: 123456, note: 'MIGROS KADIKOY' }]);
    expect(rows[0].duplicate).toBe(true);
  });

  it('fails clearly without date and amount columns', () => {
    expect(() => parseStatement('a;b\n1;2\n', [])).toThrow(/sütun/);
  });

  it('does not treat an outgoing transfer named "maaş" as salary', () => {
    expect(guessCategory('MAAS AVANSI IADE', false)).toBe('other-out');
  });
});

describe('PDF statement lines', () => {
  it('takes the date, the description and the first amount, not the balance', async () => {
    const { parseStatementLines } = await import('../budget/statement');
    const lines = [
      'HESAP HAREKETLERİ',
      'Tarih Açıklama Tutar Bakiye',
      '01.10.2026 MAAŞ ÖDEMESİ ACME AŞ 45.000,00 52.000,00',
      '03.10.2026 14:22 MIGROS KADIKOY -1.234,56 50.765,44',
      '05/10/2026 KIRA EKIM 20.000,00 B 30.765,44',
      '06.10.2026 Önceki bakiye 30.000,00',
      '07.10.2026 IZMIR 35 SUBE OPET 850,50 TL',
    ];
    const rows = parseStatementLines(lines, []);
    expect(rows.map((r) => [r.date, r.description, r.amount, r.categoryId])).toEqual([
      ['2026-10-01', 'MAAŞ ÖDEMESİ ACME AŞ', 45000, 'salary'],
      ['2026-10-03', 'MIGROS KADIKOY', -1234.56, 'market'],
      ['2026-10-05', 'KIRA EKIM', -20000, 'rent'],
      ['2026-10-07', 'IZMIR 35 SUBE OPET', 850.5, 'other-in'],
    ]);
  });

  it('reads card statements, where purchases have no sign', async () => {
    const { parseStatementLines } = await import('../budget/statement');
    const rows = parseStatementLines(['12.10.2026 TRENDYOL 499,90', '15.10.2026 ODEME - TESEKKURLER +5.000,00'], [], true);
    expect(rows.map((r) => r.amount)).toEqual([-499.9, 5000]);
  });
});
