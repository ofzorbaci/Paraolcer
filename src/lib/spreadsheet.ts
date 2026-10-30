// Excel/CSV import and export. The template mirrors what Turkish users already know from other
// trackers ("İşlemler" + "Varlık Tipleri", dates as yyyy-aa-gg); the importer also recognises the
// usual column names of other apps' exports. Nothing is saved until the user confirms the preview.

import * as XLSX from 'xlsx';

import { parseAmount } from './format';
import { GOLD_LABELS, KIND_LABELS, type GoldType, type Holding, type HoldingKind } from './types';

export const SHEET = 'İşlemler';

export const COLUMNS = [
  'Tür',
  'Ad',
  'Alış tarihi',
  'Miktar',
  'Birim maliyet (TL)',
  'Güncel birim fiyat (TL)',
  'Brüt faiz (%)',
  'Vade (gün)',
  'Stopaj (%)',
  'Altın türü',
] as const;

type Field = 'kind' | 'name' | 'date' | 'quantity' | 'cost' | 'current' | 'gross' | 'term' | 'withholding' | 'gold' | 'side';

/** Header spellings we accept, normalised (lower case, no accents or punctuation). */
const HEADER_ALIASES: Record<Field, string[]> = {
  kind: ['tur', 'varlik turu', 'varlik tipi', 'tip', 'type', 'asset type'],
  name: ['ad', 'isim', 'varlik', 'sembol', 'hisse', 'kod', 'fon kodu', 'symbol', 'ticker', 'name'],
  date: ['alis tarihi', 'tarih', 'islem tarihi', 'date', 'baslangic tarihi'],
  quantity: ['miktar', 'adet', 'lot', 'quantity', 'shares', 'pay adedi'],
  cost: ['birim maliyet tl', 'birim maliyet', 'maliyet', 'alis fiyati', 'ortalama maliyet', 'fiyat', 'price', 'cost', 'tutar', 'anapara'],
  current: ['guncel birim fiyat tl', 'guncel fiyat', 'son fiyat', 'current price'],
  gross: ['brut faiz', 'brut faiz %', 'faiz', 'faiz orani', 'interest'],
  term: ['vade gun', 'vade', 'term'],
  withholding: ['stopaj', 'stopaj %'],
  gold: ['altin turu'],
  side: ['islem tipi', 'islem', 'alis satis', 'side'],
};

function normalise(s: unknown): string {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c]!)
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KIND_ALIASES: Record<string, HoldingKind> = {
  mevduat: 'deposit', 'tl mevduat': 'deposit', deposit: 'deposit', vadeli: 'deposit',
  dolar: 'usd', usd: 'usd', 'abd dolari': 'usd',
  euro: 'eur', eur: 'eur', avro: 'eur',
  altin: 'gold', 'gram altin': 'gold', gold: 'gold', ceyrek: 'gold', 'ceyrek altin': 'gold', yarim: 'gold',
  'yarim altin': 'gold', tam: 'gold', 'tam altin': 'gold', cumhuriyet: 'gold', 'cumhuriyet altini': 'gold',
  hisse: 'stock', 'hisse senedi': 'stock', bist: 'stock', stock: 'stock',
  fon: 'fund', 'yatirim fonu': 'fund', tefas: 'fund', fund: 'fund',
  diger: 'other', other: 'other',
};

const GOLD_ALIASES: Record<string, GoldType> = {
  gram: 'gram', 'gram altin': 'gram', ceyrek: 'ceyrek', 'ceyrek altin': 'ceyrek', yarim: 'yarim', 'yarim altin': 'yarim',
  tam: 'tam', 'tam altin': 'tam', cumhuriyet: 'cumhuriyet', 'cumhuriyet altini': 'cumhuriyet', ata: 'cumhuriyet',
};

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (v === undefined || v === null || String(v).trim() === '') return undefined;
  return parseAmount(String(v).replace('%', ''));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Excel serial numbers, yyyy-aa-gg, gg.aa.yyyy and gg/aa/yyyy. */
export function toISODateCell(v: unknown): string | undefined {
  if (typeof v === 'number' && v > 20_000 && v < 80_000) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : undefined;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return undefined;
}

export type ImportRow = { line: number; holding?: Holding; errors: string[] };

