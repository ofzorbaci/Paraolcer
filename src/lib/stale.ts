import { priceAgeDays } from './lookup';
import { feedQuote } from './securities';
import { isLivePriced, type Holding } from './types';

/** A hand-entered price older than this gets a reminder on the card and next to the score. */
export const STALE_DAYS = 7;

/** Hand-priced holdings whose price is a week old or more; feed-priced funds and stocks never are. */
export function staleHoldings(holdings: Holding[], now: Date): Holding[] {
  return holdings.filter(
    (h) => h.kind !== 'deposit' && !isLivePriced(h.kind) && !feedQuote(h) && (priceAgeDays(h, now) ?? 0) >= STALE_DAYS,
  );
}
