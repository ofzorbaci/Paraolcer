// "Kıyas": the portfolio and the usual alternatives, all in today's purchasing power, month by
// month over a chosen window. Each line starts at 100; above 100 means it beat inflation.

import { monthOf, monthsBetween, type CpiIndex } from './cpi';
import { defaultWithholding, netAnnualRate } from './deposit';
import type { Feed } from './feed-types';
import { GRAMS_PER_TROY_OUNCE } from './gold';
import { valueAt } from './renew';
import { addMonths, monthEnd, purchasingPowerSeries, type FxHistory } from './series';
import type { Holding, LivePrices, Settings } from './types';

export const COMPARE_PERIODS = [
  { months: 3, label: '3 ay' },
  { months: 6, label: '6 ay' },
  { months: 12, label: '1 yıl' },
  { months: 36, label: '3 yıl' },
  { months: 60, label: '5 yıl' },
] as const;

export type CompareKey = 'portfolio' | 'usd' | 'gold' | 'deposit' | 'cash';

export const COMPARE_LABELS: Record<CompareKey, string> = {
  portfolio: 'Birikimin',
  usd: 'Dolar',
  gold: 'Gram altın',
  deposit: 'Mevduat',
  cash: 'Nakit TL',
};

export type ComparePoint = { month: string; value: number };
export type CompareLine = { key: CompareKey; points: ComparePoint[]; /** real change over the window, ratio */ real: number };

export type TimeMachine = {
  month: string;
  /** what the portfolio showed at the end of `month` */
  then: number;
  /** the same amount in today's prices */
  thenToday: number;
  now: number;
};

export type Comparison = {
  start: string;
  lines: CompareLine[];
  /** portfolio values between purchase and today are partly interpolated */
  estimated: boolean;
  /** holdings bought inside the window are left out of the portfolio line */
  excluded: number;
  timeMachine?: TimeMachine;
};

/** Policy rate in force on `date`; the deposit line rolls monthly at it, 32-day withholding. */
function policyRateOn(history: Feed['policyRate']['history'], date: string): number {
  let rate = history[0]?.rate ?? 0;
  for (const h of history) if (h.from <= date) rate = h.rate;
  return rate;
}

export function compareSeries(opts: {
  holdings: Holding[];
  months: number;
  today: string;
  prices: LivePrices;
  feed: Pick<Feed, 'markets' | 'policyRate'>;
  settings: Settings;
  index: CpiIndex;
}): Comparison {
  const { holdings, months, today, prices, feed, settings, index } = opts;
  const last = monthOf(today);
  const start = addMonths(last, -months);
  const n = monthsBetween(start, last);
  const monthList = Array.from({ length: n + 1 }, (_, i) => addMonths(start, i));

  // Price level at each month-end relative to the start month.
  const level = (month: string) => {
    if (settings.inflationSource === 'custom') return Math.pow(1 + settings.customAnnualRate / 100, monthsBetween(start, month) / 12);
    const clamp = (m: string) => (m > index.last ? index.last : m < index.first ? index.first : m);
    return index.levels.get(clamp(month))! / index.levels.get(clamp(start))!;
  };
  const realLine = (key: CompareKey, nominal: (month: string) => number | undefined): CompareLine | undefined => {
    const base = nominal(start);
    if (!base) return undefined;
    const points: ComparePoint[] = [];
    for (const m of monthList) {
      const v = nominal(m);
      if (v === undefined) return undefined;
      points.push({ month: m, value: (v / base / level(m)) * 100 });
    }
    return { key, points, real: points[points.length - 1].value / 100 - 1 };
  };

  const markets = feed.markets;
  const usd = (m: string) => (m === last && prices.usd) || (markets && valueAt(markets.usdTry, m));
  const gold = (m: string) => {
    if (m === last && prices.gold) return prices.gold;
    const oz = markets && valueAt(markets.goldUsdOz, m);
    const u = markets && valueAt(markets.usdTry, m);
    return oz && u ? (oz / GRAMS_PER_TROY_OUNCE) * u : undefined;
  };
  let deposit = 1;
  const depositLevels = new Map<string, number>([[start, 1]]);
  for (const m of monthList.slice(1)) {
    const gross = policyRateOn(feed.policyRate.history, `${m}-01`);
    deposit *= 1 + netAnnualRate(gross, defaultWithholding(32)) / 100 / 12;
    depositLevels.set(m, deposit);
  }

  // Portfolio: only holdings already owned at the start, so new money does not look like a gain.
  const owned = holdings.filter((h) => h.buyDate <= monthEnd(start));
  const fx: FxHistory = markets ? { usd: new Map(markets.usdTry.map((p) => [monthEnd(p.month), p.value])) } : {};
  const series = owned.length ? purchasingPowerSeries(owned, today, prices, fx, settings, index, start) : undefined;
  const nominalByMonth = new Map(series?.points.map((p) => [p.month, p.nominal]));

  const lines = [
    realLine('portfolio', (m) => nominalByMonth.get(m)),
    realLine('usd', usd),
    realLine('gold', gold),
    realLine('deposit', (m) => depositLevels.get(m)),
    realLine('cash', () => 1),
  ].filter((l): l is CompareLine => !!l);

  const first = series?.points[0];
  const now = series?.points[series.points.length - 1];
  const timeMachine =
    first && now && first.nominal > 0
      ? { month: start, then: first.nominal, thenToday: first.nominal * level(last), now: now.nominal }
      : undefined;

  return {
    start,
    lines,
    estimated: series?.estimated ?? false,
    excluded: holdings.length - owned.length,
    timeMachine,
  };
}
