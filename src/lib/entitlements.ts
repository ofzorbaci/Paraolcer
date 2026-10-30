// What Premium unlocks. The free tier answers the core question in full — every holding, the
// real-return score, the ENAG/personal total in one line, one "Yenilesem mi?" a month — and
// never locks the user's data. Premium sells depth: detail, history, scenarios and tools.

export type PremiumFeature =
  | 'enagDetail'
  | 'personalBasket'
  | 'renewUnlimited'
  | 'powerChart'
  | 'benchmarks'
  | 'scenario'
  | 'alternatives'
  | 'rateReminders'
  | 'goals'
  | 'portfolios';

export const PREMIUM_FEATURES: { id: PremiumFeature; title: string; detail: string }[] = [
  { id: 'renewUnlimited', title: 'Sınırsız “Yenilesem mi?”', detail: 'Ücretsiz sürümde ayda 1 kez' },
  { id: 'enagDetail', title: 'ENAG ve kendi enflasyonun', detail: 'Her varlık için ayrı ayrı' },
  { id: 'personalBasket', title: 'Kişisel enflasyon sepeti', detail: 'Kira, gıda, ulaşım… kendi ağırlıklarınla' },
  { id: 'powerChart', title: 'Alım gücü grafiği ve zaman makinesi', detail: 'Birikiminin ay ay gerçek değeri' },
  { id: 'benchmarks', title: 'Kıyas grafiği', detail: 'Dolar, altın, mevduat ve TÜFE ile reel kıyas' },
  { id: 'scenario', title: 'Senaryo hesabı', detail: 'Enflasyon farklı gelirse ne olur' },
  { id: 'alternatives', title: 'Karşılaştırma', detail: 'Dolarda ya da mevduatta tutsaydın' },
  { id: 'goals', title: 'Hedefler ve alarmlar', detail: '“Reel getirim sıfırın altına düşerse haber ver”' },
  { id: 'rateReminders', title: 'Faiz kararı bildirimi', detail: 'TCMB kararı açıklanınca haber' },
  { id: 'portfolios', title: 'Çoklu portföy', detail: 'Senin, eşinin, çocuğunun birikimi ayrı' },
];

/** "Yenilesem mi?" full results a free user gets per calendar month. */
export const FREE_RENEW_CHECKS_PER_MONTH = 1;

export function canUse(_feature: PremiumFeature, premium: boolean): boolean {
  return premium;
}

/** Every holding is free; the limit was removed because it left no reason to pay for depth. */
export function canAddHolding(_currentCount: number, _premium: boolean): boolean {
  return true;
}

/** Whether a free user still has a "Yenilesem mi?" result left this month. */
export function renewCheckAllowed(premium: boolean, usedMonth: string | undefined, used: number, month: string): boolean {
  if (premium) return true;
  const count = usedMonth === month ? used : 0;
  return count < FREE_RENEW_CHECKS_PER_MONTH;
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
