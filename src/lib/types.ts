export type HoldingKind = 'deposit' | 'usd' | 'eur' | 'gold' | 'stock' | 'fund' | 'other';

export type Holding = {
  id: string;
  kind: HoldingKind;
  name: string;
  /** 'YYYY-MM-DD' */
  buyDate: string;
  /** units, grams or currency amount; 1 for deposits */
  quantity: number;
  /** TRY per unit at purchase */
  unitCost: number;
  /** TRY per unit, entered by the user for kinds without a live price */
  currentPrice?: number;
  /** ISO time the current price was entered */
  priceUpdatedAt?: string;
  /** deposits only: annual net interest, % */
  depositRate?: number;
};

export type InflationSource = 'tuik' | 'custom';

export type Settings = {
  inflationSource: InflationSource;
  /** annual %, used when inflationSource is 'custom' (ENAG or personal) */
  customAnnualRate: number;
};

/** TRY per 1 unit of foreign currency, keyed by currency */
export type FxQuotes = Partial<Record<'usd' | 'eur', number>>;

export const KIND_LABELS: Record<HoldingKind, string> = {
  deposit: 'TL Mevduat',
  usd: 'Dolar',
  eur: 'Euro',
  gold: 'Altın (gram)',
  stock: 'Hisse (BIST)',
  fund: 'Fon (TEFAS)',
  other: 'Diğer',
};

/** Kinds whose current price is fetched automatically */
export const LIVE_PRICED: HoldingKind[] = ['usd', 'eur'];
