import { describe, expect, it } from 'vitest';

import { exportWorkbook, parseSpreadsheet, rowsToHoldings, templateWorkbook, toISODateCell } from '../spreadsheet';
import type { Holding } from '../types';

let n = 0;
const id = () => `h${++n}`;
const today = '2026-10-29';

describe('dates', () => {
  it('reads Excel serials and the common text formats', () => {
    expect(toISODateCell(45952)).toBe('2025-10-22');
    expect(toISODateCell('2025-10-22')).toBe('2025-10-22');
    expect(toISODateCell('22.10.2025')).toBe('2025-10-22');
    expect(toISODateCell('5/3/2024')).toBe('2024-03-05');
    expect(toISODateCell('dün')).toBeUndefined();
  });
});

describe('import', () => {
  it('reads the template columns and flags bad rows without dropping good ones', () => {
    const rows = [
      ['Tür', 'Ad', 'Alış tarihi', 'Miktar', 'Birim maliyet (TL)', 'Güncel birim fiyat (TL)', 'Brüt faiz (%)', 'Vade (gün)', 'Stopaj (%)', 'Altın türü'],
      ['TL mevduat', 'Ziraat', '2025-10-22', '', '100.000', '', '42', '32', '', ''],
      ['Altın', '', '2026-01-10', 4, '9.500', '', '', '', '', 'Çeyrek altın'],
      ['Hisse', 'thyao', '2026-02-01', 100, '250,5', '260', '', '', '', ''],
      ['Kripto', 'BTC', '2026-02-01', 1, 100, '', '', '', '', ''],
      ['Dolar', '', '2030-01-01', 100, 40, '', '', '', '', ''],
    ];
    const r = rowsToHoldings(rows, today, id);
    expect(r.map((x) => !!x.holding)).toEqual([true, true, true, false, false]);
    expect(r[0].holding).toMatchObject({ kind: 'deposit', unitCost: 100000, quantity: 1, grossRate: 42, termDays: 32 });
    expect(r[1].holding).toMatchObject({ kind: 'gold', goldType: 'ceyrek', name: 'Çeyrek altın', quantity: 4 });
    expect(r[2].holding).toMatchObject({ kind: 'stock', name: 'THYAO', unitCost: 250.5, currentPrice: 260 });
    expect(r[3].errors[0]).toMatch(/Tür/);
    expect(r[4].errors[0]).toMatch(/bugün/);
    expect(r[4].line).toBe(6);
  });

  it('understands a stock tracker export without a type column and skips sells', () => {
    const rows = [
      ['Sembol', 'İşlem Tipi', 'Adet', 'Alış Fiyatı', 'Tarih'],
      ['ASELS', 'Alış', 50, 60.25, '15.03.2026'],
      ['ASELS', 'Satış', 10, 70, '01.06.2026'],
    ];
    const r = rowsToHoldings(rows, today, id);
    expect(r[0].holding).toMatchObject({ kind: 'stock', name: 'ASELS', quantity: 50, unitCost: 60.25, buyDate: '2026-03-15' });
    expect(r[1].holding).toBeUndefined();
    expect(r[1].errors[0]).toMatch(/Satış/);
  });

  it('reads semicolon CSV with decimal commas', () => {
    const csv = 'Tür;Ad;Alış tarihi;Miktar;Birim maliyet (TL)\nDolar;;2025-05-01;1.000;38,25\n';
    const [row] = parseSpreadsheet(csv, today, id);
    expect(row.holding).toMatchObject({ kind: 'usd', quantity: 1000, unitCost: 38.25 });
  });
});

describe('export', () => {
  it('round-trips through the importer and leaves out examples', () => {
    const holdings: Holding[] = [
      { id: 'a', kind: 'deposit', name: 'Mevduat', buyDate: '2025-10-22', quantity: 1, unitCost: 100000, grossRate: 42, termDays: 32, withholding: 17.5 },
      { id: 'b', kind: 'gold', goldType: 'tam', name: 'Tam altın', buyDate: '2026-01-10', quantity: 2, unitCost: 30000 },
      { id: 'c', kind: 'usd', name: 'Örnek', buyDate: '2025-01-10', quantity: 1, unitCost: 33, sample: true },
    ];
    const back = parseSpreadsheet(exportWorkbook(holdings), today, id).map((r) => r.holding);
    expect(back).toHaveLength(2);
    expect(back[0]).toMatchObject({ kind: 'deposit', grossRate: 42, termDays: 32, withholding: 17.5 });
    expect(back[1]).toMatchObject({ kind: 'gold', goldType: 'tam', quantity: 2 });
  });

  it('produces a template whose example row imports', () => {
    const rows = parseSpreadsheet(templateWorkbook(), today, id);
    expect(rows).toHaveLength(1);
    expect(rows[0].holding?.kind).toBe('deposit');
  });
});
