import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Pct, Row } from '@/components/ui';
import { useMasked } from '@/hooks/use-masked';
import { salaryPower } from '@/lib/budget/month-end';
import { personalInflation } from '@/lib/budget/personal-inflation';
import { formatMonth, formatRate, formatTL, todayISO } from '@/lib/format';
import { useBudget } from '@/state/budget';
import { useStore } from '@/state/store';

/** Month-end card: what raised the user's inflation most, and what the salary buys now. */
export function MonthEndCard() {
  useMasked();
  const txs = useBudget((s) => s.transactions);
  const accounts = useBudget((s) => s.accounts);
  const rates = useStore((s) => s.prices);
  const groups = useStore((s) => s.feed.cpiGroups);
  const basket = useStore((s) => s.settings.basket);
  const settings = useStore((s) => s.calcSettings);
  const index = useStore((s) => s.cpi.index);
  const officialYoy = useStore((s) => s.cpi.rows[s.cpi.rows.length - 1].yoy);
  const p = personalInflation({ txs, accounts, rates, today: todayISO(), groups, basket, officialYoy });
  const salary = salaryPower(txs, accounts, rates, settings, index);

  return (
    <Card>
      <ThemedText style={styles.title}>Ay sonu</ThemedText>
      {p.source !== 'none' ? (
        <>
          <Row label="Senin enflasyonun" value={formatRate(p.rate)} strong />
          <Row label="TÜFE" value={formatRate(p.official)} />
          <ThemedText type="small" themeColor="textSecondary">
            Bu oranı en çok {p.rows[0].label.toLocaleLowerCase('tr-TR')} yükseltiyor ({p.rows[0].contribution.toFixed(1).replace('.', ',')} puan).
            {p.source === 'questions' ? ' 5 soruluk tahmin; bir tam ay harcamadan sonra gerçek veriye geçer.' : ''}
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Bütçe’ye bir ay harcama yazınca, enflasyonunu en çok hangi kalemin yükselttiğini burada göreceksin.
        </ThemedText>
      )}
      {salary ? (
        <>
          <Row label={`Maaşın (${formatMonth(salary.latestMonth)})`} value={formatTL(salary.latest)} />
          <Row label={`${formatMonth(salary.baseMonth)} fiyatlarıyla`} value={formatTL(salary.latestInBasePrices)} />
          <ThemedText type="small" themeColor="textSecondary">
            {formatMonth(salary.baseMonth)} maaşına ({formatTL(salary.base)}) göre alım gücün <Pct ratio={salary.real} size={13} />
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Maaşını Bütçe’ye “Maaş” geliri olarak yazınca, iki ay sonra alım gücünün nasıl değiştiğini burada görürsün.
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
});
