import { ThemedText } from '@/components/themed-text';
import { formatMonth, formatStamp } from '@/lib/format';
import type { PriceKey, PriceQuote } from '@/lib/prices';
import type { HoldingKind } from '@/lib/types';
import { useStore } from '@/state/store';

/** "ECB · 28 Eki 14:32" */
export function quoteLabel(q: PriceQuote): string {
  return `${q.source} · ${formatStamp(q.fetchedAt)}`;
}

/** Where a live-priced holding's price came from and when; nothing for hand-entered prices. */
export function HoldingSource({ kind }: { kind: HoldingKind }) {
  const q = useStore((s) => (kind === 'usd' || kind === 'eur' || kind === 'gold' ? s.priceBook[kind as PriceKey] : undefined));
  if (!q) return null;
  return (
    <ThemedText type="small" themeColor="textSecondary">
      Fiyat: {quoteLabel(q)}
    </ThemedText>
  );
}

/** One line naming every source behind the summary. */
export function SourcesFooter() {
  const book = useStore((s) => s.priceBook);
  const cpiMonth = useStore((s) => s.cpi.rows[s.cpi.rows.length - 1].month);
  const custom = useStore((s) => s.settings.inflationSource === 'custom');
  const parts = [custom ? 'Enflasyon: senin oranın' : `TÜFE: ${formatMonth(cpiMonth)} (TÜİK)`];
  if (book.usd) parts.push(`Kur: ${quoteLabel(book.usd)}`);
  if (book.gold) parts.push(`Altın: ${quoteLabel(book.gold)}`);
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {parts.join(' · ')}. Kurlar günlük referans, altın anlık ons fiyatıdır.
    </ThemedText>
  );
}
