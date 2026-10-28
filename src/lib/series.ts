import { daysBetween, monthOf, monthsBetween, type CpiIndex } from './cpi';
import { depositValue } from './deposit';
import { unitPrice } from './returns';
import type { Holding, LivePrices, Settings } from './types';

export type PowerPoint = {
  /** 'YYYY-MM' */
  month: string;
  /** what the account shows */
  nominal: number;
  /** the same amount in start-of-window prices */
  real: number;
};

export type PowerSeries = {
  start: string;
  points: PowerPoint[];
  /** some values between purchase and today are interpolated (no price history) */
  estimated: boolean;
};

/** Daily FX rates per currency, keyed by 'YYYY-MM-DD' */
export type FxHistory = Partial<Record<'usd' | 'eur', Map<string, number>>>;

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Latest rate on or before `date`. */
function rateOn(history: Map<string, number>, date: string): number | undefined {
  let best: string | undefined;
  for (const d of history.keys()) if (d <= date && (!best || d > best)) best = d;
  return best ? history.get(best) : undefined;
}

/** First month shown: twelve months back, or the first purchase if that is later. */
export function windowStart(holdings: Holding[], today: string): string {
  const earliest = holdings.reduce((min, h) => (h.buyDate < min ? h.buyDate : min), today);
  const yearAgo = addMonths(monthOf(today), -12);
  return monthOf(earliest) > yearAgo ? monthOf(earliest) : yearAgo;
}

function valueOn(h: Holding, date: string, today: string, prices: LivePrices, fx: FxHistory): { v: number; est: boolean } {
  if (h.kind === 'deposit') return { v: depositValue(h, date), est: false };
  const now = unitPrice(h, prices);
  if (h.kind === 'usd' || h.kind === 'eur') {
    const r = fx[h.kind] && date < today ? rateOn(fx[h.kind]!, date) : undefined;
    if (r !== undefined) return { v: h.quantity * r, est: false };
  }
  if (now === undefined) return { v: h.quantity * h.unitCost, est: true };
  // No price history: straight line from purchase price to today's price.
  const span = Math.max(1, daysBetween(h.buyDate, today));
  const t = Math.min(1, Math.max(0, daysBetween(h.buyDate, date) / span));
  return { v: h.quantity * (h.unitCost + (now - h.unitCost) * t), est: date < today };
}

export function purchasingPowerSeries(
  holdings: Holding[],
  today: string,
  prices: LivePrices,
  fx: FxHistory,
  settings: Settings,
  index: CpiIndex,
): PowerSeries | undefined {
  if (holdings.length === 0) return undefined;
  const start = windowStart(holdings, today);
  const last = monthOf(today);
  const level = (month: string, date: string) => {
    if (settings.inflationSource === 'custom') {
      return Math.pow(1 + settings.customAnnualRate / 100, daysBetween(`${start}-01`, date) / 365);
    }
    const m = month > index.last ? index.last : month < index.first ? index.first : month;
    return index.levels.get(m)!;
  };
  // A purchase month's level is the base, so the first point has real = nominal.
  const base = level(start, `${start}-01`);

  const points: PowerPoint[] = [];
  let estimated = false;
  for (let i = 0; i <= monthsBetween(start, last); i++) {
    const month = addMonths(start, i);
    const date = month === last ? today : monthEnd(month);
    let nominal = 0;
    for (const h of holdings) {
      if (h.buyDate > date) continue;
      const { v, est } = valueOn(h, date, today, prices, fx);
      nominal += v;
      estimated ||= est;
    }
    const deflator = i === 0 ? 1 : level(month, date) / base;
    points.push({ month, nominal, real: nominal / deflator });
  }
  return { start, points, estimated };
}
