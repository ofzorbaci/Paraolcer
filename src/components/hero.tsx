import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { formatPct, formatTL } from '@/lib/format';
import type { PortfolioAnalysis } from '@/lib/returns';

function verdict(real: number): string {
  if (real >= 0.05) return 'Enflasyonun açık ara önündesin.';
  if (real >= 0) return 'Enflasyonun önündesin, ama kıl payı.';
  if (real > -0.05) return 'Enflasyonun az gerisindesin.';
  return 'Birikimin enflasyon karşısında eriyor.';
}

/** Navy headline card: real return, the verdict, and the three numbers behind it. */
export function HeroCard({
  total,
  inflationLabel,
  own,
  onOwnPress,
  stale = 0,
}: {
  total: PortfolioAnalysis;
  inflationLabel: string;
  /** the same portfolio against the user's ENAG/personal rate */
  own?: { rate: number; real: number };
  onOwnPress?: () => void;
  /** hand-entered prices a week old or more */
  stale?: number;
}) {
  const theme = useTheme();
  const gain = total.realGain;
  useMasked();
  return (
    <View style={[styles.card, { backgroundColor: theme.hero }]}>
      <ThemedText style={[styles.label, { color: theme.heroMuted }]}>Birikimin enflasyona karşı</ThemedText>
      <View style={styles.bigRow}>
        <ThemedText style={[styles.big, { color: theme.heroText }]}>{formatPct(total.real)}</ThemedText>
        <ThemedText style={[styles.unit, { color: theme.heroAccent }]}>reel getiri</ThemedText>
      </View>
      <ThemedText style={[styles.verdict, { color: theme.heroText }]}>{verdict(total.real)}</ThemedText>
      {total.nominal > 0 && total.real < 0 ? (
        <ThemedText type="small" style={{ color: theme.heroMuted }}>
          Kâr görünüyor ama alım gücün azaldı.
        </ThemedText>
      ) : null}
      {own && (
        <Pressable accessibilityRole="button" onPress={onOwnPress} hitSlop={6}>
          <ThemedText type="small" style={{ color: theme.heroMuted }}>
            {inflationLabel}’ye göre {formatPct(total.real)} · senin oranınla (%{String(own.rate).replace('.', ',')}){' '}
            <ThemedText type="smallBold" style={{ color: theme.heroText }}>
              {formatPct(own.real)}
            </ThemedText>
            {onOwnPress ? '  ›' : ''}
          </ThemedText>
        </Pressable>
      )}
      {stale > 0 && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/holdings')} hitSlop={6}>
          <ThemedText type="small" style={{ color: '#FDBA74' }}>
            ⚠ {stale} varlığın fiyatı 7 günden eski; skor eksik olabilir · Fiyatları güncelle ›
          </ThemedText>
        </Pressable>
      )}
      <View style={[styles.divider, { backgroundColor: theme.heroMuted }]} />
      <View style={styles.stats}>
        <Stat label="Nominal" value={formatPct(total.nominal, false)} />
        <Stat label={inflationLabel} value={formatPct(total.inflation, false)} />
        <Stat label="Alım gücü" value={`${gain >= 0 ? '+' : '−'}${formatTL(Math.abs(gain))}`} />
      </View>
      <Pressable accessibilityRole="link" onPress={() => router.push('/method')} hitSlop={8}>
        <ThemedText type="small" style={{ color: theme.heroAccent }}>
          Nasıl hesaplandı? ›
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <ThemedText type="small" style={{ color: theme.heroMuted }}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.statValue, { color: theme.heroText }]} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: 24, gap: Spacing.two },
  label: { fontSize: 16 },
  bigRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: Spacing.two },
  big: { fontSize: 56, lineHeight: 66, fontWeight: 800, letterSpacing: -1 },
  unit: { fontSize: 17, fontWeight: 600 },
  verdict: { fontSize: 20, lineHeight: 27, fontWeight: 700 },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.4, marginVertical: Spacing.two },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: 700 },
});
