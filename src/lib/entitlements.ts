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
  | 'portfolios'
  | 'budgetAnalysis'
  | 'personalInflation'
  | 'netWorth'
  | 'budgetReminders';

export const PREMIUM_FEATURES: { id: PremiumFeature; title: string; detail: string }[] = [
  { id: 'renewUnlimited', title: 'Tam “Yenilesem mi?”', detail: 'Lira farkı, son 3 ve 12 ay; ücretsizde yalnızca sıralama' },
  { id: 'renewForward', title: 'Vade günü 12 aylık reel lira', detail: 'Bu faizle yenilersen 12 ayda bugünün lirasıyla ne kazanırsın' },
  { id: 'usdReal', title: 'Dolar bazında reel getiri', detail: 'Varlıkların ABD enflasyonuna göre gerçek değeri' },
  { id: 'enagDetail', title: 'ENAG ve kendi enflasyonun', detail: 'Her varlık için ayrı ayrı' },
  { id: 'personalBasket', title: 'Kişisel enflasyon sepeti', detail: 'Kira, gıda, ulaşım… kendi ağırlıklarınla' },
  { id: 'powerChart', title: 'Alım gücü grafiği ve zaman makinesi', detail: 'Birikiminin ay ay gerçek değeri' },
  { id: 'benchmarks', title: 'Kıyas grafiği', detail: 'Dolar, euro, altın, BIST 100, mevduat ve TÜFE ile reel kıyas' },
  { id: 'scenario', title: 'Senaryo hesabı', detail: 'Enflasyon farklı gelirse ne olur' },
  { id: 'alternatives', title: 'Karşılaştırma', detail: 'Dolarda ya da mevduatta tutsaydın' },
  { id: 'goals', title: 'Hedefler ve alarmlar', detail: '“Reel getirim sıfırın altına düşerse haber ver”' },
  { id: 'rateReminders', title: 'Faiz kararı bildirimi', detail: 'TCMB kararı açıklanınca haber' },
  { id: 'portfolios', title: 'Çoklu portföy', detail: 'Senin, eşinin, çocuğunun birikimi ayrı' },
  { id: 'personalInflation', title: 'Kalem kalem kişisel enflasyon', detail: 'Hangi harcaman enflasyonunu ne kadar yükseltiyor' },
  { id: 'netWorth', title: 'Net varlık ve ay sonu karnesi', detail: 'Tüm birikim ve hesapların TL ve dolar olarak; maaşının alım gücü' },
  { id: 'budgetAnalysis', title: 'Bütçe analizleri', detail: 'Geçmiş dönemler, günlük harcama haritası, hesap bazında harcama' },
  { id: 'budgetReminders', title: 'Ödeme günü hatırlatması', detail: 'Fatura ve üyeliklerin vadesinde bildirim' },
];

export function canUse(_feature: PremiumFeature, premium: boolean): boolean {
  return premium;
}

/** Every holding is free; the limit was removed because it left no reason to pay for depth. */
export function canAddHolding(_currentCount: number, _premium: boolean): boolean {
  return true;
}

export type Showcase = { key: 'maturity' | 'wealth' | 'general'; title: string; subtitle: string; lead: PremiumFeature[] };

/** Paywall facts that are set in the stores, repeated here only as labels. */
export const LIFETIME_SEATS = 2000;
export const FOUNDER_YEARLY_UNTIL = '2027-01-31';
export const YEARLY_AFTER_FOUNDER = '₺399,99';

/**
 * One product name, "Paraölçer Premium", always. The subtitle and the first features follow
 * the user's money: deposit holders get the maturity-day pack,
 * people who only hold dollars or gold get the "real wealth" pack. Everything stays included.
 */
export function premiumShowcase(holdings: Holding[]): Showcase {
  const own = holdings.filter((h) => !h.sample);
  if (own.some((h) => h.kind === 'deposit')) {
    return {
      key: 'maturity',
      title: 'Paraölçer Premium',
      subtitle: 'Her vadede paranın nerede daha iyi korunduğunu liralarla gör.',
      lead: ['personalInflation', 'renewForward', 'usdReal'],
    };
  }
  if (own.length > 0 && own.every((h) => h.kind === 'usd' || h.kind === 'eur' || h.kind === 'gbp' || h.kind === 'gold')) {
    return {
      key: 'wealth',
      title: 'Paraölçer Premium',
      subtitle: 'Dövizin ve altının sadece TL’ye değil, kendi enflasyonuna karşı da ölçülsün.',
      lead: ['usdReal', 'personalInflation', 'renewForward'],
    };
  }
  return {
    key: 'general',
    title: 'Paraölçer Premium',
    subtitle: 'Senin enflasyonun kaç? Harcamandan hesaplar, birikimini ona karşı ölçer.',
    lead: ['personalInflation', 'renewForward', 'usdReal'],
  };
}

export type PremiumStatus = {
  active: boolean;
  /** subscription is in its free trial */
  trial: boolean;
  /** ISO time the current period ends; undefined for lifetime or unknown */
  expiresAt?: string;
  /** a one-time "Kurucu Üye" purchase: never expires, nothing to manage or cancel */
  lifetime?: boolean;
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
