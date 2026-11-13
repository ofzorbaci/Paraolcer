// TEFAS fund prices from the public files data-pipeline/sync.py publishes on GitHub Pages
// (funds/latest.json). Pure parsing and labelling; the download and cache live in fund-service.ts.
// Only the same public file everyone downloads is fetched: nothing about the user's holdings
// leaves the phone, not even which fund codes they hold.

export const FUND_SCHEMA = 1;

export type FundReturns = { m1: number | null; m3: number | null; m6: number | null; ytd: number | null; y1: number | null };

export type FundInfo = {
  code: string;
  name: string;
  /** YAT, EMK or BYF */
  kind: string;
  /** TRY per unit */
  price: number;
  /** 'YYYY-MM-DD' the price belongs to */
  date: string;
  aum: number | null;
  investors: number | null;
  returns: Partial<FundReturns>;
};

export type FundBook = {
  source: string;
  updatedAt: string;
  funds: Record<string, FundInfo>;
};

/** latest.json → a book keyed by code; undefined if the file is not what we expect. */
export function parseFundLatest(body: unknown): FundBook | undefined {
  const b = body as { schema?: number; source?: string; updatedAt?: string; funds?: unknown[] };
  if (!b || b.schema !== FUND_SCHEMA || !Array.isArray(b.funds) || typeof b.source !== 'string') return undefined;
  const funds: Record<string, FundInfo> = {};
  for (const raw of b.funds) {
    const f = raw as FundInfo;
    if (!f || typeof f.code !== 'string' || !(f.price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(f.date ?? '')) continue;
    funds[f.code.toUpperCase()] = {
      code: f.code.toUpperCase(),
      name: String(f.name ?? ''),
      kind: String(f.kind ?? ''),
      price: f.price,
      date: f.date,
      aum: typeof f.aum === 'number' ? f.aum : null,
      investors: typeof f.investors === 'number' ? f.investors : null,
      returns: f.returns ?? {},
    };
  }
  if (Object.keys(funds).length === 0) return undefined;
  return { source: b.source, updatedAt: String(b.updatedAt ?? ''), funds };
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * How old a price is, honestly: "Bugünkü fiyat · 11 Kasım", "Dünkü kapanış · 10 Kasım",
 * "Son kapanış · 7 Kasım". Never "bugün" for a price from an earlier day.
 */
export function closeLabel(date: string, today: string): string {
  const [, m, d] = date.split('-').map(Number);
  const day = `${d} ${MONTHS[m - 1]}`;
  if (date === today) return `Bugünkü fiyat · ${day}`;
  if (date === addDays(today, -1)) return `Dünkü kapanış · ${day}`;
  return `Son kapanış · ${day}`;
}

/** "TEFAS · Dünkü kapanış · 10 Kasım" */
export function fundSourceLine(f: Pick<FundInfo, 'date'>, source: string, today: string): string {
  return `${source} · ${closeLabel(f.date, today)}`;
}

/** The public file next to feed.json: https://…/ParaLens/feed.json → https://…/ParaLens/funds/latest.json */
export function fundLatestUrl(feedUrl: string): string {
  return feedUrl.replace(/[^/]*$/, 'funds/latest.json');
}

/** True when the cached book should be refreshed: not yet downloaded on this calendar day. */
export function fundBookStale(fetchedAt: string | undefined, today: string): boolean {
  return !fetchedAt || fetchedAt.slice(0, 10) < today;
}

/** funds/daily/<YYYY-MM>.json: every fund's price on every trading day of one month. */
export type FundMonth = { month: string; dates: string[]; prices: Record<string, (number | null)[]> };

export function parseFundMonth(body: unknown): FundMonth | undefined {
  const b = body as { schema?: number; month?: string; dates?: unknown; prices?: unknown };
  if (!b || b.schema !== FUND_SCHEMA || typeof b.month !== 'string' || !Array.isArray(b.dates) || !b.prices || typeof b.prices !== 'object') {
    return undefined;
  }
  return { month: b.month, dates: b.dates as string[], prices: b.prices as FundMonth['prices'] };
}

/** The fund's price on `date`, or on the last trading day before it within the month. */
export function priceOnDate(month: FundMonth, code: string, date: string): { price: number; date: string } | undefined {
  const row = month.prices[code.toUpperCase()];
  if (!row) return undefined;
  for (let i = month.dates.length - 1; i >= 0; i--) {
    const p = row[i];
    if (month.dates[i] <= date && typeof p === 'number' && p > 0) return { price: p, date: month.dates[i] };
  }
  return undefined;
}

/** https://…/feed.json → https://…/funds/daily/2025-10.json */
export function fundMonthUrl(feedUrl: string, month: string): string {
  return feedUrl.replace(/[^/]*$/, `funds/daily/${month}.json`);
}

/** 'YYYY-MM' of the month before. */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** us/daily/<YYYY-MM>.json: US stocks and ETFs (`stocks`) and coins (`crypto`), USD closes. */
export type UsMonth = { month: string; dates: string[]; stocks: Record<string, (number | null)[]>; crypto: Record<string, (number | null)[]> };

export function parseUsMonth(body: unknown): UsMonth | undefined {
  const b = body as { schema?: number; month?: string; dates?: unknown; stocks?: unknown; crypto?: unknown };
  if (!b || b.schema !== FUND_SCHEMA || typeof b.month !== 'string' || !Array.isArray(b.dates)) return undefined;
  return {
    month: b.month,
    dates: b.dates as string[],
    stocks: (b.stocks ?? {}) as UsMonth['stocks'],
    crypto: (b.crypto ?? {}) as UsMonth['crypto'],
  };
}

/** The US month as a FundMonth for one group, so `priceOnDate` works on it. */
export function usGroup(month: UsMonth, crypto: boolean): FundMonth {
  return { month: month.month, dates: month.dates, prices: crypto ? month.crypto : month.stocks };
}

/** https://…/feed.json → https://…/us/daily/2025-10.json */
export function usMonthUrl(feedUrl: string, month: string): string {
  return feedUrl.replace(/[^/]*$/, `us/daily/${month}.json`);
}
