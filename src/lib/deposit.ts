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

export function defaultWithholding(termDays: number): number {
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
