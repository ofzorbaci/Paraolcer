import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { openPaywall, usePremium } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, IconButton, Screen } from '@/components/ui';
import { BrandFonts, Spacing } from '@/constants/theme';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useTheme } from '@/hooks/use-theme';
import { formatMonth, formatPct, formatRate } from '@/lib/format';
import { cpiPendingMonth, gradeFor } from '@/lib/karne';
import { shareViewImage } from '@/lib/share-image';
import { KIND_LABELS } from '@/lib/types';
import { maybeAskForReview, useStore } from '@/state/store';

/** CPI-day report card. Ratios only, so the shareable image never shows amounts. */
export default function KarneScreen() {
  const theme = useTheme();
  const premium = usePremium();
  const lastCpi = useStore((s) => s.cpi.rows[s.cpi.rows.length - 1]);
  const { total, byKind } = usePortfolio();
  const card = useRef<ComponentRef<typeof View>>(null);
  const [status, setStatus] = useState<string>();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const month = formatMonth(lastCpi.month).split(' ')[0];
  const grade = total ? gradeFor(total.real) : undefined;
  const pending = cpiPendingMonth(new Date(), lastCpi.month);
  // A good report card is the moment to ask for a store review (rarely; see review.ts).
  const good = !!total && total.real >= 0;
  useEffect(() => {
    if (good) void maybeAskForReview(true);
  }, [good]);

  const share = async () => {
    try {
      if (!(await shareViewImage(card, `${month} karnem`))) setStatus('Paylaşım bu cihazda kullanılamıyor.');
    } catch {
      setStatus('Görsel oluşturulamadı. Tekrar dene.');
    }
  };

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={close} />
        <ThemedText style={styles.title}>{month} karnen</ThemedText>
      </View>

      {pending && (
        <Card>
          <ThemedText type="smallBold">{formatMonth(pending)} TÜFE’si güncelleniyor</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Yeni veri birkaç dakika içinde gelecek. Aşağıdaki karne {formatMonth(lastCpi.month)} verisiyle; yeni karnen
            hazır olunca burada görünecek.
          </ThemedText>
        </Card>
      )}

      <View ref={card} collapsable={false} style={[styles.karne, { backgroundColor: theme.hero }]}>
        <ThemedText style={[styles.brand, { color: theme.heroText }]}>Paraölçer</ThemedText>
        <ThemedText style={[styles.small, { color: theme.heroMuted }]}>
          {formatMonth(lastCpi.month)} TÜFE: aylık {formatRate(lastCpi.mom)} · yıllık {formatRate(lastCpi.yoy)}
        </ThemedText>
        {total && grade ? (
          <>
            <View style={styles.gradeRow}>
              <ThemedText style={[styles.grade, { color: theme.heroAccent }]}>{grade.letter}</ThemedText>
              <View style={styles.flex}>
                <ThemedText style={[styles.verdict, { color: theme.heroText }]}>{grade.verdict}</ThemedText>
                <ThemedText style={[styles.small, { color: theme.heroMuted }]}>
                  Birikimimin reel getirisi {formatPct(total.real)}
                </ThemedText>
              </View>
            </View>
            {byKind.map((k) => (
              <View key={k.kind} style={[styles.kindRow, { borderColor: 'rgba(255,255,255,0.12)' }]}>
                <ThemedText style={[styles.kind, { color: theme.heroText }]}>{KIND_LABELS[k.kind]}</ThemedText>
                <ThemedText style={[styles.kind, styles.bold, { color: k.real >= 0 ? theme.heroAccent : '#FDBA74' }]}>
                  {formatPct(k.real)}
                </ThemedText>
              </View>
            ))}
          </>
        ) : (
          <ThemedText style={[styles.verdict, { color: theme.heroText }]}>
            Birikimini ekle, her ay TÜFE açıklanınca karneni çıkaralım.
          </ThemedText>
        )}
        <ThemedText style={[styles.tiny, { color: theme.heroMuted }]}>
          Alım gücünü ölç · Tutarlar paylaşılmaz · Yatırım tavsiyesi değildir.
        </ThemedText>
      </View>

      {total && <Button title="Karnemi paylaş" onPress={() => void share()} />}
      {status && (
        <ThemedText type="small" style={{ color: theme.negative }}>
          {status}
        </ThemedText>
      )}

      {total && (
        <Card>
          <ThemedText type="smallBold">Peki dolar ve altın ne yaptı?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Aynı dönemde birikimini dolar, gram altın, mevduat ve nakit TL ile bugünün lirasıyla kıyasla.
          </ThemedText>
          <Button
            title={premium ? 'Kıyas grafiğini aç' : 'Kıyasla · Premium'}
            kind="secondary"
            onPress={() => (premium ? router.push('/power') : openPaywall('benchmarks'))}
          />
        </Card>
      )}

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
  karne: { borderRadius: 24, padding: Spacing.four, gap: Spacing.two },
  brand: { fontFamily: BrandFonts.wordmark, fontWeight: 'normal', fontSize: 24, lineHeight: 30 },
  small: { fontSize: 14, lineHeight: 20 },
  tiny: { fontSize: 12, lineHeight: 16, marginTop: Spacing.two },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginVertical: Spacing.two },
  grade: { fontSize: 64, lineHeight: 72, fontWeight: 800 },
  verdict: { fontSize: 20, lineHeight: 26, fontWeight: 700 },
  kindRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 8 },
  kind: { fontSize: 16, lineHeight: 22 },
  bold: { fontWeight: 700 },
  flex: { flex: 1 },
});
