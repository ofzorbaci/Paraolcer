import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatRate } from '@/lib/format';
import { useStore } from '@/state/store';

/** "Türkiye dünyada nerede?": the latest yearly CPI change of a few economies, from the World Bank. */
export function WorldInflationCard() {
  const theme = useTheme();
  const world = useStore((s) => s.feed.worldInflation);
  if (!world?.items.length) return null;
  const max = Math.max(...world.items.map((i) => i.value), 1);
  const items = [...world.items].sort((a, b) => b.value - a.value);
  return (
    <Card>
      <ThemedText style={styles.title}>Türkiye dünyada nerede?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Yıllık tüketici enflasyonu, Dünya Bankası’nın son yayımladığı yıl
      </ThemedText>
      {items.map((i) => {
        const tr = i.code === 'TUR';
        return (
          <View key={i.code} style={styles.row} accessibilityLabel={`${i.name} ${formatRate(i.value)}, ${i.year}`}>
            <ThemedText type={tr ? 'smallBold' : 'small'} style={styles.name}>
              {i.name}
            </ThemedText>
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  { width: `${Math.max(2, (Math.max(0, i.value) / max) * 100)}%`, backgroundColor: tr ? theme.accent : theme.textSecondary },
                  !tr && styles.dim,
                ]}
              />
            </View>
            <ThemedText type={tr ? 'smallBold' : 'small'} style={styles.value}>
              {formatRate(i.value)}
            </ThemedText>
          </View>
        );
      })}
      <ThemedText type="small" themeColor="textSecondary">
        Kaynak: {world.source}, CC BY 4.0 · {[...new Set(world.items.map((i) => i.year))].sort().join(', ')}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, lineHeight: 24, fontWeight: 700 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { width: 110 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  dim: { opacity: 0.45 },
  value: { width: 64, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
