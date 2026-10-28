import { useEffect, useMemo, useState } from 'react';

import { todayISO } from '@/lib/format';
import { currencyBenchmark, type Currency } from '@/lib/fx';
import { analyzeHolding, analyzePortfolio } from '@/lib/returns';
import type { Holding } from '@/lib/types';
import { useStore } from '@/state/store';

export function usePortfolio() {
  const holdings = useStore((s) => s.holdings);
  const settings = useStore((s) => s.settings);
  const index = useStore((s) => s.cpi.index);
  const fx = useStore((s) => s.fx);
  const today = todayISO();

  return useMemo(() => {
    const items = holdings
      .map((h) => ({ holding: h, analysis: analyzeHolding(h, today, fx, settings, index) }))
      .sort((a, b) => b.holding.buyDate.localeCompare(a.holding.buyDate));
    return { items, total: analyzePortfolio(items.map((i) => i.analysis)), cpiLast: index.last, settings };
  }, [holdings, settings, index, fx, today]);
}

export type Benchmarks = Partial<Record<Currency, number>>;

/** What the same purchases would be worth today had they gone into USD or EUR. */
export function useCurrencyBenchmarks(holdings: Holding[]): { data: Benchmarks; loading: boolean } {
  const key = holdings.map((h) => `${h.id}:${h.buyDate}:${h.quantity * h.unitCost}`).join('|');
  const [result, setResult] = useState<{ key: string; data: Benchmarks }>({ key: '', data: {} });

  useEffect(() => {
    if (holdings.length === 0) return;
    let cancelled = false;
    const total = (c: Currency) =>
      Promise.all(holdings.map((h) => currencyBenchmark(c, h.quantity * h.unitCost, h.buyDate))).then((xs) =>
        xs.reduce((a, b) => a + b, 0),
      );
    Promise.allSettled([total('usd'), total('eur')]).then(([usd, eur]) => {
      if (cancelled) return;
      setResult({
        key,
        data: {
          usd: usd.status === 'fulfilled' ? usd.value : undefined,
          eur: eur.status === 'fulfilled' ? eur.value : undefined,
        },
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (holdings.length === 0) return { data: {}, loading: false };
  return { data: result.key === key ? result.data : {}, loading: result.key !== key };
}
