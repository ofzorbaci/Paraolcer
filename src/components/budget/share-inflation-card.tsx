import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Wordmark } from '@/components/wordmark';
import { Button } from '@/components/ui';
import { BrandFonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMonth, formatRate } from '@/lib/format';
import { shareViewImage } from '@/lib/share-image';
import { useStore } from '@/state/store';

/** Where the card sends people: the free web test. */
export const WEB_TEST_URL = 'ofzorbaci.github.io/Paraolcer';

/** "Benim enflasyonum %Z · TÜİK %X · ENAG %Y" as an image to share. Rates only, never amounts. */
export function ShareInflationCard({ rate, official, month }: { rate: number; official: number; month?: string }) {
  const theme = useTheme();
  const enag = useStore((s) => s.feed.enag);
  const card = useRef<ComponentRef<typeof View>>(null);
  const [status, setStatus] = useState<string>();

  const share = async () => {
    try {
      if (!(await shareViewImage(card, 'Benim enflasyonum'))) setStatus('Paylaşım bu cihazda kullanılamıyor.');
    } catch {
      setStatus('Görsel oluşturulamadı. Tekrar dene.');
    }
  };

  return (
    <>
      <View ref={card} collapsable={false} style={[styles.card, { backgroundColor: theme.hero }]}>
        <Wordmark size={20} onDark />
        <ThemedText style={[styles.small, { color: theme.heroMuted }]}>Benim enflasyonum</ThemedText>
        <ThemedText style={[styles.big, { color: theme.heroAccent }]}>{formatRate(rate)}</ThemedText>
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText style={[styles.small, { color: theme.heroMuted }]}>TÜİK</ThemedText>
            <ThemedText style={[styles.value, { color: theme.heroText }]}>{formatRate(official)}</ThemedText>
          </View>
          {enag && (
            <View style={styles.flex}>
              <ThemedText style={[styles.small, { color: theme.heroMuted }]}>ENAG</ThemedText>
              <ThemedText style={[styles.value, { color: theme.heroText }]}>{formatRate(enag.yoy)}</ThemedText>
            </View>
          )}
        </View>
        <ThemedText style={[styles.tiny, { color: theme.heroMuted }]}>
          {month ? `${formatMonth(month)} harcamalarımdan` : 'Harcama paylarımdan'} · Senin enflasyonun kaç? {WEB_TEST_URL}
        </ThemedText>
      </View>
      <Button title="Benim enflasyonum kartını paylaş" kind="secondary" onPress={() => void share()} />
      {status && (
        <ThemedText type="small" style={{ color: theme.negative }}>
          {status}
        </ThemedText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: Spacing.four, gap: 4 },
  brand: { fontFamily: BrandFonts.wordmark, fontWeight: 'normal', fontSize: 20, lineHeight: 26 },
  small: { fontSize: 13, lineHeight: 18 },
  big: { fontSize: 48, lineHeight: 56, fontWeight: 800 },
  row: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one },
  flex: { flex: 1 },
  value: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  tiny: { fontSize: 11, lineHeight: 15, marginTop: Spacing.two },
});
