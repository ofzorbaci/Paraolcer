import { Link, router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { HeroCard } from '@/components/hero';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, IconButton, InfoBanner, Pct, Screen, ScreenHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useTheme } from '@/hooks/use-theme';
import { nextCpiReleases } from '@/lib/calendar';
import { formatMonth, formatRate, todayISO } from '@/lib/format';
import { KIND_LABELS } from '@/lib/types';
import { setCpiReminders, useStore } from '@/state/store';

const RELEASE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

export default function SummaryScreen() {
  const theme = useTheme();
  const ready = useStore((s) => s.ready);
  const lastCpi = useStore((s) => s.cpi.rows[s.cpi.rows.length - 1]);
  const { items, total, byKind, settings } = usePortfolio();
  const nextRelease = nextCpiReleases(new Date(), 1)[0];
  const tuik = settings.inflationSource === 'tuik';

  const toggleReminders = async () => {
    const on = !settings.notifyCpi;
    const ok = await setCpiReminders(on);
    if (!on) Alert.alert('Hatırlatma kapatıldı', 'Enflasyon açıklamalarında bildirim gelmeyecek.');
    else if (ok) Alert.alert('Hatırlatma açık', `Bir sonraki: ${RELEASE_FMT.format(nextRelease)}, 10:00.`);
    else Alert.alert('Bildirim izni yok', 'Ayarlar’dan bildirimlere izin verip tekrar dene.');
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow={`Başlangıçtan bu yana · ${formatMonth(todayISO().slice(0, 7))}`}
        title="Reel Getiri Pusulası"
        right={
          <IconButton
            name={{ ios: settings.notifyCpi ? 'bell.fill' : 'bell', android: 'notifications', web: 'notifications' }}
            label="Enflasyon açıklama hatırlatması"
            active={settings.notifyCpi}
            onPress={toggleReminders}
          />
        }
      />

      {ready && items.length === 0 && (
        <Card>
          <ThemedText style={styles.cardTitle}>Paran gerçekten büyüyor mu?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Mevduatını, dövizini, altınını ya da fonunu ekle. Aynı dönemin enflasyonuyla karşılaştırıp alım gücünün
            artıp artmadığını gösterelim.
          </ThemedText>
          <Button title="İlk varlığını ekle" icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={() => router.push('/holding/edit')} />
        </Card>
      )}

      {total && <HeroCard total={total} inflationLabel={tuik ? 'TÜFE' : 'Enflasyon'} />}

      {byKind.length > 0 && (
        <Card>
          <View style={styles.cardHead}>
            <ThemedText style={styles.cardTitle}>Kim koruyor, kim eritiyor?</ThemedText>
            <Link href="/holdings" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <ThemedText style={[styles.link, { color: theme.accent }]}>Tümü</ThemedText>
              </Pressable>
            </Link>
          </View>
          {byKind.map((k) => (
            <View key={k.kind} style={styles.kindRow}>
              <ThemedText style={styles.kindLabel}>{KIND_LABELS[k.kind]}</ThemedText>
              <Pct ratio={k.real} size={18} />
            </View>
          ))}
        </Card>
      )}

      {total && (total.unpriced > 0 || total.incomplete) && (
        <ThemedText type="small" themeColor="textSecondary">
          {total.unpriced > 0 ? `${total.unpriced} varlığın güncel fiyatı olmadığı için hesaba katılmadı. ` : ''}
          {total.incomplete && tuik ? `TÜFE ${formatMonth(lastCpi.month)} verisine kadar hesaplandı.` : ''}
        </ThemedText>
      )}

      <InfoBanner
        title={`${formatMonth(lastCpi.month).split(' ')[0]} enflasyonu açıklandı`}
        body={`Aylık ${formatRate(lastCpi.mom)}, yıllık ${formatRate(lastCpi.yoy)}. Sonraki açıklama ${RELEASE_FMT.format(nextRelease)}, 10:00.`}
      />

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.one },
  cardTitle: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  link: { fontSize: 17, fontWeight: 600 },
  kindRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  kindLabel: { fontSize: 17 },
});
