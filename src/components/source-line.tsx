import { ThemedText } from '@/components/themed-text';
import { formatMoney, formatMonth, formatStamp, todayISO } from '@/lib/format';
import { closeLabel } from '@/lib/funds';
import type { PriceKey, PriceQuote } from '@/lib/prices';
import { feedQuote } from '@/lib/securities';
import { isCurrencyKind, type Holding } from '@/lib/types';
import { useStore } from '@/state/store';

/** "ECB · 28 Eki 14:32" */
export function quoteLabel(q: PriceQuote): string {
  return `${q.source} · ${formatStamp(q.fetchedAt)}`;
}

/** Where an automatically priced holding's price came from and when; nothing for hand-entered prices. */
export function HoldingSource({ holding }: { holding: Pick<Holding, 'kind' | 'name'> }) {
  const kind = holding.kind;
  const q = useStore((s) => (isCurrencyKind(kind) || kind === 'gold' ? s.priceBook[kind as PriceKey] : undefined));
  // Re-render when a new fund book arrives (feedQuote reads it from lib/securities).
  useStore((s) => s.funds?.fetchedAt);
  const close = feedQuote(holding, useStore((s) => s.feed.securities), useStore((s) => s.feed.usQuotes));
  const usd = useStore((s) => s.priceBook.usd);
  if (close) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Fiyat: {close.source} · {closeLabel(close.date, todayISO())}
        {close.currency === 'USD' ? ` · ${formatMoney(close.price, '$', true)}${usd ? `, kur ${quoteLabel(usd)}` : ''}` : ''}
      </ThemedText>
    );
  }
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
  const custom = useStore((s) => s.calcSettings.inflationSource === 'custom');
  const parts = [custom ? 'Enflasyon: senin oranın' : `TÜFE: ${formatMonth(cpiMonth)} (TÜİK)`];
  if (book.usd) parts.push(`Kur: ${quoteLabel(book.usd)}`);
  if (book.gold) parts.push(`Altın: ${quoteLabel(book.gold)}`);
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {parts.join(' · ')}. Kurlar günlük referans, altın anlık ons fiyatıdır.
    </ThemedText>
  );
}
