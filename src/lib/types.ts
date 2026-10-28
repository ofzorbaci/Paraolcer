export type HoldingKind = 'deposit' | 'usd' | 'eur' | 'gold' | 'stock' | 'fund' | 'other';

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
};

export type InflationSource = 'tuik' | 'custom';

export type Settings = {
  inflationSource: InflationSource;
  /** annual %, used when inflationSource is 'custom' (ENAG or personal) */
  customAnnualRate: number;
  /** remind when TÜİK publishes CPI */
  notifyCpi: boolean;
};

/** Live TRY prices per unit */
export type LivePrices = Partial<Record<'usd' | 'eur' | 'gold', number>>;

export const KIND_LABELS: Record<HoldingKind, string> = {
  deposit: 'TL mevduat',
  usd: 'Dolar',
  eur: 'Euro',
  gold: 'Gram altın',
  stock: 'Hisse',
  fund: 'Fon',
  other: 'Diğer',
};

/** Kinds whose current price is fetched automatically */
export const LIVE_PRICED: HoldingKind[] = ['usd', 'eur', 'gold'];

export function isLivePriced(kind: HoldingKind): kind is 'usd' | 'eur' | 'gold' {
  return LIVE_PRICED.includes(kind);
}
