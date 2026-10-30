// Maturity day, looking forward: "if you roll over at this rate, the expected real return over
// the next 12 months" — the rate compounded at each rollover after withholding, against the
// 12-month inflation expectation (Fisher). It describes an expectation; it never recommends.

import { daysBetween, inflationFor, type CpiIndex } from './cpi';
import { defaultWithholding, depositValue, isTlDeposit, netAnnualRate } from './deposit';
import type { Feed } from './feed-types';
import type { RenewResult } from './renew';
import { scenarioReal } from './scenario';
import type { Holding, Settings } from './types';

/** The published average rate for a term, or undefined when the feed has none. */
export function averageRateFor(rates: Feed['depositRates'], termDays: number): number | undefined {
  return rates?.byTerm.find((t) => t.maxDays === null || termDays <= t.maxDays)?.rate;
}

/** Expected real return over 12 months when rolling over at `grossRate`. */
export function forwardReal(grossRate: number, termDays: number, withholding: number | undefined, expectedCpi: number): number {
  const term = Math.max(1, termDays);
  return scenarioReal({ grossRate, termDays: term, withholding: withholding ?? defaultWithholding(term), fromPortfolio: true }, expectedCpi);
}

/** Real return of the last completed term, or undefined before the first rollover. */
export function lastTermReal(h: Holding, today: string, settings: Settings, index: CpiIndex): number | undefined {
  if (!isTlDeposit(h) || h.grossRate === undefined || !h.termDays) return undefined;
  const done = Math.floor(Math.max(0, daysBetween(h.buyDate, today)) / h.termDays);
  if (done < 1) return undefined;
  const at = (n: number) => {
    const d = new Date(`${h.buyDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n * h.termDays!);
    return d.toISOString().slice(0, 10);
  };
  const start = at(done - 1);
  const end = at(done);
  const net = netAnnualRate(h.grossRate, h.withholding ?? defaultWithholding(h.termDays));
  const growth = 1 + (net / 100) * (h.termDays / 365);
  return growth / inflationFor(settings, index, start, end).factor - 1;
}

/** Options from best to worst real return: what a free user sees, without numbers. */
export function renewRanking(result: RenewResult): RenewResult['options'] {
  return [...result.options].sort((a, b) => b.real - a.real);
}

/** Each option's real gain on the deposit's current value, in today's lira. */
export function liraOutcomes(result: RenewResult, h: Holding, today: string): { key: string; lira: number }[] {
  const amount = depositValue(h, today);
  return result.options.map((o) => ({ key: o.key, lira: amount * o.real }));
}

/** The lira gap between the best and the worst option: what the screen showed the user. */
export function liraSpread(result: RenewResult, h: Holding, today: string): number {
  const xs = liraOutcomes(result, h, today).map((x) => x.lira);
  return xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : 0;
}
