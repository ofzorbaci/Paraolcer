// "Yenilesem mi?" — at a deposit's maturity, what the same money would have done over the last
// 1, 3 and 12 months: rolled over at the same terms, held in dollars, or held in gold, all
// measured against the same inflation. It describes the past; it never recommends.

import { daysBetween, inflationFor, monthOf, type CpiIndex } from './cpi';
import { defaultWithholding, isTlDeposit, netAnnualRate } from './deposit';
import type { Feed } from './feed-types';
import { GRAMS_PER_TROY_OUNCE } from './gold';
import { addMonths } from './series';
import type { Holding, LivePrices, Settings } from './types';

export const RENEW_WINDOWS = [1, 3, 12] as const;
export type RenewWindow = (typeof RENEW_WINDOWS)[number];

export type RenewOption = { key: 'deposit' | 'usd' | 'gold'; label: string; nominal: number; real: number };

export type RenewResult = {
  from: string;
  /** price level change over the window, ratio */
  inflation: number;
  options: RenewOption[];
};

type Series = { month: string; value: number }[];

/** Value for `month`, or the latest earlier one. */
export function valueAt(series: Series, month: string): number | undefined {
  let found: number | undefined;
  for (const p of series) {
    if (p.month <= month) found = p.value;
    else break;
  }
  return found;
}

/** The next rollover on or after `today`, for a deposit with a term. */
export function nextMaturity(h: Holding, today: string): string | undefined {
  if (h.kind !== 'deposit' || !h.termDays) return undefined;
  const elapsed = Math.max(0, daysBetween(h.buyDate, today));
  const periods = Math.ceil(elapsed / h.termDays) || 1;
  const d = new Date(`${h.buyDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + periods * h.termDays);
  return d.toISOString().slice(0, 10);
}

export function renewComparison(
  h: Holding,
  months: RenewWindow,
  today: string,
  prices: LivePrices,
  markets: Feed['markets'],
  settings: Settings,
  index: CpiIndex,
): RenewResult | undefined {
  if (!isTlDeposit(h) || h.grossRate === undefined) return undefined;
  const startMonth = addMonths(monthOf(today), -months);
  const from = `${startMonth}-01`;
  const inflation = inflationFor(settings, index, from, today).factor;
  const real = (growth: number) => growth / inflation - 1;

  const term = Math.max(1, h.termDays ?? 32);
  const net = netAnnualRate(h.grossRate, h.withholding ?? defaultWithholding(term));
  const depositGrowth = Math.pow(1 + (net / 100) * (term / 365), daysBetween(from, today) / term);
  const options: RenewOption[] = [
    { key: 'deposit', label: 'Aynı koşullarla yenileseydin', nominal: depositGrowth - 1, real: real(depositGrowth) },
  ];

  // The month before the window is the closest month-end to its first day.
  const before = addMonths(startMonth, -1);
  const usdThen = markets && valueAt(markets.usdTry, before);
  const usdNow = prices.usd ?? (markets && valueAt(markets.usdTry, monthOf(today)));
  if (usdThen && usdNow) {
    const g = usdNow / usdThen;
    options.push({ key: 'usd', label: 'Dolarda tutsaydın', nominal: g - 1, real: real(g) });
  }

  const ozThen = markets && valueAt(markets.goldUsdOz, before);
  const goldThen = ozThen && usdThen ? (ozThen / GRAMS_PER_TROY_OUNCE) * usdThen : undefined;
  if (goldThen && prices.gold) {
    const g = prices.gold / goldThen;
    options.push({ key: 'gold', label: 'Gram altında tutsaydın', nominal: g - 1, real: real(g) });
  }

  return { from, inflation: inflation - 1, options };
}
