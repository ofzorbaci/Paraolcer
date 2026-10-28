import { daysBetween, inflationFor, type CpiIndex, type InflationResult } from './cpi';
import type { FxQuotes, Holding, Settings } from './types';

/** Fisher equation: growth in purchasing power. */
export function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

export function holdingCost(h: Holding): number {
  return h.quantity * h.unitCost;
}

/** Current TRY value, or undefined when no current price is known yet. */
export function holdingValue(h: Holding, today: string, fx: FxQuotes): number | undefined {
  if (h.kind === 'deposit') {
    const years = Math.max(0, daysBetween(h.buyDate, today)) / 365;
    return holdingCost(h) * Math.pow(1 + (h.depositRate ?? 0) / 100, years);
  }
  if (h.kind === 'usd' || h.kind === 'eur') {
    const rate = fx[h.kind] ?? h.currentPrice;
    return rate === undefined ? undefined : h.quantity * rate;
  }
  return h.currentPrice === undefined ? undefined : h.quantity * h.currentPrice;
}

export type HoldingAnalysis = {
  cost: number;
  value: number | undefined;
  inflation: InflationResult;
  /** cost restated in today's money */
  breakEven: number;
  nominal: number | undefined;
  real: number | undefined;
  /** gain above inflation, in today's TRY */
  realGain: number | undefined;
};

export function analyzeHolding(
  h: Holding,
  today: string,
  fx: FxQuotes,
  settings: Settings,
  index: CpiIndex,
): HoldingAnalysis {
  const cost = holdingCost(h);
  const value = holdingValue(h, today, fx);
  const inflation = inflationFor(settings, index, h.buyDate, today);
  const breakEven = cost * inflation.factor;
  if (value === undefined || cost <= 0) {
    return { cost, value, inflation, breakEven, nominal: undefined, real: undefined, realGain: undefined };
  }
  const nominal = value / cost - 1;
  return {
    cost,
    value,
    inflation,
    breakEven,
    nominal,
    real: realReturn(nominal, inflation.factor - 1),
    realGain: value - breakEven,
  };
}

export type PortfolioAnalysis = {
  cost: number;
  value: number;
  breakEven: number;
  nominal: number;
  /** cost-weighted inflation over each holding's own period */
  inflation: number;
  real: number;
  realGain: number;
  /** holdings left out because they have no current price */
  unpriced: number;
  /** some holdings run past the latest published CPI month */
  incomplete: boolean;
};

export function analyzePortfolio(items: HoldingAnalysis[]): PortfolioAnalysis | undefined {
  const priced = items.filter((a) => a.value !== undefined && a.cost > 0);
  if (priced.length === 0) return undefined;
  const cost = sum(priced.map((a) => a.cost));
  const value = sum(priced.map((a) => a.value!));
  const breakEven = sum(priced.map((a) => a.breakEven));
  return {
    cost,
    value,
    breakEven,
    nominal: value / cost - 1,
    inflation: breakEven / cost - 1,
    real: value / breakEven - 1,
    realGain: value - breakEven,
    unpriced: items.length - priced.length,
    incomplete: priced.some((a) => !a.inflation.complete),
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
