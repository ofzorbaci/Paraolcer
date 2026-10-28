import { KIND_LABELS, type Holding, type HoldingKind, type Settings } from './types';
import type { PriceBook } from './prices';

export const SUPPORT_EMAIL = 'ofzorbaci@gmail.com';

export type Diagnostics = {
  appVersion: string;
  platform: string;
  device?: string;
  settings: Settings;
  cpiLast: string;
  cpiLive: boolean;
  priceBook: PriceBook;
  priceError?: string;
  holdings: Holding[];
};

/**
 * Bug-report email. It names the app state needed to reproduce a problem but leaves out
 * every amount: only how many holdings of each kind there are.
 */
export function bugReportUrl(d: Diagnostics): string {
  const counts = new Map<HoldingKind, number>();
  for (const h of d.holdings) counts.set(h.kind, (counts.get(h.kind) ?? 0) + 1);
  const holdings = [...counts].map(([k, n]) => `${KIND_LABELS[k]}: ${n}`).join(', ') || 'yok';
  const prices = Object.entries(d.priceBook)
    .map(([k, q]) => `${k} ${q!.source} ${q!.fetchedAt.slice(0, 16)}`)
    .join('; ') || 'yok';

  const body = [
    'Sorunu kısaca anlat:',
    '',
    '',
    '— Otomatik eklenen bilgiler (tutar içermez) —',
    `Uygulama: ${d.appVersion}`,
    `Cihaz: ${d.platform}${d.device ? `, ${d.device}` : ''}`,
    `Enflasyon kaynağı: ${d.settings.inflationSource}${d.settings.inflationSource === 'custom' ? ` (%${d.settings.customAnnualRate})` : ''}`,
    `Son TÜFE: ${d.cpiLast} (${d.cpiLive ? 'canlı' : 'uygulama içi'})`,
    `Fiyatlar: ${prices}`,
    `Fiyat hatası: ${d.priceError ?? 'yok'}`,
    `Varlıklar: ${holdings}`,
  ].join('\n');

  const subject = `Hata bildirimi · Paraölçer ${d.appVersion}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
