import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Icon, IconButton, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Everything the app asks the internet, and why. Nothing on this list carries the user's data. */
const CALLS: { host: string; what: string; sends: string }[] = [
  { host: 'ofzorbaci.github.io', what: 'TÜFE, politika faizi, beklenti, stopaj ve grup verisi (ParaLens veri akışı)', sends: 'Hiçbir şey; herkese aynı dosya' },
  { host: 'www.tcmb.gov.tr', what: 'Yeni TÜFE açıklandı mı ve günün kuru (yedek)', sends: 'Hiçbir şey' },
  { host: 'api.frankfurter.dev', what: 'Dolar, euro, sterlin kuru (Avrupa Merkez Bankası)', sends: 'Hiçbir şey; yalnızca para birimi ve tarih' },
  { host: 'api.gold-api.com', what: 'Altının ons fiyatı', sends: 'Hiçbir şey' },
  { host: 'RevenueCat · App Store · Google Play', what: 'Aboneliğin geçerli mi', sends: 'Rastgele bir kullanıcı kimliği, abonelik durumu ve kişisel enflasyonu açıp açmadığın (evet/hayır)' },
];

const NEVER = [
  'Varlıkların, tutarları ve alış tarihleri',
  'Harcamaların, gelirlerin, hesap bakiyelerin',
  'İçe aktardığın ekstre ve Excel dosyaları',
  'Kişisel enflasyonun ve sepet cevapların',
  'Adın, e-postan, telefon numaran (hesap açtırmayız)',
];

/** "Verin telefondan çıkmaz", shown rather than said. */
export default function PrivacyProofScreen() {
  const theme = useTheme();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={close} />
        <ThemedText style={styles.title}>Verin nerede?</ThemedText>
      </View>

      <View style={[styles.box, { backgroundColor: theme.info }]}>
        <Icon name={{ ios: 'iphone', android: 'smartphone', web: 'smartphone' }} size={22} color={theme.infoText} />
        <ThemedText style={[styles.flex, styles.lead, { color: theme.infoText }]}>
          Hesap açtırmıyoruz ve sunucumuz yok. Girdiğin her şey bu telefonda, uygulamanın kendi klasöründe duruyor.
        </ThemedText>
      </View>

      <Card>
        <ThemedText style={styles.h}>Uygulamanın internete sorduğu her şey</ThemedText>
        {CALLS.map((c) => (
          <View key={c.host} style={[styles.call, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">{c.host}</ThemedText>
            <ThemedText type="small">{c.what}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Giden: {c.sends}
            </ThemedText>
          </View>
        ))}
      </Card>

      <Card>
        <ThemedText style={styles.h}>Hiçbir zaman gitmeyenler</ThemedText>
        {NEVER.map((n) => (
          <View key={n} style={styles.row}>
            <Icon name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={16} color={theme.accent} />
            <ThemedText type="small" style={styles.flex}>
              {n}
            </ThemedText>
          </View>
        ))}
      </Card>

      <Card>
        <ThemedText style={styles.h}>Kendin dene</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Telefonunu uçak moduna al ve uygulamayı kullan: varlık ekle, harcama yaz, ekstre içe aktar, kişisel
          enflasyonunu hesapla. Hepsi çalışır; internet yalnızca yeni kur ve TÜFE verisini almak için gerekir. Yedeğini de
          sen alırsın: Profil › Yedek, şifreli dosyayı nereye kaydedeceğini sen seçersin.
        </ThemedText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
  box: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: 16, padding: Spacing.three },
  lead: { fontSize: 15, lineHeight: 21, fontWeight: 600 },
  h: { fontSize: 18, lineHeight: 24, fontWeight: 700 },
  call: { borderTopWidth: 1, paddingTop: Spacing.two, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
