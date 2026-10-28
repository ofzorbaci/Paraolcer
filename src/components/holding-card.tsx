import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { HoldingSource } from '@/components/source-line';
import { ThemedText } from '@/components/themed-text';
import { Card, Pct, StatStrip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { defaultWithholding } from '@/lib/deposit';
import { formatPct, formatRate, formatTL } from '@/lib/format';
import { priceAgeDays } from '@/lib/lookup';
import type { HoldingAnalysis } from '@/lib/returns';
import { isLivePriced, KIND_LABELS, type Holding } from '@/lib/types';

const qty = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

/** A hand-entered price older than this gets a reminder on the card. */
const STALE_DAYS = 7;

/** "Gram altın · 20 gr", "Dolar · $2.000" */
export function holdingTitle(h: Holding): string {
  const base = h.name || KIND_LABELS[h.kind];
  switch (h.kind) {
    case 'gold':
      return `${base} · ${qty.format(h.quantity)} ${(h.goldType ?? 'gram') === 'gram' ? 'gr' : 'adet'}`;
    case 'usd':
      return `${base} · $${qty.format(h.quantity)}`;
    case 'eur':
      return `${base} · €${qty.format(h.quantity)}`;
    case 'stock':
    case 'fund':
      return `${base} · ${qty.format(h.quantity)} adet`;
    default:
      return base;
  }
}

export function HoldingCard({ holding: h, analysis: a }: { holding: Holding; analysis: HoldingAnalysis }) {
  const theme = useTheme();
  const losing = a.real !== undefined && a.real < 0;
  const age = h.kind !== 'deposit' && !isLivePriced(h.kind) ? priceAgeDays(h, new Date()) : undefined;
  const stats =
    h.kind === 'deposit' && h.grossRate !== undefined
      ? [
          { label: 'Brüt faiz', value: formatRate(h.grossRate) },
          { label: 'Net getiri', value: a.nominal === undefined ? '—' : formatPct(a.nominal, false) },
          { label: 'Reel', value: <Pct ratio={a.real} /> },
        ]
      : [
          { label: 'TL getiri', value: a.nominal === undefined ? '—' : formatPct(a.nominal, false) },
          { label: 'TÜFE', value: formatPct(a.inflation.factor - 1, false) },
          { label: 'Reel', value: <Pct ratio={a.real} /> },
        ];

  return (
    <Link href={{ pathname: '/holding/[id]', params: { id: h.id } }} asChild>
      <Pressable accessibilityRole="button">
        <Card style={losing ? { borderColor: theme.negativeBorder } : undefined}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {holdingTitle(h)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatTL(a.cost)} → {a.value === undefined ? 'fiyat bekleniyor' : formatTL(a.value)}
              </ThemedText>
            </View>
            <Pct ratio={a.real} size={26} />
          </View>
          <StatStrip stats={stats} negative={losing} />
          {losing && (
            <ThemedText type="small" style={{ color: theme.negative }}>
              {a.nominal !== undefined && a.nominal > 0 ? 'Kâr görünüyor ama alım gücün azaldı.' : 'Alım gücün azaldı.'}
            </ThemedText>
          )}
          {a.value === undefined && (
            <ThemedText type="small" themeColor="textSecondary">
              Güncel fiyatı girmek için dokun.
            </ThemedText>
          )}
          <HoldingSource kind={h.kind} />
          {age !== undefined && age >= STALE_DAYS && (
            <ThemedText type="small" themeColor="textSecondary">
              Fiyat {age} gün önce girildi · güncellemek için dokun
            </ThemedText>
          )}
          {h.kind === 'deposit' && h.grossRate !== undefined && (
            <ThemedText type="small" themeColor="textSecondary">
              {h.termDays} gün vade · %{String(h.withholding ?? defaultWithholding(h.termDays ?? 32)).replace('.', ',')} stopaj
            </ThemedText>
          )}
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  name: { fontSize: 20, lineHeight: 27, fontWeight: 700 },
});
