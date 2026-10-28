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
