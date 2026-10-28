const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const tlPrecise = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function formatTL(n: number, precise = false): string {
  return (precise ? tlPrecise : tl).format(n);
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

/** Accepts "1.234,56", "1234,56" and "1234.56". */
export function parseAmount(text: string): number | undefined {
  let t = text.trim().replace(/\s|₺|TL/gi, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  return Number(t);
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
