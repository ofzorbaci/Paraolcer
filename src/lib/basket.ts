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

/** Yearly change and TÜİK weight per group, from the data feed (Feed['cpiGroups']). */
export type GroupData = { yoy: Record<BasketGroup, number>; weights: Record<BasketGroup, number> };

/**
 * A starting point: TÜİK's own weights and each group's official yearly change when the feed has
 * them, otherwise a typical split with every group at the headline rate.
 */
export function defaultBasket(officialYoy: number, groups?: GroupData): Basket {
  if (groups) return { weights: { ...groups.weights }, rates: { ...groups.yoy } };
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

export type BasketAnswers = {
  rents: boolean;
  car: boolean;
  schoolKids: boolean;
  eatOut: 'rarely' | 'sometimes' | 'often';
  healthHigh: boolean;
};

/**
 * Five questions fill in the spending shares; the user can still adjust every number. Group
 * price rises start at TÜİK's yearly change for that group (or the headline rate without data).
 */
export function basketFromAnswers(a: BasketAnswers, officialYoy: number, groups?: GroupData): Basket {
  const weights: Basket['weights'] = {
    housing: a.rents ? 32 : 15,
    food: 25,
    transport: a.car ? 18 : 9,
    education: a.schoolKids ? 8 : 1,
    health: a.healthHigh ? 7 : 3,
    // restaurants and hotels sit under "other"
    other: 22 + { rarely: 0, sometimes: 4, often: 9 }[a.eatOut],
  };
  return { weights, rates: defaultBasket(officialYoy, groups).rates };
}
