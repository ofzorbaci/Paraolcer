// Fund and stock closing prices from a licensed data provider. The provider is configured with
// environment variables (GitHub secrets), so changing vendors needs no code change:
//
//   SECURITIES_FUNDS_URL   CSV or JSON list of fund prices (TEFAS codes)
//   SECURITIES_STOCKS_URL  CSV or JSON list of stock prices (BIST tickers)
//   SECURITIES_API_KEY     optional; sent as "Authorization: Bearer <key>"
//   SECURITIES_SOURCE      name shown in the app, e.g. the vendor's name
//
// Accepted shapes: CSV with a header naming code/price/date columns (Turkish or English names,
// comma or semicolon), a JSON array of objects, or a JSON object keyed by code.

import type { SecurityPrice } from '../src/lib/feed-types.ts';

const CODE_KEYS = ['code', 'kod', 'symbol', 'sembol', 'ticker', 'fonkodu', 'fon_kodu', 'hisse'];
const PRICE_KEYS = ['price', 'fiyat', 'close', 'kapanis', 'kapanış', 'last', 'son', 'birimpaydegeri', 'nav'];
const DATE_KEYS = ['date', 'tarih', 'asof', 'as_of', 'day'];

const CODE = /^[A-Z0-9]{2,8}$/;

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const [k, v] of Object.entries(row)) if (keys.includes(k.toLowerCase().replace(/[\s.]/g, ''))) return v;
  return undefined;
}

/** "38,25" / "1.234,56" / "38.25" / 38.25 → number */
function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v ?? '').trim();
  if (!s) return undefined;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : undefined;
}

/** "2026-10-31", "31.10.2026", "31/10/2026" → "2026-10-31" */
function toDate(v: unknown, fallback: string): string {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return fallback;
}

function rowsFrom(body: string): Record<string, unknown>[] {
  const text = body.trim();
  if (text.startsWith('[')) return JSON.parse(text) as Record<string, unknown>[];
  if (text.startsWith('{')) {
    const obj = JSON.parse(text) as Record<string, unknown>;
    // { "data": [ … ] } or { "TTE": 1.23 } or { "TTE": { "price": 1.23, "date": … } }
    const list = Object.values(obj).find(Array.isArray) as Record<string, unknown>[] | undefined;
    if (list) return list;
    return Object.entries(obj).map(([code, v]) => (typeof v === 'object' && v ? { code, ...(v as object) } : { code, price: v }));
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const unquote = (c: string) => c.trim().replace(/^"|"$/g, '');
  const header = lines[0].split(sep).map(unquote);
  return lines.slice(1).map((l) => Object.fromEntries(l.split(sep).map((c, i) => [header[i], unquote(c)])));
}

/** Provider response → prices keyed by code. Rows without a valid code or a positive price are skipped. */
export function parseSecurityPrices(body: string, today: string): Record<string, SecurityPrice> {
  const out: Record<string, SecurityPrice> = {};
  for (const row of rowsFrom(body)) {
    const code = String(pick(row, CODE_KEYS) ?? '').trim().toLocaleUpperCase('tr-TR').replace(/İ/g, 'I');
    const price = toNumber(pick(row, PRICE_KEYS));
    if (!CODE.test(code) || !(price && price > 0)) continue;
    out[code] = { price, date: toDate(pick(row, DATE_KEYS), today) };
  }
  return out;
}

const MAX_AGE_DAYS = 10;
const MAX_JUMP = 0.6;

/**
 * Keeps today's good prices. A price older than ten days is dropped; a move of more than 60% since
 * the last build keeps the previous price and is reported (splits and errors are checked by hand).
 * Codes missing from today's list keep their previous price until it ages out.
 */
export function mergeSecurityPrices(
  fresh: Record<string, SecurityPrice>,
  previous: Record<string, SecurityPrice> | undefined,
  today: string,
): { prices: Record<string, SecurityPrice>; warnings: string[] } {
  const age = (d: string) => (Date.parse(today) - Date.parse(d)) / 86_400_000;
  const prices: Record<string, SecurityPrice> = {};
  const warnings: string[] = [];
  for (const [code, p] of Object.entries(previous ?? {})) if (age(p.date) <= MAX_AGE_DAYS) prices[code] = p;
  for (const [code, p] of Object.entries(fresh)) {
    if (age(p.date) > MAX_AGE_DAYS || p.date > today) continue;
    const prev = previous?.[code];
    if (prev && Math.abs(p.price / prev.price - 1) > MAX_JUMP) {
      warnings.push(`${code}: ${prev.price} → ${p.price}`);
      continue;
    }
    prices[code] = p;
  }
  return { prices, warnings };
}

export type SecuritiesConfig = { fundsUrl?: string; stocksUrl?: string; apiKey?: string; source?: string };

/** The provider settings from the environment, or undefined when none is configured. */
export function securitiesConfig(env: Record<string, string | undefined>): SecuritiesConfig | undefined {
  const c = {
    fundsUrl: env.SECURITIES_FUNDS_URL || undefined,
    stocksUrl: env.SECURITIES_STOCKS_URL || undefined,
    apiKey: env.SECURITIES_API_KEY || undefined,
    source: env.SECURITIES_SOURCE || undefined,
  };
  return c.fundsUrl || c.stocksUrl ? c : undefined;
}

export async function fetchSecurityList(url: string, apiKey: string | undefined, today: string): Promise<Record<string, SecurityPrice>> {
  const res = await fetch(url, { headers: { 'User-Agent': 'paralens-feed', ...(apiKey && { Authorization: `Bearer ${apiKey}` }) } });
  if (!res.ok) throw new Error(`${new URL(url).host} → HTTP ${res.status}`);
  return parseSecurityPrices(await res.text(), today);
}
