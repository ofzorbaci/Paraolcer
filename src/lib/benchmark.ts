import { depositValue } from './deposit';
import type { HoldingAnalysis } from './returns';
import type { DepositTerms } from './scenario';
import type { Holding } from './types';

export type Alternative = {
  key: 'portfolio' | 'usd' | 'deposit';
  label: string;
  /** what it would be worth today, TRY */
  value: number;
  /** real return against the same inflation as the portfolio */
  real: number;
};

type Item = { holding: Holding; analysis: HoldingAnalysis };

/** What the same money, put in on the same dates, would be worth in a deposit with `terms`. */
export function depositAlternativeValue(items: Item[], terms: DepositTerms, today: string): number {
  return items.reduce(
    (sum, { holding, analysis }) =>
      sum +
      depositValue(
        {
          id: holding.id,
          kind: 'deposit',
          name: '',
          buyDate: holding.buyDate,
          quantity: 1,
          unitCost: analysis.cost,
          grossRate: terms.grossRate,
          termDays: terms.termDays,
          withholding: terms.withholding,
        },
        today,
      ),
    0,
  );
}

/** Portfolio vs. "kept it in dollars" vs. "kept it in a deposit", all deflated by the same CPI. */
export function compareAlternatives(
  items: Item[],
  usdValue: number | undefined,
  terms: DepositTerms,
  today: string,
): Alternative[] {
  const priced = items.filter((i) => i.analysis.value !== undefined && i.analysis.cost > 0);
  if (priced.length === 0) return [];
  const breakEven = priced.reduce((s, i) => s + i.analysis.breakEven, 0);
  const value = priced.reduce((s, i) => s + i.analysis.value!, 0);
  const real = (v: number) => v / breakEven - 1;

  const out: Alternative[] = [{ key: 'portfolio', label: 'Senin portföyün', value, real: real(value) }];
  if (usdValue !== undefined) out.push({ key: 'usd', label: 'Dolarda tutsaydın', value: usdValue, real: real(usdValue) });
  const dep = depositAlternativeValue(priced, terms, today);
  out.push({ key: 'deposit', label: 'Mevduatta tutsaydın', value: dep, real: real(dep) });
  return out;
}
