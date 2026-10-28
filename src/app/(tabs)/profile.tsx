import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Disclaimer, Field, Row, Screen, ScreenHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { nextCpiReleases } from '@/lib/calendar';
import { WITHHOLDING_VALID_UNTIL } from '@/lib/deposit';
import { formatDate, formatMonth, formatRate, formatTL, parseAmount } from '@/lib/format';
import type { InflationSource } from '@/lib/types';
import { refreshCpi, refreshPrices, setCpiReminders, updateSettings, useStore } from '@/state/store';

const RELEASE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

export default function ProfileScreen() {
  const settings = useStore((s) => s.settings);
  const cpi = useStore((s) => s.cpi);
  const prices = useStore((s) => s.prices);
  const priceError = useStore((s) => s.priceError);
  const [rate, setRate] = useState(settings.customAnnualRate ? String(settings.customAnnualRate) : '');
  const [status, setStatus] = useState<string>();
  const [notifyStatus, setNotifyStatus] = useState<string>();
  const last = cpi.rows[cpi.rows.length - 1];
  const next = nextCpiReleases(new Date(), 1)[0];

  const onRefresh = async () => {
    setStatus('Güncelleniyor…');
    const [ok] = await Promise.all([refreshCpi(), refreshPrices()]);
    setStatus(ok ? 'TÜFE ve fiyatlar güncellendi.' : 'Fiyatlar güncellendi; TÜFE için uygulama içi veri kullanılıyor.');
  };

  const onToggleNotify = async () => {
    const on = !settings.notifyCpi;
    const ok = await setCpiReminders(on);
    setNotifyStatus(on && !ok ? 'Bildirim izni verilmedi. Telefon ayarlarından izin verebilirsin.' : undefined);
  };

  return (
    <Screen>
      <ScreenHeader title="Profil" />

      <Card>
        <ThemedText style={styles.cardTitle}>Enflasyon kaynağı</ThemedText>
        <Choice<InflationSource>
          options={[
            { value: 'tuik', label: 'TÜİK (resmi)' },
            { value: 'custom', label: 'ENAG / kendi oranım' },
          ]}
          value={settings.inflationSource}
          onChange={(inflationSource) => updateSettings({ inflationSource })}
        />
        {settings.inflationSource === 'custom' && (
          <Field
            label="Yıllık enflasyon"
            suffix="%"
            keyboardType="decimal-pad"
            placeholder="ör. 60"
            value={rate}
            onChangeText={(t) => {
              setRate(t);
              const n = parseAmount(t);
              if (n !== undefined && n < 1000) updateSettings({ customAnnualRate: n });
            }}
            hint="ENAG’ın açıkladığı ya da kendi hissettiğin yıllık oranı gir. Her varlığın süresine göre bileşik uygulanır."
          />
        )}
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Enflasyon hatırlatması</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          TÜİK her ayın 3’ünde (hafta sonuysa pazartesi) saat 10:00’da enflasyonu açıklar. Açıklandığında haber
          verelim. Sonraki: {RELEASE_FMT.format(next)}.
        </ThemedText>
        {Platform.OS === 'web' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Bildirimler yalnızca telefonda çalışır.
          </ThemedText>
        ) : (
          <Button
            title={settings.notifyCpi ? 'Hatırlatmayı kapat' : 'Hatırlatmayı aç'}
            kind={settings.notifyCpi ? 'secondary' : 'primary'}
            onPress={onToggleNotify}
          />
        )}
        {notifyStatus && (
          <ThemedText type="small" themeColor="textSecondary">
            {notifyStatus}
          </ThemedText>
        )}
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Araçlar</ThemedText>
        <Button title="Hızlı reel getiri hesabı" kind="secondary" onPress={() => router.push('/tools/calculator')} />
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Veri durumu</ThemedText>
        <Row label="Son TÜFE" value={formatMonth(last.month)} />
        <Row label="Yıllık / aylık" value={`${formatRate(last.yoy)} / ${formatRate(last.mom)}`} />
        <Row label="TÜFE kaynağı" value={cpi.live ? 'TCMB (canlı)' : 'Uygulama içi'} />
        <Row label="Dolar" value={prices.usd ? formatTL(prices.usd, true) : '—'} />
        <Row label="Euro" value={prices.eur ? formatTL(prices.eur, true) : '—'} />
        <Row label="Gram altın" value={prices.gold ? formatTL(prices.gold, true) : '—'} />
        {priceError && (
          <ThemedText type="small" themeColor="textSecondary">
            Bazı fiyatlar alınamadı: {priceError}
          </ThemedText>
        )}
        <View style={styles.gap} />
        <Button title="Verileri güncelle" kind="secondary" onPress={onRefresh} />
        {status && (
          <ThemedText type="small" themeColor="textSecondary">
            {status}
          </ThemedText>
        )}
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Mevduat stopajı</ThemedText>
        <Row label="Vadesiz ve 6 aya kadar" value="%17,5" />
        <Row label="1 yıla kadar" value="%15" />
        <Row label="1 yıldan uzun" value="%10" />
        <ThemedText type="small" themeColor="textSecondary">
          Temmuz 2025’ten sonra açılan veya yenilenen hesaplar için. {formatDate(WITHHOLDING_VALID_UNTIL)} tarihine kadar
          geçerli (11444 sayılı Cumhurbaşkanı Kararı). Varlık eklerken değiştirebilirsin.
        </ThemedText>
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Nasıl hesaplıyoruz?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Reel getiri = (1 + nominal getiri) ÷ (1 + enflasyon) − 1. Enflasyon, alış ayının TÜFE endeksinden son açıklanan aya
          kadar ölçülür (TÜİK hesaplayıcısıyla aynı yöntem). Mevduat her vade sonunda stopaj düşülerek bileşiklenir. Gram
          altın, uluslararası ons fiyatı ve Avrupa Merkez Bankası dolar kurundan hesaplanır; Kapalıçarşı fiyatından biraz
          farklı olabilir.
        </ThemedText>
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Gizlilik</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Varlıkların yalnızca bu telefonda saklanır. Hesap açman gerekmez, hiçbir sunucuya gönderilmez.
        </ThemedText>
      </Card>

      <Disclaimer text="Kaynaklar: TÜİK (TCMB aracılığıyla), Avrupa Merkez Bankası, gold-api.com · Yatırım tavsiyesi değildir" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  gap: { height: Spacing.one },
});
