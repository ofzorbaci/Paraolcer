import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Row } from '@/components/ui';
import { useMasked } from '@/hooks/use-masked';
import { netWorth } from '@/lib/budget/month-end';
import { formatMoney, formatTL, todayISO } from '@/lib/format';
import { analyzeHolding, analyzePortfolio } from '@/lib/returns';
import { useBudget } from '@/state/budget';
import { useStore } from '@/state/store';

/** Everything the user owns: savings in every portfolio plus the budget's accounts, in TRY and in dollars. */
export function NetWorthCard() {
  useMasked();
  const holdings = useStore((s) => s.allHoldings);
  const settings = useStore((s) => s.calcSettings);
  const index = useStore((s) => s.cpi.index);
  const prices = useStore((s) => s.prices);
  const accounts = useBudget((s) => s.accounts);
  const txs = useBudget((s) => s.transactions);
  const today = todayISO();
  const own = holdings.filter((h) => !h.sample);
  const savings = analyzePortfolio(own.map((h) => analyzeHolding(h, today, prices, settings, index)))?.value ?? 0;
  if (own.length === 0 && accounts.length === 0) return null;
  const w = netWorth(savings, accounts, txs, prices);

  return (
    <Card>
      <ThemedText style={styles.title}>Net varlığın</ThemedText>
      <View style={styles.line}>
        <ThemedText style={styles.big} adjustsFontSizeToFit numberOfLines={1}>
          {formatTL(w.total)}
        </ThemedText>
        {w.usd !== undefined && <ThemedText themeColor="textSecondary">≈ {formatMoney(w.usd, '$')}</ThemedText>}
      </View>
      <Row label="Birikimler (tüm portföyler)" value={formatTL(w.savings)} />
      <Row label="Bütçe hesapları" value={formatTL(w.accounts)} />
      <ThemedText type="small" themeColor="textSecondary">
        Bugünün fiyatlarıyla; kart borcu eksi olarak düşülür.
        {w.missing.length ? ` ${w.missing.join(', ')} kur gelene kadar dahil değil.` : ''}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  big: { fontSize: 28, lineHeight: 36, fontWeight: 800 },
});
