import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePremium } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { basketRate } from '@/lib/basket';
import { formatRate, parseAmount } from '@/lib/format';
import type { InflationSource } from '@/lib/types';
import { updateSettings, useStore } from '@/state/store';

const num = (n: number | undefined) => (n === undefined ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

/**
 * The yardstick. Anyone can enter an ENAG/personal rate or work it out in five questions and see it
 * as one extra line on the summary; applying it to every holding is Premium.
 */
export function InflationCard() {
  const premium = usePremium();
  const settings = useStore((s) => s.settings);
  const [rate, setRate] = useState(settings.customAnnualRate ? num(settings.customAnnualRate) : '');
  const saved = settings.basket ? basketRate(settings.basket) : undefined;
  const openMine = () => router.push('/my-inflation');

  // "Benim oranım": switch to it when it exists and Premium allows; otherwise work it out first.
  const choose = (source: InflationSource) => {
    if (source === 'tuik') return updateSettings({ inflationSource: 'tuik' });
    if (premium && settings.customAnnualRate > 0) return updateSettings({ inflationSource: 'custom' });
    openMine();
  };

  return (
    <Card>
      <ThemedText style={styles.title}>Enflasyon ölçüsü</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Hesaplarda hangi enflasyon kullanılsın?
      </ThemedText>
      <Choice<InflationSource>
        options={[
          { value: 'tuik', label: 'TÜİK (resmi)' },
          { value: 'custom', label: 'Benim oranım' },
        ]}
        value={premium ? settings.inflationSource : 'tuik'}
        onChange={choose}
      />

      <View style={styles.mine}>
        <ThemedText type="smallBold">Senin enflasyonun kaç?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {saved !== undefined
            ? `Sepetine göre ${formatRate(saved)}. Cevaplarını değiştirebilir ya da kalem kalem düzenleyebilirsin.`
            : '5 soruyla kira, ulaşım, okul paylarından sana özel oranı hesapla. Ücretsiz.'}
        </ThemedText>
        <Button title={saved !== undefined ? 'Enflasyonumu aç' : '5 soruyla hesapla'} onPress={openMine} />
      </View>

      <Field
        label="ya da oranı kendin yaz (ör. ENAG)"
        suffix="%"
        keyboardType="decimal-pad"
        placeholder="ör. 60"
        value={rate}
        onChangeText={(t) => {
          setRate(t);
          const n = parseAmount(t);
          if (t.trim() === '') updateSettings({ customAnnualRate: 0 });
          else if (n !== undefined && n < 1000) updateSettings({ customAnnualRate: n });
        }}
        hint={
          premium
            ? 'Özet’te “TÜFE’ye göre −%3 · senin oranınla −%11” gibi ek bir satır görürsün; “Benim oranım”ı seçersen tüm hesaplar buna göre yapılır.'
            : 'Özet’te “TÜFE’ye göre −%3 · senin oranınla −%11” gibi ek bir satır görürsün. Tüm hesaplarda kullanmak Premium.'
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  mine: { gap: Spacing.two, marginVertical: Spacing.one },
});
