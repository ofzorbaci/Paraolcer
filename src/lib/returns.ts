import { inflationFor, type CpiIndex, type InflationResult } from './cpi';
import { depositValue } from './deposit';
import { goldPureGrams } from './gold';
import { isLivePriced, type Holding, type HoldingKind, type LivePrices, type Settings } from './types';

/** Fisher equation: growth in purchasing power. */
export function realReturn(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

export function holdingCost(h: Holding): number {
  return h.quantity * h.unitCost;
}

/** Current TRY value, or undefined when no current price is known yet. */
/** Today's TRY price per unit: live where available (a gold coin is priced by its fine gold), else manual. */
export function unitPrice(h: Holding, prices: LivePrices): number | undefined {
  if (!isLivePriced(h.kind)) return h.currentPrice;
  const live = prices[h.kind];
  if (live === undefined) return h.currentPrice;
  return h.kind === 'gold' ? live * goldPureGrams(h.goldType) : live;
}

export function holdingValue(h: Holding, today: string, prices: LivePrices): number | undefined {
  if (h.kind === 'deposit') return depositValue(h, today);
  const price = unitPrice(h, prices);
  return price === undefined ? undefined : h.quantity * price;
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
  prices: LivePrices,
  settings: Settings,
  index: CpiIndex,
): HoldingAnalysis {
  const cost = holdingCost(h);
  const value = holdingValue(h, today, prices);
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

export type KindSummary = { kind: HoldingKind; real: number; value: number };

/** Real return per asset class, best protector first. */
export function summarizeByKind(items: { holding: Holding; analysis: HoldingAnalysis }[]): KindSummary[] {
  const groups = new Map<HoldingKind, HoldingAnalysis[]>();
  for (const { holding, analysis } of items) {
    groups.set(holding.kind, [...(groups.get(holding.kind) ?? []), analysis]);
  }
  const out: KindSummary[] = [];
  for (const [kind, list] of groups) {
    const total = analyzePortfolio(list);
    if (total) out.push({ kind, real: total.real, value: total.value });
  }
  return out.sort((a, b) => b.real - a.real);
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
