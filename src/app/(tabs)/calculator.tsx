import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Disclaimer, Field, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { inflationFor } from '@/lib/cpi';
import { formatMonth, formatPct, formatTL, parseAmount, parseDate, todayISO } from '@/lib/format';
import { realReturn } from '@/lib/returns';
import { useStore } from '@/state/store';

/** One-off check without saving anything: "I put X in on date D, it is worth Y now." */
export default function CalculatorScreen() {
  const theme = useTheme();
  const settings = useStore((s) => s.settings);
  const index = useStore((s) => s.cpi.index);
  const [start, setStart] = useState('');
  const [date, setDate] = useState('');
  const [end, setEnd] = useState('');

  const today = todayISO();
  const startAmount = parseAmount(start);
  const endAmount = parseAmount(end);
  const buyDate = parseDate(date, today);
  const ready = startAmount && endAmount !== undefined && buyDate;

  let result: { nominal: number; inflation: number; real: number; breakEven: number; complete: boolean } | undefined;
  if (ready) {
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
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">Hızlı hesap</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Kaydetmeden tek bir yatırımın reel getirisini gör.
        </ThemedText>
      </View>

      <Card>
        <Field label="Yatırdığın tutar (TL)" keyboardType="decimal-pad" placeholder="100.000" value={start} onChangeText={setStart} />
        <Field
          label="Yatırım tarihi"
          placeholder="GG.AA.YYYY"
          keyboardType="numbers-and-punctuation"
          value={date}
          onChangeText={setDate}
          error={date.length >= 8 && !buyDate ? '2005 ile bugün arasında geçerli bir tarih gir' : undefined}
        />
        <Field label="Bugünkü değeri (TL)" keyboardType="decimal-pad" placeholder="150.000" value={end} onChangeText={setEnd} />
      </Card>

      {result && (
        <Card style={{ backgroundColor: result.real >= 0 ? theme.positiveSoft : theme.negativeSoft }}>
          <ThemedText type="smallBold" style={{ color: result.real >= 0 ? theme.positive : theme.negative }}>
            {result.real >= 0 ? 'Enflasyonun üstünde' : 'Enflasyonun altında'}
          </ThemedText>
          <ThemedText style={[styles.big, { color: result.real >= 0 ? theme.positive : theme.negative }]}>
            {formatPct(result.real)}
          </ThemedText>
          <Row label="Nominal getiri" value={formatPct(result.nominal)} />
          <Row label="Aynı dönemde enflasyon" value={formatPct(result.inflation)} />
          <Row label="Korunmak için gereken" value={formatTL(result.breakEven)} strong />
          {!result.complete && (
            <ThemedText type="small" themeColor="textSecondary">
              TÜFE {formatMonth(index.last)} verisine kadar hesaplandı.
            </ThemedText>
          )}
        </Card>
      )}

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  big: { fontSize: 40, lineHeight: 48, fontWeight: 700 },
});