/** Maps a sheet (array of rows, first non-empty row = header) to holdings with per-row errors. */
export function rowsToHoldings(rows: unknown[][], today: string, id: () => string): ImportRow[] {
  const headerIndex = rows.findIndex((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''));
  if (headerIndex < 0) return [];
  const header = rows[headerIndex].map(normalise);
  const col: Partial<Record<Field, number>> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
    const i = header.findIndex((h) => aliases.includes(h));
    if (i >= 0) col[field] = i;
  }

  const out: ImportRow[] = [];
  rows.slice(headerIndex + 1).forEach((r, k) => {
    if (!Array.isArray(r) || r.every((c) => String(c ?? '').trim() === '')) return;
    const line = headerIndex + k + 2;
    const get = (f: Field) => (col[f] === undefined ? undefined : r[col[f]!]);
    const errors: string[] = [];

    const side = normalise(get('side'));
    if (side && /sat/.test(side)) {
      out.push({ line, errors: ['Satış satırı atlandı; Paraölçer şimdilik eldeki varlıkları takip ediyor.'] });
      return;
    }

    const rawKind = normalise(get('kind'));
    // Exports with a symbol but no type column (e.g. stock trackers) are stocks.
    const kind: HoldingKind | undefined = rawKind ? KIND_ALIASES[rawKind] : col.name !== undefined ? 'stock' : undefined;
    if (!kind) errors.push(`Tür anlaşılamadı: “${String(get('kind') ?? '')}”`);
    const goldType = kind === 'gold' ? (GOLD_ALIASES[normalise(get('gold'))] ?? GOLD_ALIASES[rawKind] ?? 'gram') : undefined;

    const buyDate = toISODateCell(get('date'));
    if (!buyDate) errors.push('Alış tarihi okunamadı (yyyy-aa-gg)');
    else if (buyDate > today || buyDate < '2005-01-01') errors.push('Alış tarihi 2005 ile bugün arasında olmalı');

    const cost = toNumber(get('cost'));
    if (!(cost && cost > 0)) errors.push('Birim maliyet ya da tutar sıfırdan büyük olmalı');
    const quantity = kind === 'deposit' ? 1 : toNumber(get('quantity'));
    if (!(quantity && quantity > 0)) errors.push('Miktar sıfırdan büyük olmalı');
    const gross = toNumber(get('gross'));
    const term = toNumber(get('term'));
    if (kind === 'deposit' && gross === undefined) errors.push('Mevduat için brüt faiz gerekli');

    if (errors.length || !kind || !buyDate || !cost || !quantity) {
      out.push({ line, errors });
      return;
    }
    const name = String(get('name') ?? '').trim() || (goldType ? GOLD_LABELS[goldType] : KIND_LABELS[kind]);
    out.push({
      line,
      errors: [],
      holding: {
        id: id(),
        kind,
        name: kind === 'stock' || kind === 'fund' ? name.toLocaleUpperCase('tr-TR') : name,
        buyDate,
        quantity,
        unitCost: cost,
        currentPrice: toNumber(get('current')),
        grossRate: kind === 'deposit' ? gross : undefined,
        termDays: kind === 'deposit' ? Math.round(term ?? 32) : undefined,
        withholding: kind === 'deposit' ? toNumber(get('withholding')) : undefined,
        goldType,
      },
    });
  });
  return out;
}

/** Reads an .xlsx/.xls/.csv file: the "İşlemler" sheet if present, else the first sheet. */
export function parseSpreadsheet(data: Uint8Array | string, today: string, id: () => string): ImportRow[] {
  const isText = typeof data === 'string';
  // Turkish CSV files are usually separated by semicolons because the comma is the decimal mark.
  const fs = isText && (data.split('\n')[0].match(/;/g)?.length ?? 0) > (data.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : undefined;
  // Text files are read raw, so "38,25" and "1.000" reach our Turkish-aware number parser intact.
  const wb = XLSX.read(data, { type: isText ? 'string' : 'array', cellDates: false, ...(isText && { raw: true }), ...(fs && { FS: fs }) });
  const ws = wb.Sheets[SHEET] ?? wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' });
  return rowsToHoldings(rows, today, id);
}

function holdingRow(h: Holding): (string | number)[] {
  return [
    h.goldType && h.goldType !== 'gram' ? 'Altın' : KIND_LABELS[h.kind],
    h.name,
    h.buyDate,
    h.quantity,
    h.unitCost,
    h.currentPrice ?? '',
    h.grossRate ?? '',
    h.termDays ?? '',
    h.withholding ?? '',
    h.goldType ? GOLD_LABELS[h.goldType] : '',
  ];
}

function typesSheet(): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet([
    ['Tür', 'Ne zaman', 'Not'],
    ['TL mevduat', 'Vadeli hesap', 'Miktar 1; Birim maliyet = anapara; Brüt faiz ve Vade gerekli; Stopaj boşsa vadeye göre otomatik'],
    ['Dolar', 'USD', 'Miktar = dolar; Birim maliyet = alış kuru'],
    ['Euro', 'EUR', 'Miktar = euro; Birim maliyet = alış kuru'],
    ['Altın', 'Gram ya da ziynet', 'Altın türü: Gram altın, Çeyrek altın, Yarım altın, Tam altın, Cumhuriyet altını'],
    ['Hisse', 'BIST', 'Ad = hisse kodu (THYAO); Güncel birim fiyat elle'],
    ['Fon', 'TEFAS', 'Ad = fon kodu (TTE); Güncel birim fiyat elle'],
    ['Diğer', 'Her şey', 'Güncel birim fiyat elle'],
    [],
    ['Tarihler yyyy-aa-gg biçiminde (2025-10-22). Ondalık için virgül ya da nokta kullanılabilir.'],
  ]);
}

function book(rows: (string | number)[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...COLUMNS], ...rows]), SHEET);
  XLSX.utils.book_append_sheet(wb, typesSheet(), 'Varlık Tipleri');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

/** Empty template with one example row the user overwrites. */
export function templateWorkbook(): Uint8Array {
  return book([['TL mevduat', 'Örnek mevduat (bu satırı sil)', '2025-10-22', 1, 100000, '', 42, 32, '', '']]);
}

/** Every holding, in the same columns the importer reads, so the file round-trips. */
export function exportWorkbook(holdings: Holding[]): Uint8Array {
  return book(holdings.filter((h) => !h.sample).map(holdingRow));
}
