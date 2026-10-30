// What Premium unlocks. The free tier answers the core question in full — every holding, the
// real-return score, the ENAG/personal total in one line, and at every maturity which of deposit,
// dollar or gold protected best — and never locks the user's data. Premium sells the lira
// amounts, the longer windows, the forward-looking estimate, history, scenarios and tools.

import type { Holding } from './types';

export type PremiumFeature =
  | 'enagDetail'
  | 'personalBasket'
  | 'renewUnlimited'
  | 'renewForward'
  | 'usdReal'
  | 'powerChart'
  | 'benchmarks'
  | 'scenario'
  | 'alternatives'
  | 'rateReminders'
  | 'goals'
  | 'portfolios';

export const PREMIUM_FEATURES: { id: PremiumFeature; title: string; detail: string }[] = [
  { id: 'renewUnlimited', title: 'Tam “Yenilesem mi?”', detail: 'Lira farkı, son 3 ve 12 ay; ücretsizde yalnızca sıralama' },
  { id: 'renewForward', title: 'Vade günü ileriye dönük hesap', detail: 'Bu faizle yenilersen beklenen reel getiri' },
  { id: 'usdReal', title: 'Dolar bazında reel getiri', detail: 'Varlıkların ABD enflasyonuna göre gerçek değeri' },
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

export function canUse(_feature: PremiumFeature, premium: boolean): boolean {
  return premium;
}

/** Every holding is free; the limit was removed because it left no reason to pay for depth. */
export function canAddHolding(_currentCount: number, _premium: boolean): boolean {
  return true;
}

/** The one-time "Kurucu Üye" plan is sold only until this day (inclusive), to the first 500 buyers. */
export const FOUNDER_UNTIL = '2027-01-31';
export const FOUNDER_SEATS = 500;

export function founderOfferOpen(today: string): boolean {
  return today <= FOUNDER_UNTIL;
}

export type Showcase = { key: 'maturity' | 'wealth' | 'general'; title: string; subtitle: string; lead: PremiumFeature[] };

/**
 * The paywall leads with what fits the user's money: deposit holders get the maturity-day pack,
 * people who only hold dollars or gold get the "real wealth" pack. Everything stays included.
 */
export function premiumShowcase(holdings: Holding[]): Showcase {
  const own = holdings.filter((h) => !h.sample);
  if (own.some((h) => h.kind === 'deposit')) {
    return {
      key: 'maturity',
      title: 'Vade Günü Paketi',
      subtitle: 'Her vadede paranın nerede daha iyi korunduğunu liralarla gör.',
      lead: ['renewUnlimited', 'renewForward', 'goals'],
    };
  }
  if (own.length > 0 && own.every((h) => h.kind === 'usd' || h.kind === 'eur' || h.kind === 'gbp' || h.kind === 'gold')) {
    return {
      key: 'wealth',
      title: 'Gerçek Servet Paketi',
      subtitle: 'Dövizin ve altının sadece TL’ye değil, kendi enflasyonuna karşı da ölçülsün.',
      lead: ['usdReal', 'goals', 'personalBasket'],
    };
  }
  return {
    key: 'general',
    title: 'Paraölçer Premium',
    subtitle: 'Birikiminin gerçek değerini her açıdan gör.',
    lead: ['renewUnlimited', 'benchmarks', 'enagDetail'],
  };
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
