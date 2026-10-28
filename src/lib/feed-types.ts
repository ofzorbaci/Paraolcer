// Shape of the data feed built by feed/build.mts and read by the app.
// Kept free of imports so the Node build script can load it directly.

export const FEED_VERSION = 1;

export type FeedCpiRow = { month: string; yoy: number; mom: number };

export type WithholdingTier = {
  /** applies to terms up to this many days; null for anything longer */
  maxDays: number | null;
  rate: number;
};

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
  /** problems the last build ran into; the affected sections keep their previous values */
  errors: string[];
};
