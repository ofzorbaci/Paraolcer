import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { openPaywall } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate } from '@/lib/format';
import { manageSubscriptionsUrl, purchasesAvailable } from '@/lib/purchases';
import { restorePurchases, setDevPremium, useStore } from '@/state/store';

/** Subscription status with the actions the stores expect: subscribe, manage, restore. */
export function PremiumCard() {
  const theme = useTheme();
  const premium = useStore((s) => s.premium);
  const devPremium = useStore((s) => s.devPremium);
  const [status, setStatus] = useState<string>();
  const until = premium.expiresAt ? formatLongDate(premium.expiresAt.slice(0, 10)) : undefined;

  const line = !premium.active
    ? 'Ücretsiz sürüm · tüm varlıkların, reel skorun ve ENAG özeti ücretsiz'
    : premium.source === 'dev'
      ? 'Premium (geliştirici modu)'
      : premium.lifetime
        ? 'Kurucu Üye · ömür boyu Premium. Teşekkürler!'
        : premium.trial
        ? `Ücretsiz deneme${until ? ` · ${until} tarihinde ${premium.willRenew ? 'ücretli aboneliğe geçer' : 'biter'}` : ''}`
        : premium.willRenew
          ? `Premium${until ? ` · ${until} tarihinde yenilenir` : ''}`
          : `Premium${until ? ` · ${until} tarihinde biter (yenileme kapalı)` : ''}`;

  const onRestore = async () => {
    setStatus('Kontrol ediliyor…');
    try {
      setStatus((await restorePurchases()) ? 'Aboneliğin geri yüklendi.' : 'Bu hesapta aktif bir abonelik bulunamadı.');
    } catch {
      setStatus('Mağazaya ulaşılamadı; biraz sonra tekrar dene.');
    }
  };

  return (
    <Card style={premium.active ? { borderColor: theme.accent } : undefined}>
      <ThemedText style={styles.title}>Paraölçer Premium</ThemedText>
      <ThemedText type="small" style={{ color: premium.active ? theme.accent : theme.textSecondary }}>
        {line}
      </ThemedText>
      {!premium.active && (
        <Button title="Premium’u 7 gün ücretsiz dene" onPress={() => openPaywall()} />
      )}
      {premium.active && premium.source === 'store' && !premium.lifetime && (
        <Button
          title="Aboneliği yönet"
          kind="secondary"
          onPress={() => WebBrowser.openBrowserAsync(manageSubscriptionsUrl(premium))}
        />
      )}
      {purchasesAvailable() && !premium.active && (
        <Button title="Satın alımları geri yükle" kind="secondary" onPress={onRestore} />
      )}
      {status && (
        <ThemedText type="small" themeColor="textSecondary">
          {status}
        </ThemedText>
      )}
      {__DEV__ && (
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Geliştirici: Premium’u simüle et (mağaza sürümünde görünmez)
          </ThemedText>
          <Switch value={devPremium} onValueChange={setDevPremium} trackColor={{ true: theme.accent, false: theme.border }} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  flex: { flex: 1 },
});
