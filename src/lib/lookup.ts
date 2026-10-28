import type { Holding, HoldingKind } from './types';

const CODE = /^[A-Z0-9]{2,8}$/;

/** Uppercased ticker or fund code, if the name looks like one. */
export function assetCode(name: string): string | undefined {
  const code = name.trim().toLocaleUpperCase('tr-TR').replace(/İ/g, 'I');
  return CODE.test(code) ? code : undefined;
}

/** Public page where the user can read today's price: TradingView for BIST, TEFAS for funds. */
export function priceLookup(kind: HoldingKind, name: string): { url: string; site: string } | undefined {
  const code = assetCode(name);
  if (!code) return undefined;
  if (kind === 'stock') return { url: `https://www.tradingview.com/symbols/BIST-${code}/`, site: 'TradingView' };
  if (kind === 'fund') return { url: `https://www.tefas.gov.tr/tr/fon-detayli-analiz/${code}`, site: 'TEFAS' };
  return undefined;
}

/** Whole days since a manually entered price, or undefined if it was never entered. */
export function priceAgeDays(h: Holding, now: Date): number | undefined {
  if (!h.priceUpdatedAt) return undefined;
  return Math.floor((now.getTime() - Date.parse(h.priceUpdatedAt)) / 86_400_000);
}
