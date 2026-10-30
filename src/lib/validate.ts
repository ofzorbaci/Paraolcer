import { goldPureGrams } from './gold';
import { formatTL } from './format';
import { isCurrencyKind, type Holding, type LivePrices } from './types';

/** A save-blocking check would be an error; these only ask "are you sure?". */
export type Warning = { field: string; message: string };

const HUGE_TOTAL = 50_000_000;

type Context = {
  /** ECB rate on the purchase day, for currency holdings */
  referenceRate?: number;
  prices: LivePrices;
};

function off(actual: number, reference: number): number {
  return Math.abs(actual / reference - 1);
}

/** Plausibility checks for hand-entered numbers, in the spirit of "₺27 trillion? Are you sure?". */
export function plausibilityWarnings(h: Holding, ctx: Context): Warning[] {
  const out: Warning[] = [];
  const total = h.quantity * h.unitCost;

  if (total >= HUGE_TOTAL) {
    out.push({ field: 'total', message: `Bu kayıt ${formatTL(total)} ediyor. Tutarı ve miktarı kontrol et.` });
  }

  if (h.kind === 'deposit') {
    // Foreign-currency deposits pay a few percent; TRY deposits tens of percent.
    const [lo, hi] = h.depositCurrency ? [0, 20] : [1, 150];
    if (h.grossRate !== undefined && (h.grossRate > hi || h.grossRate < lo)) {
      out.push({ field: 'gross', message: `Yıllık %${h.grossRate} faiz alışılmadık. Aylık değil yıllık oranı gir.` });
    }
    if (h.termDays !== undefined && h.termDays > 3650) {
      out.push({ field: 'term', message: `${h.termDays} gün vade 10 yıldan uzun. Gün olarak girdiğinden emin ol.` });
    }
  }

  if ((isCurrencyKind(h.kind) || h.depositCurrency) && ctx.referenceRate && off(h.unitCost, ctx.referenceRate) > 0.3) {
    out.push({
      field: 'cost',
      message: `Alış kuru o günün referans kurundan (${formatTL(ctx.referenceRate, true)}) çok farklı.`,
    });
  }

  if (h.kind === 'gold' && ctx.prices.gold) {
    const today = ctx.prices.gold * goldPureGrams(h.goldType);
    if (h.unitCost > today * 2 || h.unitCost < today * 0.1) {
      out.push({ field: 'cost', message: `Birim alış fiyatı bugünkü değerin (${formatTL(today)}) çok dışında.` });
    }
  }

  if (h.currentPrice !== undefined && (h.currentPrice > h.unitCost * 10 || h.currentPrice < h.unitCost / 10)) {
    out.push({ field: 'current', message: 'Güncel fiyat alış fiyatının 10 katından fazla farklı. Kuruş/lira karışmış olabilir.' });
  }

  return out;
}
