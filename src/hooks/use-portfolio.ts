import { useEffect, useMemo, useState } from 'react';

import { todayISO } from '@/lib/format';
import { compareAlternatives } from '@/lib/benchmark';
import { currencyBenchmark, fetchTryRateSeries } from '@/lib/fx';
import { analyzeHolding, analyzePortfolio, summarizeByKind } from '@/lib/returns';
import { depositTerms } from '@/lib/scenario';
import { purchasingPowerSeries, windowStart, type FxHistory } from '@/lib/series';
import { useStore } from '@/state/store';

export function usePortfolio() {
  const holdings = useStore((s) => s.holdings);
  const settings = useStore((s) => s.settings);
  const index = useStore((s) => s.cpi.index);
  const prices = useStore((s) => s.prices);
  const today = todayISO();

  return useMemo(() => {
    const items = holdings
      .map((h) => ({ holding: h, analysis: analyzeHolding(h, today, prices, settings, index) }))
      .sort((a, b) => b.holding.buyDate.localeCompare(a.holding.buyDate));
    return {
      items,
      total: analyzePortfolio(items.map((i) => i.analysis)),
      byKind: summarizeByKind(items),
      cpiLast: index.last,
      settings,
    };
  }, [holdings, settings, index, prices, today]);
}

/** Monthly "what the account shows" vs "what it buys", over the last 12 months. */
export function usePowerSeries() {
  const holdings = useStore((s) => s.holdings);
  const settings = useStore((s) => s.settings);
  const index = useStore((s) => s.cpi.index);
  const prices = useStore((s) => s.prices);
  const today = todayISO();
  const [fx, setFx] = useState<{ key: string; data: FxHistory }>({ key: '', data: {} });

  const currencies = [...new Set(holdings.map((h) => h.kind))].filter((k) => k === 'usd' || k === 'eur');
  const from = holdings.length ? `${windowStart(holdings, today)}-01` : today;
  const key = `${currencies.join(',')}:${from}:${today}`;

  useEffect(() => {
    if (currencies.length === 0) return;
    let cancelled = false;
    Promise.allSettled(currencies.map((c) => fetchTryRateSeries(c, from, today))).then((results) => {
      if (cancelled) return;
      const data: FxHistory = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') data[currencies[i]] = r.value;
      });
      setFx({ key, data });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(
    () => purchasingPowerSeries(holdings, today, prices, fx.key === key ? fx.data : {}, settings, index),
    [holdings, today, prices, fx, key, settings, index],
  );
}

/** The portfolio against "kept it in dollars" and "kept it in a deposit". */
export function useAlternatives() {
  const { items } = usePortfolio();
  const holdings = useStore((s) => s.holdings);
  const today = todayISO();
  const priced = items.filter((i) => i.analysis.value !== undefined && i.analysis.cost > 0);
  const key = priced.map((i) => `${i.holding.id}:${i.holding.buyDate}:${i.analysis.cost}`).join('|');
  const [usd, setUsd] = useState<{ key: string; value?: number }>({ key: '' });

  useEffect(() => {
    if (priced.length === 0) return;
    let cancelled = false;
    Promise.all(priced.map((i) => currencyBenchmark('usd', i.analysis.cost, i.holding.buyDate)))
      .then((xs) => !cancelled && setUsd({ key, value: xs.reduce((a, b) => a + b, 0) }))
      .catch(() => !cancelled && setUsd({ key }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const terms = depositTerms(holdings);
  return {
    terms,
    loading: priced.length > 0 && usd.key !== key,
    list: compareAlternatives(items, usd.key === key ? usd.value : undefined, terms, today),
  };
}
