// The free taste: for the first 14 days after the app is first opened, the personal-inflation
// features work in full without a subscription or a store trial, no card needed.

import type { PremiumFeature } from './entitlements';

export const TASTE_DAYS = 14;

export const TASTE_FEATURES: PremiumFeature[] = ['personalInflation', 'personalBasket', 'netWorth'];

/** Whole days of the taste left on `now`; 0 once it is over or before the first open is known. */
export function tasteDaysLeft(firstOpenAt: string | undefined, now: Date): number {
  if (!firstOpenAt) return 0;
  const end = Date.parse(firstOpenAt) + TASTE_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

export function tasteUnlocks(feature: PremiumFeature, firstOpenAt: string | undefined, now: Date): boolean {
  return TASTE_FEATURES.includes(feature) && tasteDaysLeft(firstOpenAt, now) > 0;
}
