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

/**
 * Paraölçer sells a single tier, so if the dashboard's entitlement is named differently from
 * `entitlement` (e.g. RevenueCat's default "pro"), any active entitlement still unlocks Premium.
 */
export function statusFromCustomerInfo(info: CustomerInfoLike, entitlement: string): PremiumStatus {
  const active = info.entitlements.active;
  const e = active[entitlement] ?? Object.values(active).find((x) => x?.isActive);
  const managementUrl = info.managementURL ?? undefined;
  if (!e?.isActive) return { ...NO_PREMIUM, managementUrl };
  return {
    active: true,
    trial: e.periodType === 'TRIAL',
    expiresAt: e.expirationDate ?? undefined,
    willRenew: e.willRenew,
    // RevenueCat gives a lifetime (non-subscription) purchase no expiration date.
    ...(e.expirationDate === null && !e.willRenew && { lifetime: true }),
    productId: e.productIdentifier,
    source: 'store',
    managementUrl,
  };
}

type PackageLike = { packageType: string; product: { subscriptionPeriod?: string | null } };

/**
 * Which plan a package is. RevenueCat's standard packages say it directly; a package with a custom
 * identifier is lifetime when its product has no subscription period (a one-time purchase).
 */
export function planPeriod(pkg: PackageLike): 'monthly' | 'yearly' | 'lifetime' | undefined {
  if (pkg.packageType === 'ANNUAL') return 'yearly';
  if (pkg.packageType === 'MONTHLY') return 'monthly';
  if (pkg.packageType === 'LIFETIME' || !pkg.product.subscriptionPeriod) return 'lifetime';
  return undefined;
}

/** Length of a free introductory offer in days; undefined for paid intro prices or none. */
export function freeTrialDays(intro: IntroPriceLike | null | undefined): number | undefined {
  if (!intro || intro.price !== 0) return undefined;
  const days = intro.periodNumberOfUnits * (DAYS[intro.periodUnit] ?? 0) * Math.max(1, intro.cycles);
  return days > 0 ? days : undefined;
}
