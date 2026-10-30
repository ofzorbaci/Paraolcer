// Personal inflation: the user's own spending weights and the price rises they actually face.
// A renter whose rent rose 60% lives a different inflation from a homeowner.

export type BasketGroup = 'housing' | 'food' | 'transport' | 'education' | 'health' | 'other';

export const BASKET_GROUPS: { id: BasketGroup; label: string; hint: string }[] = [
  { id: 'housing', label: 'Kira ve konut', hint: 'kira, aidat, fatura' },
  { id: 'food', label: 'Gıda', hint: 'market, mutfak' },
  { id: 'transport', label: 'Ulaşım', hint: 'yakıt, toplu taşıma, araç' },
  { id: 'education', label: 'Eğitim', hint: 'okul, kurs' },
  { id: 'health', label: 'Sağlık', hint: 'ilaç, sigorta' },
  { id: 'other', label: 'Diğer', hint: 'giyim, eğlence, iletişim' },
];

export type Basket = {
  /** share of monthly spending, any scale (normalised) */
  weights: Record<BasketGroup, number>;
  /** yearly price rise the user faces in that group, % */
  rates: Record<BasketGroup, number>;
};

/** A starting point: a typical household split, every group at the official yearly CPI. */
export function defaultBasket(officialYoy: number): Basket {
  const weights = { housing: 20, food: 25, transport: 16, education: 3, health: 4, other: 32 };
  const rates = Object.fromEntries(BASKET_GROUPS.map((g) => [g.id, officialYoy])) as Basket['rates'];
  return { weights, rates };
}

/** Spending-weighted yearly inflation, %; undefined when no weight is given. */
export function basketRate(b: Basket): number | undefined {
  let total = 0;
  let sum = 0;
  for (const { id } of BASKET_GROUPS) {
    const w = Math.max(0, b.weights[id] ?? 0);
    total += w;
    sum += w * (b.rates[id] ?? 0);
  }
  return total > 0 ? sum / total : undefined;
}
