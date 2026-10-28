import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { PowerChart } from '@/components/power-chart';
import { ThemedText } from '@/components/themed-text';
import { Card, Disclaimer, Field, Pct, Radius, Row, Screen, ScreenHeader } from '@/components/ui';
import expectations from '@/data/expectations.json';
import { Spacing } from '@/constants/theme';
import { usePowerSeries } from '@/hooks/use-portfolio';
import { useTheme } from '@/hooks/use-theme';
import { formatMonth, formatPct, formatRate, formatTL, parseAmount, todayISO } from '@/lib/format';
import { salaryErosion } from '@/lib/salary';
import { depositTerms, scenarioReal } from '@/lib/scenario';
import { useStore } from '@/state/store';

export default function PowerScreen() {
  const series = usePowerSeries();
  const yearBack = series && series.points.length >= 12;

  return (
    <Screen>
      <ScreenHeader eyebrow={yearBack ? 'Son 12 ay' : 'İlk yatırımdan bu yana'} title="Alım gücün" />
      {series ? <PowerCard series={series} /> : <EmptyPower />}
      <ScenarioCard />
      <SalaryCard />
      <Disclaimer />
    </Screen>
  );
}

function EmptyPower() {
  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        Varlık ekledikçe hesabında görünen tutarla gerçek alım gücünü burada ay ay karşılaştıracağız.
      </ThemedText>
    </Card>
  );
}

function PowerCard({ series }: { series: NonNullable<ReturnType<typeof usePowerSeries>> }) {
  const theme = useTheme();
  const last = series.points[series.points.length - 1];
  return (
    <Card>
      <ThemedText style={styles.sentence}>
        Hesabında <ThemedText style={[styles.sentence, styles.bold]}>{formatTL(last.nominal)}</ThemedText> görünüyor.{' '}
        {formatMonth(series.start)} fiyatlarıyla bu,{' '}
        <ThemedText style={[styles.sentence, styles.bold, { color: theme.accent }]}>{formatTL(last.real)}</ThemedText>{' '}
        ediyor.
      </ThemedText>
      {series.points.length > 1 ? (
        <PowerChart points={series.points} />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Grafik için en az bir ay geçmesi gerekiyor.
        </ThemedText>
      )}
      {series.estimated && (
        <ThemedText type="small" themeColor="textSecondary">
          Altın, hisse ve fonlarda ara aylar alış ile bugünkü fiyat arasında tahmin edilmiştir.
        </ThemedText>
      )}
    </Card>
  );
}

function ScenarioCard() {
  const theme = useTheme();
  const holdings = useStore((s) => s.holdings);
  const lastYoy = useStore((s) => s.cpi.rows[s.cpi.rows.length - 1].yoy);
  const terms = depositTerms(holdings);
  const options = [
    { key: 'market', label: 'Piyasa beklentisi', cpi: expectations.next12m.market },
    { key: 'now', label: 'Bugünkü yıllık', cpi: lastYoy },
    { key: 'household', label: 'Hanehalkı beklentisi', cpi: expectations.next12m.household },
  ];
  const [selected, setSelected] = useState('market');

  return (
    <Card>
      <View style={styles.cardHead}>
        <ThemedText style={styles.cardTitle}>Senaryo: önümüzdeki 12 ay</ThemedText>
        <View style={[styles.badge, { backgroundColor: theme.info }]}>
          <ThemedText style={[styles.badgeText, { color: theme.infoText }]}>PREMIUM</ThemedText>
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Enflasyon şu olursa, aynı faizle mevduatın:
      </ThemedText>
      <View style={styles.options}>
        {options.map((o) => {
          const on = o.key === selected;
          return (
            <Pressable
              key={o.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setSelected(o.key)}
              style={[
                styles.option,
                {
                  borderColor: on ? theme.accent : theme.border,
                  borderWidth: on ? 2 : 1,
                  backgroundColor: on ? theme.info : theme.backgroundElement,
                },
              ]}>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} adjustsFontSizeToFit>
                TÜFE {formatRate(o.cpi)}
              </ThemedText>
              <Pct ratio={scenarioReal(terms, o.cpi)} size={22} />
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {options.find((o) => o.key === selected)!.label}
        {selected === 'now' ? ' (TÜİK)' : ` (TCMB, ${formatMonth(expectations.month)} anketi)`} ·{' '}
        {terms.fromPortfolio ? 'Mevduatların' : 'Örnek mevduat'}: brüt {formatRate(terms.grossRate)}, {terms.termDays} gün
        vade, {formatRate(terms.withholding)} stopaj
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Bu bir hesaplamadır, öneri değildir. Beta süresince ücretsiz.
      </ThemedText>
    </Card>
  );
}

function SalaryCard() {
  const settings = useStore((s) => s.settings);
  const index = useStore((s) => s.cpi.index);
  const [salary, setSalary] = useState('');
  const [raiseDate, setRaiseDate] = useState<string>();
  const today = todayISO();
  const amount = parseAmount(salary);
  const result = amount && raiseDate ? salaryErosion(amount, raiseDate, today, settings, index) : undefined;

  return (
    <Card>
      <ThemedText style={styles.cardTitle}>Maaşın ne kadar eridi?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Son zammından beri maaşın değişmediyse, aynı parayla bugün ne alabildiğini gör.
      </ThemedText>
      <Field label="Aylık net maaş" prefix="₺" keyboardType="decimal-pad" placeholder="50.000" value={salary} onChangeText={setSalary} />
      <DateField label="Son zam tarihi" value={raiseDate} onChange={setRaiseDate} max={today} />
      {result && (
        <View style={styles.result}>
          <Row label="Zam ayı fiyatlarıyla bugünkü değeri" value={formatTL(result.realValue)} strong />
          <Row label="Her ay kaybettiğin alım gücü" value={formatTL(result.monthlyLoss)} />
          <Row label="Aynı alım gücü için gereken maaş" value={formatTL(result.needed)} strong />
          <Row label="Gereken zam" value={formatPct(result.raiseNeeded)} />
          {!result.inflation.complete && settings.inflationSource === 'tuik' && (
            <ThemedText type="small" themeColor="textSecondary">
              TÜFE {formatMonth(index.last)} verisine kadar hesaplandı.
            </ThemedText>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  sentence: { fontSize: 18, lineHeight: 27 },
  bold: { fontWeight: 700 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  cardTitle: { fontSize: 19, lineHeight: 26, fontWeight: 700, flexShrink: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: 800, letterSpacing: 0.5 },
  options: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, borderRadius: Radius.inner, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', gap: 4 },
  result: { gap: Spacing.two, marginTop: Spacing.two },
});
