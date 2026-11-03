import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/budget/parts';
import { openPaywall, PremiumGate, usePremium } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Card, Choice, IconButton, Pct, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { byAccount, byCategory, dailyHeat, periodRange, PERIODS, previousRange, totals, weekdayIndex, type BreakdownRow, type PeriodKey } from '@/lib/budget/calc';
import { formatMonth, formatTL, todayISO } from '@/lib/format';
import { useBudget } from '@/state/budget';
import { useStore } from '@/state/store';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** Where the money went: totals, a daily heat map, and category and account breakdowns. */
export default function AnalysisScreen() {
  const theme = useTheme();
  useMasked();
  const accounts = useBudget((s) => s.accounts);
  const txs = useBudget((s) => s.transactions);
  const rates = useStore((s) => s.prices);
  const premium = usePremium();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const today = todayISO();
  const range = periodRange(period, today);
  const t = totals(txs, range, accounts, rates);
  const before = totals(txs, previousRange(period, today), accounts, rates);
  const change = (now: number, then: number) => (then > 0 ? now / then - 1 : undefined);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/butce'));

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={close} />
        <ThemedText style={styles.title}>Analizler</ThemedText>
      </View>

      <Choice<PeriodKey>
        options={PERIODS.map((p) => ({ value: p.key, label: premium || p.key === 'month' ? p.label : `${p.label} 🔒` }))}
        value={period}
        onChange={(p) => (premium || p === 'month' ? setPeriod(p) : openPaywall('budgetAnalysis'))}
      />

      <Card>
        <View style={styles.pair}>
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="textSecondary">
              Gelir
            </ThemedText>
            <ThemedText style={[styles.total, { color: theme.positive }]} adjustsFontSizeToFit numberOfLines={1}>
              {formatTL(t.income)}
            </ThemedText>
            {premium && change(t.income, before.income) !== undefined && <Pct ratio={change(t.income, before.income)} size={14} />}
          </View>
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="textSecondary">
              Gider
            </ThemedText>
            <ThemedText style={[styles.total, { color: theme.negative }]} adjustsFontSizeToFit numberOfLines={1}>
              {formatTL(t.expense)}
            </ThemedText>
            {premium && change(t.expense, before.expense) !== undefined && (
              <ThemedText type="small" themeColor="textSecondary">
                önceki döneme göre {Math.round((change(t.expense, before.expense) ?? 0) * 100)}%
              </ThemedText>
            )}
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {t.count} işlem · net {formatTL(t.income - t.expense)} · transferler sayılmaz
        </ThemedText>
      </Card>

      <PremiumGate feature="budgetAnalysis" pitch="Hangi gün ne kadar harcadığını takvim üzerinde renklerle gör; harcamanın yoğunlaştığı günleri yakala.">
        <HeatMap month={range.to.slice(0, 7)} />
      </PremiumGate>

      <Breakdown title="Kategoriye göre" rows={byCategory(txs, range, accounts, rates)} empty="Bu dönemde harcama yok." />

      <PremiumGate feature="budgetAnalysis" pitch="Hangi hesaptan, hangi karttan ne kadar harcadığını gör.">
        <Breakdown title="Hesaba göre" rows={byAccount(txs, range, accounts, rates)} empty="Bu dönemde harcama yok." accounts />
      </PremiumGate>
    </Screen>
  );
}

function HeatMap({ month }: { month: string }) {
  const theme = useTheme();
  const accounts = useBudget((s) => s.accounts);
  const txs = useBudget((s) => s.transactions);
  const rates = useStore((s) => s.prices);
  const days = dailyHeat(txs, month, accounts, rates);
  const today = todayISO();
  const lead = weekdayIndex(days[0].date);
  // Light to strong of the loss colour; level 0 is the plain surface.
  const tint = [theme.backgroundSelected, `${theme.negative}33`, `${theme.negative}66`, `${theme.negative}AA`, theme.negative];

  return (
    <Card>
      <View style={styles.pair}>
        <ThemedText style={[styles.cardTitle, styles.flex]}>Günlük harcama haritası</ThemedText>
        <ThemedText type="small" style={{ color: theme.accent }}>
          {formatMonth(month)}
        </ThemedText>
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((w) => (
          <ThemedText key={w} type="small" themeColor="textSecondary" style={styles.cell}>
            {w}
          </ThemedText>
        ))}
      </View>
      <View style={styles.week}>
        {Array.from({ length: lead }, (_, i) => (
          <View key={`l${i}`} style={styles.cell} />
        ))}
        {days.map((d) => (
          <View key={d.date} style={styles.cell}>
            <View
              accessibilityLabel={`${d.date}: ${formatTL(d.amount)}`}
              style={[styles.heat, { backgroundColor: tint[d.level], borderColor: d.date === today ? theme.accent : 'transparent' }]}>
              <ThemedText type="small" style={{ color: d.level >= 3 ? theme.onAccent : theme.text }}>
                {Number(d.date.slice(8))}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <ThemedText type="small" themeColor="textSecondary">
          Az
        </ThemedText>
        {tint.map((c, i) => (
          <View key={i} style={[styles.swatch, { backgroundColor: c }]} />
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          Çok
        </ThemedText>
      </View>
    </Card>
  );
}

function Breakdown({ title, rows, empty, accounts }: { title: string; rows: BreakdownRow[]; empty: string; accounts?: boolean }) {
  const theme = useTheme();
  return (
    <Card>
      <ThemedText style={styles.cardTitle}>{title}</ThemedText>
      {rows.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {empty}
        </ThemedText>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={styles.rowWrap}>
            <Badge icon={accounts ? 'account_balance' : r.icon} color={accounts ? theme.accent : r.color} size={36} />
            <View style={styles.flex}>
              <View style={styles.pair}>
                <ThemedText style={[styles.rowTitle, styles.flex]} numberOfLines={1}>
                  {r.label}
                </ThemedText>
                <ThemedText style={styles.rowTitle}>{formatTL(r.amount)}</ThemedText>
              </View>
              <View style={[styles.track, { backgroundColor: theme.border }]}>
                <View style={[styles.fill, { backgroundColor: accounts ? theme.accent : r.color, width: `${Math.max(2, r.share * 100)}%` }]} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                %{(r.share * 100).toFixed(1).replace('.', ',')} · {r.count} işlem
              </ThemedText>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
  cardTitle: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  total: { fontSize: 24, lineHeight: 30, fontWeight: 800 },
  week: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', textAlign: 'center', padding: 2 },
  heat: { width: '100%', maxWidth: 52, aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  swatch: { width: 16, height: 16, borderRadius: 4 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 6 },
  rowTitle: { fontSize: 16, fontWeight: 600 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 4 },
  fill: { height: 6, borderRadius: 3 },
});
