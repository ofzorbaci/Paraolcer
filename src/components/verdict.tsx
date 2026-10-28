import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMonth, formatPct, formatTL } from '@/lib/format';
import type { PortfolioAnalysis } from '@/lib/returns';

/** The headline answer: did the money grow faster than prices? */
export function VerdictCard({
  total,
  cpiLast,
  customRate,
}: {
  total: PortfolioAnalysis;
  cpiLast: string;
  customRate?: number;
}) {
  const theme = useTheme();
  const up = total.real >= 0;
  const color = up ? theme.positive : theme.negative;

  return (
    <Card style={{ backgroundColor: up ? theme.positiveSoft : theme.negativeSoft }}>
      <ThemedText type="smallBold" style={{ color }}>
        {up ? 'Enflasyonu yeniyorsun' : 'Enflasyona yeniliyorsun'}
      </ThemedText>
      <ThemedText style={[styles.big, { color }]}>{formatPct(total.real)}</ThemedText>
      <ThemedText type="small">
        {up
          ? `Satın alma gücün ${formatTL(total.realGain)} arttı.`
          : `Satın alma gücün ${formatTL(-total.realGain)} eridi.`}
        {total.nominal > 0 && !up ? ' Kâğıt üzerinde kârdasın ama bu gerçek bir kazanç değil.' : ''}
      </ThemedText>

      <View style={styles.divider} />
      <Row label="Nominal getiri" value={formatPct(total.nominal)} />
      <Row
        label={customRate === undefined ? 'Aynı dönemde TÜFE' : `Aynı dönemde enflasyon (%${customRate})`}
        value={formatPct(total.inflation)}
      />
      <Row label="Yatırdığın" value={formatTL(total.cost)} />
      <Row label="Bugünkü değeri" value={formatTL(total.value)} strong />
      <Row label="Sadece korunmak için gereken" value={formatTL(total.breakEven)} />

      {total.unpriced > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {total.unpriced} varlığın güncel fiyatı girilmediği için hesaba katılmadı.
        </ThemedText>
      )}
      {total.incomplete && customRate === undefined && (
        <ThemedText type="small" themeColor="textSecondary">
          TÜFE {formatMonth(cpiLast)} verisine kadar hesaplandı; sonraki aylar açıklanınca güncellenecek.
        </ThemedText>
      )}
    </Card>
  );
}

export type Bar = { label: string; value: number; highlight?: boolean };

/** Horizontal bars, scaled to the largest value. */
export function CompareBars({ bars }: { bars: Bar[] }) {
  const theme = useTheme();
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <View style={styles.bars}>
      {bars.map((b) => (
        <View key={b.label} style={styles.barRow}>
          <View style={styles.barLabels}>
            <ThemedText type={b.highlight ? 'smallBold' : 'small'}>{b.label}</ThemedText>
            <ThemedText type={b.highlight ? 'smallBold' : 'small'}>{formatTL(b.value)}</ThemedText>
          </View>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.fill,
                { width: `${(b.value / max) * 100}%`, backgroundColor: b.highlight ? theme.accent : theme.textSecondary },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 44, lineHeight: 52, fontWeight: 700 },
  divider: { height: Spacing.one },
  bars: { gap: 12 },
  barRow: { gap: Spacing.one },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});
