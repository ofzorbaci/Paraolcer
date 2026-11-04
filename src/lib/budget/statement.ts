// Bank or card statement import, read on the phone. Banks export CSV or Excel with a date, a
// description and either one signed amount or separate debit/credit columns; the header is found
// by its Turkish or English names, and the category is guessed from words in the description.

import * as XLSX from 'xlsx';

import type { Transaction } from './types';

type Col = 'date' | 'desc' | 'amount' | 'debit' | 'credit';

const HEADERS: Record<Col, string[]> = {
  date: ['tarih', 'islem tarihi', 'işlem tarihi', 'date', 'transaction date', 'valor', 'valor tarihi'],
  desc: ['aciklama', 'açıklama', 'islem aciklamasi', 'işlem açıklaması', 'description', 'detay', 'işlem', 'islem', 'merchant', 'işyeri', 'isyeri'],
  amount: ['tutar', 'islem tutari', 'işlem tutarı', 'amount', 'tutar tl', 'tutar (tl)'],
  debit: ['borc', 'borç', 'gider', 'debit', 'cikan', 'çıkan', 'harcama'],
  credit: ['alacak', 'gelir', 'credit', 'giren', 'yatan'],
};

/** Words in a description → budget category. First match wins, so specific names come first. */
const RULES: [RegExp, string][] = [
  [/maas|maaş|ucret odeme|ücret ödeme|salary|bordro/, 'salary'],
  [/kira/, 'rent'],
  [/netflix|spotify|youtube|disney|exxen|blutv|apple\.com|icloud|google \*|amazon prime|gain|tod/, 'subscriptions'],
  [/migros|a101|bim |bim$|şok|sok market|carrefour|file market|macrocenter|metro grossmarket|getir|market/, 'market'],
  [/yemeksepeti|trendyol yemek|restoran|restaurant|cafe|kafe|starbucks|kahve|burger|pizza|dominos|lokanta/, 'food'],
  [/shell|opet|petrol|bp |total|akaryakit|akaryakıt|istanbulkart|metro|uber|bitaksi|taksi|otopark|hgs|ogs|thy|pegasus|tcdd/, 'transport'],
  [/turkcell|vodafone|turk telekom|türk telekom|superonline|enerjisa|elektrik|dogalgaz|doğalgaz|igdas|igdaş|iski|aski|su idaresi|fatura|aidat/, 'bills'],
  [/eczane|hastane|klinik|medical|saglik|sağlık|dis hekim|diş hekim/, 'health'],
  [/okul|kurs|universite|üniversite|egitim|eğitim|kitap/, 'education'],
  [/sinema|tiyatro|konser|biletix|passo|oyun|steam|playstation/, 'fun'],
  [/kredi taksit|kredi odeme|kredi ödeme|kart odeme|kart ödeme|asgari/, 'credit'],
  [/trendyol|hepsiburada|amazon|n11|zara|lcw|koton|defacto|ikea|teknosa|mediamarkt/, 'shopping'],
];

const ASCII: Record<string, string> = { ı: 'i', ç: 'c', ğ: 'g', ö: 'o', ş: 's', ü: 'u' };

/** Lowercase without Turkish letters, so "MIGROS", "Migros" and "mıgros" all read "migros". */
function norm(s: unknown): string {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıçğöşü]/g, (c) => ASCII[c])
    .replace(/\s+/g, ' ')
    .trim();
}

export function guessCategory(description: string, income: boolean): string {
  const d = ` ${norm(description)} `;
  for (const [re, cat] of RULES) {
    if (!re.test(d)) continue;
    if (cat === 'salary') return income ? 'salary' : 'other-out';
    if (!income) return cat;
  }
  return income ? 'other-in' : 'other-out';
}

/** "1.234,56" / "-1234.56" / "1.234,56 TL" / "(45,00)" → signed number */
function amountOf(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  let s = String(v ?? '').replace(/[^\d,.\-()+]/g, '');
  if (!s) return undefined;
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()+-]/g, '');
  // The last separator is the decimal one when two kinds appear; a lone comma is decimal (Turkish).
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : undefined;
}

/** Excel serial, "31.10.2026", "31/10/2026", "2026-10-31" → "2026-10-31" */
function dateOf(v: unknown): string | undefined {
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : undefined;
  }
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
}

export type StatementRow = {
  line: number;
  date: string;
  description: string;
  /** signed TRY amount from the statement */
  amount: number;
  categoryId: string;
  /** the same date, amount and description already exist in the budget */
  duplicate: boolean;
};

/** Finds the header row (the first with a date column and an amount or debit/credit column). */
function findHeader(rows: unknown[][]): { index: number; col: Partial<Record<Col, number>> } | undefined {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const cells = (rows[i] ?? []).map(norm);
    const col: Partial<Record<Col, number>> = {};
    (Object.keys(HEADERS) as Col[]).forEach((k) => {
      const j = cells.findIndex((c) => HEADERS[k].some((h) => norm(h) === c));
      if (j >= 0) col[k] = j;
    });
    if (col.date !== undefined && (col.amount !== undefined || col.debit !== undefined || col.credit !== undefined)) return { index: i, col };
  }
  return undefined;
}

/**
 * Statement rows → candidate transactions. `cardStatement` flips the sign for card statements,
 * where purchases are listed as positive amounts.
 */
export function parseStatement(
  data: Uint8Array | string,
  existing: Pick<Transaction, 'date' | 'amount' | 'note'>[],
  cardStatement = false,
): StatementRow[] {
  const isText = typeof data === 'string';
  const first = isText ? data.split('\n')[0] : '';
  const fs = isText && (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : undefined;
  const wb = XLSX.read(data, { type: isText ? 'string' : 'array', ...(isText && { raw: true }), ...(fs && { FS: fs }) });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  const header = findHeader(rows);
  if (!header) throw new Error('Tarih ve tutar sütunları bulunamadı');
  const { index, col } = header;
  const seen = new Set(existing.map((t) => `${t.date}|${t.amount}|${norm(t.note)}`));
  const out: StatementRow[] = [];
  rows.slice(index + 1).forEach((r, k) => {
    const get = (c: Col) => (col[c] === undefined ? undefined : r?.[col[c]!]);
    const date = dateOf(get('date'));
    let amount = amountOf(get('amount'));
    if (amount === undefined) {
      const debit = amountOf(get('debit'));
      const credit = amountOf(get('credit'));
      amount = credit ? Math.abs(credit) : debit ? -Math.abs(debit) : undefined;
    } else if (cardStatement) {
      amount = -amount;
    }
    if (!date || !amount) return;
    const description = String(get('desc') ?? '').trim();
    const minor = Math.round(Math.abs(amount) * 100);
    out.push({
      line: index + k + 2,
      date,
      description,
      amount,
      categoryId: guessCategory(description, amount > 0),
      duplicate: seen.has(`${date}|${minor}|${norm(description)}`),
    });
  });
  return out;
}
