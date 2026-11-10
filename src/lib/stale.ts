import { priceAgeDays } from './lookup';
import { feedQuote } from './securities';
import { isLivePriced, isUsdPriced, type Holding } from './types';

/** A hand-entered price older than this gets a reminder on the card, the summary and the price list. */
export const STALE_DAYS = 3;

/** Holdings whose current price the user types in: BIST stocks, unlisted funds and symbols, "Diğer". */
export function isManualPriced(h: Holding): boolean {
  return h.kind !== 'deposit' && !isLivePriced(h.kind) && !feedQuote(h);
}

/** Every hand-priced holding, oldest (or never entered) price first: the bulk price screen's list. */
export function manualHoldings(holdings: Holding[]): Holding[] {
  const age = (h: Holding) => (h.priceUpdatedAt ? Date.parse(h.priceUpdatedAt) : 0);
  return holdings.filter(isManualPriced).sort((a, b) => age(a) - age(b));
}

/** Hand-priced holdings whose price is `STALE_DAYS` old or more; feed-priced ones never are. */
export function staleHoldings(holdings: Holding[], now: Date): Holding[] {
  return holdings.filter((h) => isManualPriced(h) && (priceAgeDays(h, now) ?? 0) >= STALE_DAYS);
}

/** The hand-entered current price in the unit the user typed it in: USD for US stocks, ETFs, crypto. */
export function enteredPrice(h: Holding): number | undefined {
  return isUsdPriced(h.kind) ? h.currentPriceUsd : h.currentPrice;
}

/** A hand-entered price with a new value (or the same one, re-checked today). */
export function withEnteredPrice(h: Holding, price: number, at: Date): Holding {
  const stamp = at.toISOString();
  return isUsdPriced(h.kind) ? { ...h, currentPriceUsd: price, priceUpdatedAt: stamp } : { ...h, currentPrice: price, priceUpdatedAt: stamp };
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** "Senin girdiğin · 10 Kasım" (and how many days ago once it is stale). */
export function enteredLabel(h: Holding, now: Date): string | undefined {
  if (!h.priceUpdatedAt) return undefined;
  const d = new Date(h.priceUpdatedAt);
  const age = priceAgeDays(h, now) ?? 0;
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return age >= STALE_DAYS ? `Senin girdiğin · ${day} · ${age} gün önce` : `Senin girdiğin · ${day}`;
}
