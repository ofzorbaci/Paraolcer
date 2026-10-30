import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useMasked } from '@/hooks/use-masked';
import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Card, Disclaimer, Field, IconButton, Pct, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { inflationFor } from '@/lib/cpi';
import { formatMonth, formatPct, formatTL, parseAmount, todayISO } from '@/lib/format';
import { realReturn } from '@/lib/returns';
import { useStore } from '@/state/store';

/** One-off check without saving anything: "I put X in on date D, it is worth Y now." */
export default function CalculatorScreen() {
  useMasked();
  const theme = useTheme();
  const settings = useStore((s) => s.calcSettings);
  const index = useStore((s) => s.cpi.index);
  const [start, setStart] = useState('');
  const [buyDate, setBuyDate] = useState<string>();
  const [end, setEnd] = useState('');

  const today = todayISO();
  const startAmount = parseAmount(start);
  const endAmount = parseAmount(end);

  let result: { nominal: number; inflation: number; real: number; breakEven: number; complete: boolean } | undefined;
  if (startAmount && endAmount !== undefined && buyDate) {
    const inf = inflationFor(settings, index, buyDate, today);
    const nominal = endAmount / startAmount - 1;
    result = {
      nominal,
      inflation: inf.factor - 1,
      real: realReturn(nominal, inf.factor - 1),
      breakEven: startAmount * inf.factor,
      complete: inf.complete,
    };
  }

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={() => router.back()} />
        <View style={styles.flex}>
          <ThemedText style={styles.title}>Hızlı hesap</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Kaydetmeden tek bir yatırımın reel getirisini gör.
          </ThemedText>
        </View>
      </View>

      <Card style={styles.form}>
        <Field label="Yatırdığın tutar" prefix="₺" keyboardType="decimal-pad" placeholder="100.000" value={start} onChangeText={setStart} />
        <DateField label="Yatırım tarihi" value={buyDate} onChange={setBuyDate} max={today} />
        <Field label="Bugünkü değeri" prefix="₺" keyboardType="decimal-pad" placeholder="150.000" value={end} onChangeText={setEnd} />
      </Card>

      {result && (
        <View style={[styles.preview, { backgroundColor: theme.info }]}>
          <ThemedText type="smallBold" style={{ color: theme.infoText }}>
            {result.real >= 0 ? 'Enflasyonun üstünde' : 'Enflasyonun altında'}
          </ThemedText>
          <Row label="Nominal getiri" value={formatPct(result.nominal, false)} strong />
          <Row label="Aynı dönem enflasyon" value={formatPct(result.inflation, false)} strong />
          <Row label="Korunmak için gereken" value={formatTL(result.breakEven)} strong />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.total}>
            <ThemedText style={[styles.totalLabel, { color: theme.infoText }]}>Reel getirin</ThemedText>
            <Pct ratio={result.real} size={28} />
          </View>
          {!result.complete && (
            <ThemedText type="small" themeColor="textSecondary">
              TÜFE {formatMonth(index.last)} verisine kadar hesaplandı.
            </ThemedText>
          )}
        </View>
      )}

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800 },
  form: { gap: Spacing.three },
  preview: { borderRadius: 20, padding: 20, gap: Spacing.two },
  divider: { height: 1, marginVertical: Spacing.one },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 18, fontWeight: 700 },
});
