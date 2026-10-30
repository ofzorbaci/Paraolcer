import type { Basket } from './basket';

export type HoldingKind = 'deposit' | 'usd' | 'eur' | 'gbp' | 'gold' | 'stock' | 'fund' | 'other';

/** Foreign currencies held as cash or in a deposit, priced live */
export type CurrencyKind = 'usd' | 'eur' | 'gbp';

export const CURRENCY_SYMBOL: Record<CurrencyKind, string> = { usd: '$', eur: '€', gbp: '£' };

export function isCurrencyKind(kind: string | undefined): kind is CurrencyKind {
  return kind === 'usd' || kind === 'eur' || kind === 'gbp';
}

export type GoldType = 'gram' | 'ceyrek' | 'yarim' | 'tam' | 'cumhuriyet';

export const GOLD_LABELS: Record<GoldType, string> = {
  gram: 'Gram altın',
  ceyrek: 'Çeyrek altın',
  yarim: 'Yarım altın',
  tam: 'Tam altın',
  cumhuriyet: 'Cumhuriyet altını',
};

export type Holding = {
  id: string;
  kind: HoldingKind;
  name: string;
  /** 'YYYY-MM-DD' */
  buyDate: string;
  /** units, grams or currency amount; 1 for deposits */
  quantity: number;
  /** TRY per unit at purchase; for deposits the principal */
  unitCost: number;
  /** TRY per unit, entered by the user when there is no live price */
  currentPrice?: number;
  /** ISO time the current price was entered */
  priceUpdatedAt?: string;
  /** deposits: annual gross interest, % */
  grossRate?: number;
  /**
   * deposits in a foreign currency: quantity is the principal in that currency and unitCost the
   * TRY rate on the deposit day; undefined is a TRY deposit (quantity 1, unitCost the principal)
   */
  depositCurrency?: 'usd' | 'eur';
  /** deposits: term in days; interest compounds at each rollover */
  termDays?: number;
  /** deposits: withholding tax on interest, % */
  withholding?: number;
  /** deposits saved before v2: annual net interest, % (no term, no withholding) */
  depositRate?: number;
  /** gold: bar grams or a coin; quantity is grams for 'gram', pieces otherwise */
  goldType?: GoldType;
  /** part of the example portfolio; shown with a label and removable in one tap */
  sample?: boolean;
  /** which portfolio it belongs to; undefined is the main one */
  portfolioId?: string;
};

export type InflationSource = 'tuik' | 'custom';

export type Settings = {
  inflationSource: InflationSource;
  /** ENAG or personal yearly rate, %. Free users see it as a one-line total; Premium can apply it everywhere. */
  customAnnualRate: number;
  /** Premium: spending weights and price rises behind a personal rate */
  basket?: Basket;
  /** remind when TÜİK publishes CPI */
  notifyCpi: boolean;
  /** remind when TCMB announces a rate decision */
  notifyRate?: boolean;
  /** remind two days before a deposit matures */
  notifyMaturity?: boolean;
  /** ask for Face ID / fingerprint / passcode when the app opens */
  appLock?: boolean;
  /** print every TRY amount as dots */
  hideAmounts?: boolean;
  /** lira differences shown at maturities, for the "Paraölçer showed you ₺X" counter */
  renewLog?: RenewLogEntry[];
  /** Premium: notify when the portfolio's real return turns negative */
  alertRealBelowZero?: boolean;
  /** Premium: a target in the purchasing power of the day it was set */
  goal?: Goal;
  /** the portfolio shown on the summary; undefined is the main one */
  activePortfolio?: string;
  /** extra portfolios besides the main one (Premium) */
  portfolios?: Portfolio[];
};

/** One maturity looked at in full: best option minus rolling over, in today's lira. */
export type RenewLogEntry = { id: string; maturity: string; diff: number };

export type Goal = { amount: number; /** 'YYYY-MM-DD' */ setAt: string };

export type Portfolio = { id: string; name: string };

/** Live TRY prices per unit */
export type LivePrices = Partial<Record<CurrencyKind | 'gold', number>>;

export const KIND_LABELS: Record<HoldingKind, string> = {
  deposit: 'Mevduat',
  usd: 'Dolar',
  eur: 'Euro',
  gbp: 'Sterlin',
  gold: 'Altın',
  stock: 'Hisse',
  fund: 'Fon',
  other: 'Diğer',
};

/** Kinds whose current price is fetched automatically */
export const LIVE_PRICED: HoldingKind[] = ['usd', 'eur', 'gbp', 'gold'];

export function isLivePriced(kind: HoldingKind): kind is CurrencyKind | 'gold' {
  return LIVE_PRICED.includes(kind);
}
