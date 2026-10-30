import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { BackupCard } from '@/components/backup-card';
import { PremiumCard } from '@/components/premium-card';
import { DataCard } from '@/components/data-card';
import { SecurityCard } from '@/components/security-card';
import { quoteLabel } from '@/components/source-line';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, Row, Screen, ScreenHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { currentPolicyRate } from '@/lib/feed';
import { formatDate, formatMonth, formatRate, formatStamp, formatTL } from '@/lib/format';
import { bugReportUrl, SUPPORT_EMAIL } from '@/lib/support';
import { refreshCpi, refreshFeed, refreshPrices, rescheduleReminders, useStore } from '@/state/store';

const legal = (Constants.expoConfig?.extra?.legal ?? {}) as { privacyUrl?: string };

export default function ProfileScreen() {
  const settings = useStore((s) => s.settings);
  const cpi = useStore((s) => s.cpi);
  const priceBook = useStore((s) => s.priceBook);
  const holdings = useStore((s) => s.allHoldings);
  const feed = useStore((s) => s.feed);
  const feedOrigin = useStore((s) => s.feedOrigin);
  const policy = currentPolicyRate(feed);
  const priceError = useStore((s) => s.priceError);
  const [status, setStatus] = useState<string>();
  const last = cpi.rows[cpi.rows.length - 1];

  const onRefresh = async () => {
    setStatus('Güncelleniyor…');
    const [ok] = await Promise.all([refreshCpi(), refreshPrices(), refreshFeed()]);
    await rescheduleReminders();
    setStatus(ok ? 'TÜFE ve fiyatlar güncellendi.' : 'Fiyatlar güncellendi; TÜFE için uygulama içi veri kullanılıyor.');
  };


  return (
    <Screen>
      <ScreenHeader title="Profil" />

      <PremiumCard />

      <ThemedText type="small" themeColor="textSecondary">
        Enflasyon ölçüsü, hedef ve alarmlar, hatırlatmalar ve portföyler Araçlar sekmesinde.
      </ThemedText>

      <SecurityCard />

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
          Her rakamın formülü, kaynağı ve veri tarihi tek ekranda.
        </ThemedText>
        <Button title="Hesap yöntemini gör" kind="secondary" onPress={() => router.push('/method')} />
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Paraölçer’i kim yaptı?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Paraölçer’i, Serbest Piyasa Analiz YouTube kanalının sahibi Ömer Faruk Zorbacı yaptı. Amaç basit: birikimin
          enflasyonun önünde mi, dürüstçe ölçmek. Soru ve önerilerini “Hata bildir” ile doğrudan bana yazabilirsin.
        </ThemedText>
        <Button
          title="Kanalı aç"
          kind="secondary"
          icon={{ ios: 'play.rectangle', android: 'smart_display', web: 'smart_display' }}
          onPress={() => WebBrowser.openBrowserAsync('https://www.youtube.com/@SerbestPiyasaAnaliz')}
        />
      </Card>

      <Card>
        <ThemedText style={styles.cardTitle}>Gizlilik</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Varlıkların yalnızca bu telefonda saklanır. Hesap açman gerekmez, hiçbir sunucuya gönderilmez.
        </ThemedText>
        {!!legal.privacyUrl && (
          <Button title="Gizlilik politikası" kind="secondary" onPress={() => WebBrowser.openBrowserAsync(legal.privacyUrl!)} />
        )}
      </Card>

      <DataCard />

      <Disclaimer text="Kaynaklar: TÜİK ve TCMB, Avrupa Merkez Bankası, gold-api.com" />
      <Disclaimer
        text={`Paraölçer ${Constants.expoConfig?.version ?? ''} · Alım gücünü ölç · Bir hesaplama aracıdır, yatırım tavsiyesi vermez.`}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  gap: { height: Spacing.one },
  source: { textAlign: 'right' },
});
