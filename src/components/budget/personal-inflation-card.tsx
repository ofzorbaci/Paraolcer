import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { openPaywall, usePremium } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysUntilOwnInflation, personalInflation } from '@/lib/budget/personal-inflation';
import { formatMonth, formatRate, todayISO } from '@/lib/format';
import { markUsage } from '@/lib/purchases';
import { useBudget } from '@/state/budget';
import { updateSettings, useStore } from '@/state/store';

/** "Senin enflasyonun kaç?": one free line, item by item with Premium. */
export function PersonalInflationCard() {
  const theme = useTheme();
  const premium = usePremium();
  const txs = useBudget((s) => s.transactions);
  const accounts = useBudget((s) => s.accounts);
  const rates = useStore((s) => s.prices);
  const groups = useStore((s) => s.feed.cpiGroups);
  const basket = useStore((s) => s.settings.basket);
  const officialYoy = useStore((s) => s.cpi.rows[s.cpi.rows.length - 1].yoy);
  const customRate = useStore((s) => s.settings.customAnnualRate);
  const today = todayISO();
  const p = personalInflation({ txs, accounts, rates, today, groups, basket, officialYoy });
  const shown = p.source !== 'none';

  // For the 60-day check: do users who see their own inflation pay more often?
  useEffect(() => {
    if (shown) markUsage('kisisel_enflasyon', 'acti');
  }, [shown]);

  if (p.source === 'none') {
    const days = daysUntilOwnInflation(txs, today);
    return (
      <Card>
        <ThemedText style={styles.title}>Senin enflasyonun kaç?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Harcamalarını yazdıkça kira, market, ulaşım paylarından sana özel enflasyonu TÜİK’in grup verisiyle hesaplarız.
          {txs.length > 0 ? ` İlk tam ayın ${days} gün sonra doluyor.` : ''} Beklemeden 5 soruyla tahmini görebilirsin.
        </ThemedText>
        <Button title="5 soruyla tahmin et" kind="secondary" onPress={() => router.push('/my-inflation')} />
      </Card>
    );
  }

  const top = p.rows[0];
  const gap = p.rate - p.official;
  const rounded = Math.round(p.rate * 100) / 100;
  const points = (n: number) => `${n.toFixed(1).replace('.', ',')} puan`;
  const applied = Math.abs(customRate - rounded) < 0.01;

  return (
    <Card>
      <ThemedText style={styles.title}>Senin enflasyonun</ThemedText>
      <View style={styles.line}>
        <ThemedText style={[styles.big, { color: gap > 0 ? theme.negative : theme.accent }]}>{formatRate(p.rate)}</ThemedText>
        <ThemedText themeColor="textSecondary">— TÜFE {formatRate(p.official)}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {p.source === 'spending'
          ? `${formatMonth(p.month!)} harcamalarından, TÜİK grup artışlarıyla. `
          : 'Şimdilik 5 soruluk tahmin; bir tam ay harcama yazınca gerçek veriye geçer. '}
        {Math.abs(gap) < 0.5 ? 'Resmi orana çok yakın.' : gap > 0 ? `Resmi oranın ${points(gap)} üstünde.` : `Resmi oranın ${points(-gap)} altında.`}
      </ThemedText>

      {premium ? (
        <View style={styles.rows}>
          <ThemedText type="smallBold">Bu oranı en çok {top.label.toLocaleLowerCase('tr-TR')} yükseltiyor</ThemedText>
          {p.rows.map((r) => (
            <View key={r.group} style={styles.row}>
              <ThemedText style={styles.flex}>{r.label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                payın %{Math.round(r.weight * 100)} · artış {formatRate(r.yoy)}
              </ThemedText>
              <ThemedText style={styles.contribution}>{formatRate(r.contribution)}</ThemedText>
            </View>
          ))}
        </View>
      ) : (
        <Button title="Kalem kalem gör · Premium" kind="secondary" compact onPress={() => openPaywall('personalInflation')} />
      )}

      <Button
        title={applied ? 'Özet’te bu oranla da ölçülüyor ✓' : 'Birikimimi bu orana karşı da ölç'}
        kind="secondary"
        compact
        disabled={applied}
        onPress={() => updateSettings({ customAnnualRate: rounded })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, flexWrap: 'wrap' },
  big: { fontSize: 32, lineHeight: 40, fontWeight: 800 },
  rows: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  contribution: { fontWeight: 700, minWidth: 56, textAlign: 'right' },
});
