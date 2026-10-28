import { defaultWithholding, effectiveAnnualYield, netAnnualRate } from './deposit';
import type { Holding } from './types';

export type DepositTerms = { grossRate: number; termDays: number; withholding: number; fromPortfolio: boolean };

/** Example used when the user has no deposits yet. */
export const EXAMPLE_DEPOSIT = { grossRate: 40, termDays: 32 };

/** The user's deposit terms, weighted by principal; falls back to the example deposit. */
export function depositTerms(holdings: Holding[]): DepositTerms {
  const deposits = holdings.filter((h) => h.kind === 'deposit' && h.grossRate !== undefined);
  if (deposits.length === 0) {
    const { grossRate, termDays } = EXAMPLE_DEPOSIT;
    return { grossRate, termDays, withholding: defaultWithholding(termDays), fromPortfolio: false };
  }
  const total = deposits.reduce((a, h) => a + h.unitCost, 0);
  const avg = (f: (h: Holding) => number) => deposits.reduce((a, h) => a + f(h) * h.unitCost, 0) / total;
  const termDays = Math.round(avg((h) => h.termDays ?? 32));
  return {
    grossRate: avg((h) => h.grossRate!),
    termDays,
    withholding: avg((h) => h.withholding ?? defaultWithholding(h.termDays ?? 32)),
    fromPortfolio: true,
  };
}

/** Real return over the next 12 months if inflation turns out to be `annualCpi` %. */
export function scenarioReal(terms: DepositTerms, annualCpi: number): number {
  const nominal = effectiveAnnualYield(netAnnualRate(terms.grossRate, terms.withholding), terms.termDays);
  return (1 + nominal) / (1 + annualCpi / 100) - 1;
}
