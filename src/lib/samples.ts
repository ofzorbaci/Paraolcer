import type { Holding } from './types';

function monthsAgo(today: string, months: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 - months, Math.min(d, 28)));
  return date.toISOString().slice(0, 10);
}

/** A small, clearly labelled example portfolio so a new user sees a full screen at once. */
export function samplePortfolio(today: string, id: () => string): Holding[] {
  return [
    {
      id: id(),
      kind: 'deposit',
      name: 'Örnek mevduat',
      buyDate: monthsAgo(today, 12),
      quantity: 1,
      unitCost: 100_000,
      grossRate: 42,
      termDays: 32,
      sample: true,
    },
    { id: id(), kind: 'usd', name: 'Örnek dolar', buyDate: monthsAgo(today, 18), quantity: 1_000, unitCost: 33, sample: true },
    {
      id: id(),
      kind: 'gold',
      goldType: 'ceyrek',
      name: 'Örnek çeyrek altın',
      buyDate: monthsAgo(today, 9),
      quantity: 4,
      unitCost: 8_000,
      sample: true,
    },
  ];
}

/** Start dates offered by the quick-start card. */
export const QUICK_PERIODS = [
  { months: 3, label: '3 ay' },
  { months: 6, label: '6 ay' },
  { months: 12, label: '1 yıl' },
  { months: 24, label: '2 yıl' },
] as const;

export function quickStartDate(today: string, months: number): string {
  return monthsAgo(today, months);
}
