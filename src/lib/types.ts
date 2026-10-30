import type { Basket } from './basket';

export type HoldingKind = 'deposit' | 'usd' | 'eur' | 'gold' | 'stock' | 'fund' | 'other';

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
  /** free "Yenilesem mi?" results used this month: the month and the deposits already shown */
  renewUsage?: { month: string; ids: string[] };
  /** Premium: notify when the portfolio's real return turns negative */
  alertRealBelowZero?: boolean;
  /** Premium: a target in the purchasing power of the day it was set */
  goal?: Goal;
  /** the portfolio shown on the summary; undefined is the main one */
  activePortfolio?: string;
  /** extra portfolios besides the main one (Premium) */
  portfolios?: Portfolio[];
};

export type Goal = { amount: number; /** 'YYYY-MM-DD' */ setAt: string };

export type Portfolio = { id: string; name: string };

/** Live TRY prices per unit */
export type LivePrices = Partial<Record<'usd' | 'eur' | 'gold', number>>;

export const KIND_LABELS: Record<HoldingKind, string> = {
  deposit: 'TL mevduat',
  usd: 'Dolar',
  eur: 'Euro',
  gold: 'Altın',
  stock: 'Hisse',
  fund: 'Fon',
  other: 'Diğer',
};

/** Kinds whose current price is fetched automatically */
export const LIVE_PRICED: HoldingKind[] = ['usd', 'eur', 'gold'];

export function isLivePriced(kind: HoldingKind): kind is 'usd' | 'eur' | 'gold' {
  return LIVE_PRICED.includes(kind);
}
