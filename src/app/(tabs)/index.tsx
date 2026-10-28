import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, ReturnPill, Screen } from '@/components/ui';
import { CompareBars, VerdictCard, type Bar } from '@/components/verdict';
import { Spacing } from '@/constants/theme';
import { useCurrencyBenchmarks, usePortfolio } from '@/hooks/use-portfolio';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatTL } from '@/lib/format';
import { KIND_LABELS } from '@/lib/types';
import { useStore } from '@/state/store';

export default function SummaryScreen() {
  const theme = useTheme();
  const ready = useStore((s) => s.ready);
  const { items, total, cpiLast, settings } = usePortfolio();
  const priced = items.filter((i) => i.analysis.value !== undefined).map((i) => i.holding);
  const bench = useCurrencyBenchmarks(priced);
  const customRate = settings.inflationSource === 'custom' ? settings.customAnnualRate : undefined;

  const bars: Bar[] = total
    ? [
        { label: 'Senin portföyün', value: total.value, highlight: true },
        { label: customRate === undefined ? 'TÜFE kadar artsaydı' : 'Enflasyon kadar artsaydı', value: total.breakEven },
        ...(bench.data.usd ? [{ label: 'Dolar alsaydın', value: bench.data.usd }] : []),
        ...(bench.data.eur ? [{ label: 'Euro alsaydın', value: bench.data.eur }] : []),
      ]
    : [];

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Gerçek Getiri</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Paran gerçekten büyüyor mu, yoksa sadece rakamlar mı?
        </ThemedText>
      </View>

      {ready && items.length === 0 && (
        <Card>
          <ThemedText type="smallBold">Başlamak için ilk yatırımını ekle</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ne zaman, neye, ne kadar yatırdığını gir. Aynı dönemdeki enflasyonla karşılaştırıp satın alma gücünün
            artıp artmadığını gösterelim.
          </ThemedText>
          <Button title="Yatırım ekle" onPress={() => router.push('/holding/edit')} />
        </Card>
      )}

      {total && <VerdictCard total={total} cpiLast={cpiLast} customRate={customRate} />}

      {total && (
        <Card>
          <ThemedText type="smallBold">Başka ne yapabilirdin?</ThemedText>
          <CompareBars bars={bars} />
          {bench.loading && (
            <ThemedText type="small" themeColor="textSecondary">
              Döviz karşılaştırması yükleniyor…
            </ThemedText>
          )}
        </Card>
      )}

      {items.length > 0 && (
        <View style={styles.listHeader}>
          <ThemedText type="smallBold">Varlıklar</ThemedText>
          <Link href="/holding/edit" asChild>
            <Pressable accessibilityRole="button" hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                + Ekle
              </ThemedText>
            </Pressable>
          </Link>
        </View>
      )}

      {items.map(({ holding: h, analysis: a }) => (
        <Link key={h.id} href={{ pathname: '/holding/[id]', params: { id: h.id } }} asChild>
          <Pressable accessibilityRole="button">
            <Card style={styles.item}>
              <View style={styles.itemText}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {h.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {KIND_LABELS[h.kind]} · {formatDate(h.buyDate)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatTL(a.cost)} → {a.value === undefined ? 'güncel fiyat gir' : formatTL(a.value)}
                </ThemedText>
              </View>
              <View style={styles.itemRight}>
                <ReturnPill ratio={a.real} />
                <ThemedText type="small" themeColor="textSecondary">
                  reel
                </ThemedText>
              </View>
            </Card>
          </Pressable>
        </Link>
      ))}

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  item: { flexDirection: 'row', alignItems: 'center' },
  itemText: { flex: 1, gap: Spacing.half },
  itemRight: { alignItems: 'flex-end', gap: Spacing.half },
});
