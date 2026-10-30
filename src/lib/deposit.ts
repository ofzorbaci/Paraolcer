import snapshot from '../data/feed-snapshot.json';

import { daysBetween } from './cpi';
import type { Feed } from './feed-types';
import type { Holding } from './types';

/**
 * Withholding on TRY deposit interest by term. The table comes from the data feed
 * (feed/withholding.json), so a new Presidential Decision needs no app release.
 */
let rules: Feed['withholding'] = snapshot.withholding as Feed['withholding'];

export function setWithholdingRules(next: Feed['withholding']) {
  rules = next;
}

export function withholdingRules(): Feed['withholding'] {
  return rules;
}

/** Withholding on interest from foreign-currency deposits, %. */
export const FX_WITHHOLDING = 25;

export function defaultWithholding(termDays: number, currency?: Holding['depositCurrency']): number {
  if (currency) return FX_WITHHOLDING;
  const tier = rules.tiers.find((t) => t.maxDays === null || termDays <= t.maxDays);
  return tier?.rate ?? rules.tiers[rules.tiers.length - 1].rate;
}

/** Annual net simple rate after withholding, %. */
export function netAnnualRate(grossRate: number, withholding: number): number {
  return grossRate * (1 - withholding / 100);
}

/** Effective annual yield when the deposit rolls over every `termDays`, as a ratio. */
export function effectiveAnnualYield(netRate: number, termDays: number): number {
  return Math.pow(1 + (netRate / 100) * (termDays / 365), 365 / termDays) - 1;
}

/** A deposit in Turkish lira (the yardsticks "Yenilesem mi?" and the scenarios are built on). */
export function isTlDeposit(h: Holding): boolean {
  return h.kind === 'deposit' && !h.depositCurrency;
}

/** How much the deposit has grown by `date`, compounding at each rollover; 1.1 means +10%. */
export function depositGrowth(h: Holding, date: string): number {
  const days = Math.max(0, daysBetween(h.buyDate, date));
  if (h.grossRate === undefined) {
    // v1 deposits: annual net rate compounded yearly
    return Math.pow(1 + (h.depositRate ?? 0) / 100, days / 365);
  }
  const term = Math.max(1, h.termDays ?? 32);
  const net = netAnnualRate(h.grossRate, h.withholding ?? defaultWithholding(term, h.depositCurrency));
  return Math.pow(1 + (net / 100) * (term / 365), days / term);
}

/**
 * Deposit value in TRY on `date`. A foreign-currency deposit is converted at `fxRate` (TRY per
 * unit on that day; the deposit-day rate if not given).
 */
export function depositValue(h: Holding, date: string, fxRate = h.unitCost): number {
  const growth = depositGrowth(h, date);
  return h.depositCurrency ? h.quantity * fxRate * growth : h.unitCost * growth;
}

/** One term's interest the way banks print it: gross interest, withholding and net, rounded to kuruş. */
export function termInterest(principal: number, grossRate: number, termDays: number, withholding: number) {
  const round = (x: number) => Math.round(x * 100) / 100;
  const gross = round((principal * grossRate * termDays) / 36500);
  const tax = round((gross * withholding) / 100);
  return { gross, tax, net: round(gross - tax) };
}
