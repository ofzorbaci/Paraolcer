import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Row } from '@/components/ui';
import { Fonts, Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { daysBetween } from '@/lib/cpi';
import { defaultWithholding, depositValue, isTlDeposit, termInterest } from '@/lib/deposit';
import { formatDate, formatRate, formatTL, todayISO } from '@/lib/format';
import { useStore } from '@/state/store';

/**
 * The user's own TRY deposits worked through step by step, so the numbers can be held up against
 * the bank's own screen: one term's gross interest, withholding and net, then today's value.
 */
export function OwnDepositCheck() {
  const theme = useTheme();
  useMasked();
  const deposits = useStore((s) => s.allHoldings).filter((h) => isTlDeposit(h) && !h.sample && h.grossRate !== undefined && h.termDays);
  const today = todayISO();
  if (deposits.length === 0) return null;

  return (
    <Card>
      <ThemedText style={styles.h}>Kendi mevduatınla doğrula</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Bankanın vade sonu ekranındaki “brüt faiz”, “stopaj” ve “net faiz” satırlarıyla karşılaştır; kuruşu kuruşuna
        tutmalı. Tutmuyorsa faiz oranını ya da vadeyi kontrol et.
      </ThemedText>
      {deposits.map((h) => {
        const term = h.termDays!;
        const wh = h.withholding ?? defaultWithholding(term);
        const one = termInterest(h.unitCost, h.grossRate!, term, wh);
        const terms = Math.floor(Math.max(0, daysBetween(h.buyDate, today)) / term);
        return (
          <View key={h.id} style={[styles.deposit, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">
              {h.name} · {formatDate(h.buyDate)}
            </ThemedText>
            <ThemedText type="small" style={styles.formula}>
              {formatTL(h.unitCost, true)} × {formatRate(h.grossRate!)} × {term} ÷ 36500
            </ThemedText>
            <Row label="Bir vadede brüt faiz" value={formatTL(one.gross, true)} />
            <Row label={`Stopaj (${formatRate(wh)})`} value={`−${formatTL(one.tax, true)}`} />
            <Row label="Bir vadede net faiz" value={formatTL(one.net, true)} strong />
            <Row label={`Bugüne kadar ${terms} vade, faiz anaparaya eklenerek`} value={formatTL(depositValue(h, today), true)} />
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: 18, lineHeight: 24, fontWeight: 700 },
  deposit: { borderTopWidth: 1, paddingTop: Spacing.two, gap: 4 },
  formula: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 19 },
});
