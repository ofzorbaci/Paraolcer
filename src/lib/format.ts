const pct = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

let masked = false;

/** "Hide amounts": every TRY figure prints as dots; percentages stay visible. */
export function setAmountsMasked(on: boolean) {
  masked = on;
}

/** Groups thousands with dots, Turkish style: 1234567.5 → "1.234.567,5". Independent of the JS engine's Intl data. */
export function groupThousands(n: number, maxDecimals = 0): string {
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(Math.abs(n) * factor) / factor;
  const [int, dec] = rounded.toFixed(maxDecimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals = dec?.replace(/0+$/, '');
  return `${n < 0 && rounded !== 0 ? '-' : ''}${grouped}${decimals ? `,${decimals}` : ''}`;
}

export function formatTL(n: number, precise = false): string {
  if (masked) return '₺•••••';
  const s = groupThousands(n, precise ? 2 : 0);
  return s.startsWith('-') ? `-₺${s.slice(1)}` : `₺${s}`;
}

/**
 * What a money field shows while typing: dots every three digits, a comma for kuruş.
 * "1000000" → "1.000.000", "1234,5" → "1.234,5". While typing, dots are always our own separators
 * (deleting a digit from "1.000" gives "100"); a prefilled "38.25" keeps its decimal.
 */
export function formatMoneyInput(text: string, typed = false): string {
  let t = text.replace(/[^\d.,]/g, '');
  // Our grouping never ends in a dot, so a trailing dot is the user's decimal key (English keyboards).
  if (typed && t.endsWith('.') && !t.includes(',')) t = `${t.slice(0, -1)},`;
  // In a prefilled value, a dot followed by one or two digits at the end is a decimal point.
  if (!typed && !t.includes(',') && /\.\d{1,2}$/.test(t) && !/^\d{1,3}(\.\d{3})+$/.test(t)) {
    const i = t.lastIndexOf('.');
    t = `${t.slice(0, i)},${t.slice(i + 1)}`;
  }
  const comma = t.indexOf(',');
  const intPart = (comma >= 0 ? t.slice(0, comma) : t).replace(/\D/g, '');
  const decPart = comma >= 0 ? t.slice(comma + 1).replace(/\D/g, '').slice(0, 2) : undefined;
  const int = intPart.replace(/^0+(?=\d)/, '');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart === undefined ? grouped : `${grouped || '0'},${decPart}`;
}

/** 0.123 → "+%12,3" */
export function formatPct(ratio: number, signed = true): string {
  const value = ratio * 100;
  const sign = signed && value > 0.05 ? '+' : value < -0.05 ? '−' : '';
  return `${sign}%${pct.format(Math.abs(value))}`;
}

/** 'YYYY-MM-DD' → 'GG.AA.YYYY' */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** 'YYYY-MM' → 'Eylül 2026' */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** 'YYYY-MM-DD' → '22 Ekim 2025' */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const STAMP = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** ISO time → '28 Eki 14:32' */
export function formatStamp(iso: string): string {
  return STAMP.format(new Date(iso));
}

/** Local calendar date of a Date as 'YYYY-MM-DD'. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 40 → "%40,0", for rates that are not returns */
export function formatRate(percent: number): string {
  return `%${pct.format(percent)}`;
}

/** 'GG.AA.YYYY' → 'YYYY-MM-DD', or undefined if it is not a real past-or-today date. */
export function parseDate(text: string, today: string): string | undefined {
  const match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text.trim());
  if (!match) return undefined;
  const [, d, m, y] = match;
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return undefined;
  if (iso > today || iso < '2005-01-01') return undefined;
  return iso;
}

/** Accepts "1.234,56", "1234,56", "1234.56" and Turkish thousands like "100.000". */
export function parseAmount(text: string): number | undefined {
  let t = text.trim().replace(/\s|₺|TL/gi, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  // "100.000" and "1.250.000" are Turkish thousands, not decimals.
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  return Number(t);
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
