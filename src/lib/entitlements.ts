// What Premium unlocks. The free tier keeps the core answer (the real-return score) and
// never locks the user's data: backups, existing holdings and CPI reminders stay free.

export const FREE_HOLDING_LIMIT = 3;

export type PremiumFeature =
  | 'unlimitedHoldings'
  | 'powerChart'
  | 'scenario'
  | 'alternatives'
  | 'rateReminders'
  | 'customInflation';

export const PREMIUM_FEATURES: { id: PremiumFeature; title: string; detail: string }[] = [
  { id: 'unlimitedHoldings', title: 'Sınırsız varlık', detail: `Ücretsiz sürümde ${FREE_HOLDING_LIMIT} varlık` },
  { id: 'powerChart', title: 'Alım gücü grafiği', detail: 'Birikiminin ay ay gerçek değeri' },
  { id: 'scenario', title: 'Senaryo hesabı', detail: 'Enflasyon farklı gelirse ne olur' },
  { id: 'alternatives', title: 'Karşılaştırma', detail: 'Dolarda ya da mevduatta tutsaydın' },
  { id: 'rateReminders', title: 'Faiz kararı bildirimi', detail: 'TCMB kararı açıklanınca haber' },
  { id: 'customInflation', title: 'Kendi enflasyonun', detail: 'ENAG ya da kişisel oranla hesap' },
];

export function canUse(_feature: PremiumFeature, premium: boolean): boolean {
  return premium;
}

/**
 * Adding is limited, keeping is not: a lapsed subscriber keeps every holding they already
 * have and simply cannot add more until they are back under the limit or resubscribe.
 */
export function canAddHolding(currentCount: number, premium: boolean): boolean {
  return premium || currentCount < FREE_HOLDING_LIMIT;
}

export type PremiumStatus = {
  active: boolean;
  /** subscription is in its free trial */
  trial: boolean;
  /** ISO time the current period ends; undefined for lifetime or unknown */
  expiresAt?: string;
  willRenew: boolean;
  productId?: string;
  /** where the entitlement came from; 'dev' is the development-only switch */
  source: 'store' | 'dev' | 'none';
  /** store page where the user cancels or changes the plan */
  managementUrl?: string;
};

export const NO_PREMIUM: PremiumStatus = { active: false, trial: false, willRenew: false, source: 'none' };

/** Yearly price expressed per month, and the saving against paying monthly for a year. */
export function yearlySavings(monthlyPrice: number, yearlyPrice: number): { perMonth: number; savingPct: number } {
  const perMonth = yearlyPrice / 12;
  const savingPct = monthlyPrice > 0 ? Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100) : 0;
  return { perMonth, savingPct: Math.max(0, savingPct) };
}
