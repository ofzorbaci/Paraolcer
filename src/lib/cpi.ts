import type { CpiRow } from './cpi-parse';
import type { Settings } from './types';

export type CpiIndex = {
  /** 'YYYY-MM' → index level at the end of that month */
  levels: Map<string, number>;
  first: string;
  last: string;
};

export type InflationResult = {
  /** price level multiplier between the two dates; 1.3 means prices rose 30% */
  factor: number;
  fromMonth: string;
  toMonth: string;
  /** false when the period reaches past the latest published CPI month */
  complete: boolean;
};

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** Chains monthly changes into an index. The month before the first row is 100. */
export function buildCpiIndex(rows: CpiRow[]): CpiIndex {
  const levels = new Map<string, number>();
  let level = 100;
  for (const row of rows) {
    level *= 1 + row.mom / 100;
    levels.set(row.month, level);
  }
  return { levels, first: rows[0].month, last: rows[rows.length - 1].month };
}

/**
 * Inflation from the purchase month to the latest published month, the same
 * convention as TÜİK's own calculator (index of month A → index of month B).
 */
export function tuikInflation(index: CpiIndex, fromDate: string, toDate: string): InflationResult {
  let fromMonth = monthOf(fromDate);
  let toMonth = monthOf(toDate);
  if (fromMonth < index.first) fromMonth = index.first;
  const complete = toMonth <= index.last;
  if (!complete) toMonth = index.last;
  if (fromMonth >= toMonth) return { factor: 1, fromMonth, toMonth: fromMonth, complete };
  const factor = index.levels.get(toMonth)! / index.levels.get(fromMonth)!;
  return { factor, fromMonth, toMonth, complete };
}

/** Compounds a fixed annual rate (ENAG or personal) over the elapsed days. */
export function customInflation(annualRate: number, fromDate: string, toDate: string): InflationResult {
  const days = Math.max(0, daysBetween(fromDate, toDate));
  const factor = Math.pow(1 + annualRate / 100, days / 365);
  return { factor, fromMonth: monthOf(fromDate), toMonth: monthOf(toDate), complete: true };
}

export function inflationFor(
  settings: Settings,
  index: CpiIndex,
  fromDate: string,
  toDate: string,
): InflationResult {
  return settings.inflationSource === 'custom'
    ? customInflation(settings.customAnnualRate, fromDate, toDate)
    : tuikInflation(index, fromDate, toDate);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}
