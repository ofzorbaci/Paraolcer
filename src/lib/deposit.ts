import { daysBetween } from './cpi';
import type { Holding } from './types';

/**
 * Withholding on TRY deposit interest by term, per Presidential Decision 2025/66 (9 July 2025),
 * extended to 31.12.2026 by Decision 11444. Applies to accounts opened or renewed after July 2025.
 */
export const WITHHOLDING_VALID_UNTIL = '2026-12-31';

export function defaultWithholding(termDays: number): number {
  if (termDays <= 182) return 17.5;
  if (termDays <= 365) return 15;
  return 10;
}

/** Annual net simple rate after withholding, %. */
export function netAnnualRate(grossRate: number, withholding: number): number {
  return grossRate * (1 - withholding / 100);
}

/** Effective annual yield when the deposit rolls over every `termDays`, as a ratio. */
export function effectiveAnnualYield(netRate: number, termDays: number): number {
  return Math.pow(1 + (netRate / 100) * (termDays / 365), 365 / termDays) - 1;
}

/** Deposit value on `date`, compounding at each rollover. */
export function depositValue(h: Holding, date: string): number {
  const days = Math.max(0, daysBetween(h.buyDate, date));
  if (h.grossRate === undefined) {
    // v1 deposits: annual net rate compounded yearly
    return h.unitCost * Math.pow(1 + (h.depositRate ?? 0) / 100, days / 365);
  }
  const term = Math.max(1, h.termDays ?? 32);
  const net = netAnnualRate(h.grossRate, h.withholding ?? defaultWithholding(term));
  return h.unitCost * Math.pow(1 + (net / 100) * (term / 365), days / term);
}
