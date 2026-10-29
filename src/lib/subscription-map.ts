// Pure mapping from RevenueCat's data to our own types, kept apart from the native SDK so it can be tested.

import { NO_PREMIUM, type PremiumStatus } from './entitlements';

type EntitlementLike = {
  isActive: boolean;
  willRenew: boolean;
  periodType: string;
  expirationDate: string | null;
  productIdentifier: string;
};

type CustomerInfoLike = {
  entitlements: { active: Record<string, EntitlementLike | undefined> };
  managementURL: string | null;
};

type IntroPriceLike = { price: number; periodUnit: string; periodNumberOfUnits: number; cycles: number };

const DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

export function statusFromCustomerInfo(info: CustomerInfoLike, entitlement: string): PremiumStatus {
  const e = info.entitlements.active[entitlement];
  const managementUrl = info.managementURL ?? undefined;
  if (!e?.isActive) return { ...NO_PREMIUM, managementUrl };
  return {
    active: true,
    trial: e.periodType === 'TRIAL',
    expiresAt: e.expirationDate ?? undefined,
    willRenew: e.willRenew,
    productId: e.productIdentifier,
    source: 'store',
    managementUrl,
  };
}

/** Length of a free introductory offer in days; undefined for paid intro prices or none. */
export function freeTrialDays(intro: IntroPriceLike | null | undefined): number | undefined {
  if (!intro || intro.price !== 0) return undefined;
  const days = intro.periodNumberOfUnits * (DAYS[intro.periodUnit] ?? 0) * Math.max(1, intro.cycles);
  return days > 0 ? days : undefined;
}
