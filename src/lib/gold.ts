import type { GoldType } from './types';

// Gram gold in TRY = international spot (USD/oz, gold-api.com) ÷ 31.1035 × USD/TRY.
// Domestic gram gold usually trades a little above this because of the local premium.

export const GRAMS_PER_TROY_OUNCE = 31.1034768;

export async function fetchGoldUsdPerOunce(): Promise<number> {
  const res = await fetch('https://api.gold-api.com/price/XAU');
  if (!res.ok) throw new Error(`Altın fiyatı alınamadı (${res.status})`);
  const body = (await res.json()) as { price?: number };
  if (typeof body.price !== 'number' || !(body.price > 0)) throw new Error('Altın yanıtı geçersiz');
  return body.price;
}

export function gramGoldTry(usdPerOunce: number, usdTry: number): number {
  return (usdPerOunce / GRAMS_PER_TROY_OUNCE) * usdTry;
}

/**
 * Fine gold per piece. Darphane coins are 22 karat (916.6‰): çeyrek 1.754 g, yarım 3.508 g,
 * tam 7.016 g, Cumhuriyet (Ata) 7.216 g gross. Shops add a workmanship premium on top of this.
 */
const FINENESS_22K = 0.9166;
const PURE_GRAMS: Record<GoldType, number> = {
  gram: 1,
  ceyrek: 1.754 * FINENESS_22K,
  yarim: 3.508 * FINENESS_22K,
  tam: 7.016 * FINENESS_22K,
  cumhuriyet: 7.216 * FINENESS_22K,
};

export function goldPureGrams(type: GoldType | undefined): number {
  return PURE_GRAMS[type ?? 'gram'];
}
