import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ImportButtons } from '@/components/import-buttons';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Field, Pct } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { formatTL, parseAmount, todayISO } from '@/lib/format';
import { analyzeHolding } from '@/lib/returns';
import { QUICK_PERIODS, quickStartDate, samplePortfolio } from '@/lib/samples';
import type { Holding } from '@/lib/types';
import { addHoldings, newId, saveHolding, useStore } from '@/state/store';

/**
 * The first screen a new user sees: one deposit in three fields and the answer right away,
 * or an example portfolio clearly marked as such.
 */
export function QuickStart() {
  const theme = useTheme();
  const settings = useStore((s) => s.calcSettings);
  useMasked();
  const index = useStore((s) => s.cpi.index);
  const prices = useStore((s) => s.prices);
  const [amount, setAmount] = useState('');
  const [gross, setGross] = useState('');
  const [term, setTerm] = useState('32');
  const [months, setMonths] = useState<string>('12');
  const today = todayISO();

  const principal = parseAmount(amount);
  const rate = parseAmount(gross);
  const days = parseAmount(term);
  const holding: Holding | undefined =
    principal && rate !== undefined && days
      ? {
          id: newId(),
          kind: 'deposit',
          name: 'TL mevduat',
          buyDate: quickStartDate(today, Number(months)),
          quantity: 1,
          unitCost: principal,
          grossRate: rate,
          termDays: Math.round(days),
        }
      : undefined;
  const result = holding ? analyzeHolding(holding, today, prices, settings, index) : undefined;

  return (
    <Card>
      <ThemedText style={styles.title}>Paran enflasyonu yeniyor mu?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Sadece mevduatını gir, cevabı hemen görelim. Hesap açman gerekmez; veriler telefonunda kalır.
      </ThemedText>
      <Field label="Mevduattaki tutar" prefix="₺" keyboardType="decimal-pad" placeholder="100.000" value={amount} onChangeText={setAmount} />
      <View style={styles.pair}>
        <Field style={styles.flex} label="Yıllık brüt faiz" prefix="%" keyboardType="decimal-pad" placeholder="42" value={gross} onChangeText={setGross} />
        <Field style={styles.flex} label="Vade" suffix="gün" keyboardType="number-pad" value={term} onChangeText={setTerm} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Ne zamandır bu hesapta?
      </ThemedText>
      <Choice options={QUICK_PERIODS.map((p) => ({ value: String(p.months), label: p.label }))} value={months} onChange={setMonths} />

      {result?.real !== undefined && result.realGain !== undefined && (
        <View style={[styles.result, { backgroundColor: theme.info }]}>
          <ThemedText type="small" style={{ color: theme.infoText }}>
            Bugünün lirasıyla
          </ThemedText>
          <View style={styles.resultRow}>
            <Pct ratio={result.real} size={30} />
            <ThemedText style={[styles.verdict, { color: theme.infoText }]}>
              {result.real >= 0 ? 'kazandın' : 'kaybettin'}
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.infoText }}>
            {result.realGain >= 0
              ? `Alım gücün ${formatTL(result.realGain)} arttı.`
              : `Alım gücün ${formatTL(-result.realGain)} eridi; faiz enflasyonu karşılamadı.`}
          </ThemedText>
        </View>
      )}

      <Button title="Kaydet ve devam et" disabled={!holding} onPress={() => holding && saveHolding(holding)} />
      <ImportButtons />
      <Button
        title="Örnek birikimle dene"
        kind="secondary"
        onPress={() => addHoldings(samplePortfolio(today, newId))}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, lineHeight: 28, fontWeight: 800 },
  pair: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  result: { borderRadius: 16, padding: Spacing.three, gap: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  verdict: { fontSize: 18, fontWeight: 700 },
});
