import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { openPaywall, usePremium } from '@/components/premium-gate';
import { HoldingSource } from '@/components/source-line';
import { ThemedText } from '@/components/themed-text';
import { Card, Pct, StatStrip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { defaultWithholding } from '@/lib/deposit';
import { formatDate, formatPct, formatRate, formatTL, todayISO } from '@/lib/format';
import { usdReal } from '@/lib/usd-real';
import { priceAgeDays } from '@/lib/lookup';
import { nextMaturity } from '@/lib/renew';
import type { HoldingAnalysis } from '@/lib/returns';
import { isLivePriced, KIND_LABELS, type Holding } from '@/lib/types';
import { useStore } from '@/state/store';

const qty = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

/** A hand-entered price older than this gets a reminder on the card and next to the score. */
export const STALE_DAYS = 7;

/** Hand-priced holdings whose price is a week old or more. */
export function staleHoldings(holdings: Holding[], now: Date): Holding[] {
  return holdings.filter((h) => h.kind !== 'deposit' && !isLivePriced(h.kind) && (priceAgeDays(h, now) ?? 0) >= STALE_DAYS);
}

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
  useMasked();
  const losing = a.real !== undefined && a.real < 0;
  const maturity = nextMaturity(h, todayISO());
  const age = h.kind !== 'deposit' && !isLivePriced(h.kind) ? priceAgeDays(h, new Date()) : undefined;
  const premium = usePremium();
  const prices = useStore((s) => s.prices);
  const feed = useStore((s) => s.feed);
  const dollarBased = h.kind === 'usd' || h.kind === 'eur' || h.kind === 'gold';
  const usd = dollarBased && premium ? usdReal(h, a, prices, feed) : undefined;
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
          {age !== undefined && h.priceUpdatedAt && (
            <ThemedText type="small" style={age >= STALE_DAYS ? { color: theme.negative } : undefined} themeColor="textSecondary">
              Fiyat: {formatDate(h.priceUpdatedAt.slice(0, 10))}
              {age >= STALE_DAYS ? ` · ${age} gün önce girildi, güncellemek için dokun` : ''}
            </ThemedText>
          )}
          {dollarBased &&
            (premium ? (
              usd !== undefined && (
                <View style={styles.usdRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                    Dolar bazında reel (ABD enflasyonuyla)
                  </ThemedText>
                  <Pct ratio={usd} size={15} />
                </View>
              )
            ) : (
              <Pressable accessibilityRole="button" onPress={() => openPaywall('usdReal')} hitSlop={6}>
                <ThemedText type="small" style={{ color: theme.accent }}>
                  🔒 Dolar bazında reel getiri · Premium
                </ThemedText>
              </Pressable>
            ))}
          {h.kind === 'deposit' && h.grossRate !== undefined && (
            <ThemedText type="small" themeColor="textSecondary">
              {h.termDays} gün vade · %{String(h.withholding ?? defaultWithholding(h.termDays ?? 32)).replace('.', ',')} stopaj
              {maturity ? ` · sonraki vade ${formatDate(maturity)}` : ''}
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
  usdRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
