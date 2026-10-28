import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { BackupCard } from '@/components/backup-card';
import { RemindersCard } from '@/components/reminders-card';
import { quoteLabel } from '@/components/source-line';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Disclaimer, Field, Row, Screen, ScreenHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { currentPolicyRate } from '@/lib/feed';
import { formatDate, formatMonth, formatRate, formatStamp, formatTL, parseAmount } from '@/lib/format';
import { bugReportUrl, SUPPORT_EMAIL } from '@/lib/support';
import type { InflationSource } from '@/lib/types';
import { refreshCpi, refreshFeed, refreshPrices, updateSettings, useStore } from '@/state/store';

export default function ProfileScreen() {
  const settings = useStore((s) => s.settings);
  const cpi = useStore((s) => s.cpi);
  const priceBook = useStore((s) => s.priceBook);
  const holdings = useStore((s) => s.holdings);
  const feed = useStore((s) => s.feed);
  const feedOrigin = useStore((s) => s.feedOrigin);
  const policy = currentPolicyRate(feed);
  const priceError = useStore((s) => s.priceError);
  const [rate, setRate] = useState(settings.customAnnualRate ? String(settings.customAnnualRate) : '');
  const [status, setStatus] = useState<string>();
  const last = cpi.rows[cpi.rows.length - 1];

  const onRefresh = async () => {
    setStatus('Güncelleniyor…');
    const [ok] = await Promise.all([refreshCpi(), refreshPrices(), refreshFeed()]);
    setStatus(ok ? 'TÜFE ve fiyatlar güncellendi.' : 'Fiyatlar güncellendi; TÜFE için uygulama içi veri kullanılıyor.');
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

      <RemindersCard />

      <Card>
        <ThemedText style={styles.cardTitle}>Araçlar</ThemedText>
        <Button title="Hızlı reel getiri hesabı" kind="secondary" onPress={() => router.push('/tools/calculator')} />
      </Card>

      <BackupCard />

      <Card>
        <ThemedText style={styles.cardTitle}>Destek</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Yanlış bir rakam ya da hata mı gördün? E-posta taslağı açılır; uygulama sürümü ve veri tarihleri eklenir,
          tutarlar eklenmez.
        </ThemedText>
        <Button
          title="Hata bildir"
          kind="secondary"
          icon={{ ios: 'ladybug', android: 'bug_report', web: 'bug_report' }}
          onPress={() =>
            Linking.openURL(
              bugReportUrl({
                appVersion: Constants.expoConfig?.version ?? '?',
                platform: `${Platform.OS} ${Platform.Version}`,
                device: Device.modelName ?? undefined,
                settings,
                cpiLast: last.month,
                cpiLive: cpi.live,
                priceBook,
                priceError,
                holdings,
              }),
            ).catch(() => setStatus(`E-posta uygulaması açılamadı. ${SUPPORT_EMAIL} adresine yazabilirsin.`))
          }
        />
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Veri durumu</ThemedText>
        <Row label="Son TÜFE" value={formatMonth(last.month)} />
        <Row label="Yıllık / aylık" value={`${formatRate(last.yoy)} / ${formatRate(last.mom)}`} />
        <Row label="TÜFE kaynağı" value={cpi.live ? 'TCMB (canlı)' : 'Uygulama içi'} />
        <Row label="Politika faizi (TCMB)" value={`${formatRate(policy.rate)} · ${formatDate(policy.from)}’den beri`} />
        <Row
          label="Veri akışı"
          value={`${feedOrigin === 'live' ? 'Güncel' : feedOrigin === 'cached' ? 'Kayıtlı' : 'Uygulama içi'} · ${formatStamp(feed.generatedAt)}`}
        />
        {(
          [
            ['usd', 'Dolar'],
            ['eur', 'Euro'],
            ['gold', 'Gram altın'],
          ] as const
        ).map(([key, label]) => {
          const q = priceBook[key];
          return (
            <View key={key}>
              <Row label={label} value={q ? formatTL(q.value, true) : '—'} />
              {q && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
                  {quoteLabel(q)}
                  {q.asOf ? ` · ${formatDate(q.asOf)} kuru` : ''}
                </ThemedText>
              )}
            </View>
          );
        })}
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
        {feed.withholding.tiers.map((t, i) => {
          const prev = feed.withholding.tiers[i - 1]?.maxDays;
          const label =
            t.maxDays === null
              ? `${prev ?? 0} günden uzun`
              : i === 0
                ? `Vadesiz ve ${t.maxDays} güne kadar`
                : `${t.maxDays} güne kadar`;
          return <Row key={label} label={label} value={formatRate(t.rate)} />;
        })}
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(feed.withholding.validUntil)} tarihine kadar geçerli. Kaynak: {feed.withholding.source}. Varlık
          eklerken değiştirebilirsin.
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
  source: { textAlign: 'right' },
});
