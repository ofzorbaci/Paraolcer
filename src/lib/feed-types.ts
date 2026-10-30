// Shape of the data feed built by feed/build.mts and read by the app.
// Kept free of imports so the Node build script can load it directly.

export const FEED_VERSION = 1;

export type FeedCpiRow = { month: string; yoy: number; mom: number };

export type WithholdingTier = {
  /** applies to terms up to this many days; null for anything longer */
  maxDays: number | null;
  rate: number;
};

export type CpiGroupKey = 'housing' | 'food' | 'transport' | 'education' | 'health' | 'other';

export type Feed = {
  version: typeof FEED_VERSION;
  generatedAt: string;
  cpi: { rows: FeedCpiRow[]; source: string };
  /** one-week repo rate, newest last */
  policyRate: { history: { from: string; rate: number }[]; source: string };
  rateDecisions: { dates: string[]; time: string; source: string };
  expectations: {
    /** 'YYYY-MM' survey month */
    month: string;
    next12m: { market: number; realSector: number; household: number };
    source: string;
  };
  withholding: { tiers: WithholdingTier[]; validUntil: string; source: string };
  /** month-end USD/TRY (ECB) and monthly average gold, USD per troy ounce (World Bank), oldest first */
  markets?: {
    usdTry: { month: string; value: number }[];
    goldUsdOz: { month: string; value: number }[];
    source: string;
  };
  /** US CPI-U (all items, seasonally adjusted) index by month, for dollar-based real returns */
  usCpi?: { rows: { month: string; value: number }[]; source: string };
  /** banks' weighted average TRY deposit rates for new deposits, latest week, by term */
  depositRates?: { date: string; byTerm: { maxDays: number | null; rate: number }[]; source: string };
  /** TÜİK CPI main groups mapped onto the personal basket: yearly change, % and 2026 weights, % */
  cpiGroups?: {
    month: string;
    yoy: Record<CpiGroupKey, number>;
    weights: Record<CpiGroupKey, number>;
    /** headline yearly CPI the groups add up to */
    general: number;
    source: string;
  };
  /** problems the last build ran into; the affected sections keep their previous values */
  errors: string[];
};
