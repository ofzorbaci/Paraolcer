import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BasketEditor } from '@/components/basket-editor';
import { ThemedText } from '@/components/themed-text';
import { Disclaimer, IconButton, Screen } from '@/components/ui';
import { WorldInflationCard } from '@/components/world-inflation-card';
import { Spacing } from '@/constants/theme';

/** "Senin enflasyonun kaç?": five questions straight away, from the Bütçe tab, Araçlar or Özet. */
export default function MyInflationScreen() {
  const close = () => (router.canGoBack() ? router.back() : router.replace('/butce'));
  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Kapat" onPress={close} />
        <ThemedText style={styles.title}>Senin enflasyonun</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Kiracıyla ev sahibinin, arabası olanla olmayanın enflasyonu aynı değil. 5 soruya cevap ver, harcama paylarını
        doldurup TÜİK’in grup artışlarıyla sana özel oranı hesaplayalım.
      </ThemedText>
      <BasketEditor onSaved={close} />
      <WorldInflationCard />
      <Disclaimer text="Tahmini bir hesaptır; resmi enflasyon TÜİK’in açıkladığıdır." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
});
