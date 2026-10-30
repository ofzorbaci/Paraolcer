import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { openPaywall, usePremium } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Disclaimer, IconButton, Pct, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { renewCheckAllowed } from '@/lib/entitlements';
import { formatLongDate, formatPct, todayISO } from '@/lib/format';
import { nextMaturity, RENEW_WINDOWS, renewComparison, type RenewWindow } from '@/lib/renew';
import { recordRenewCheck, setMaturityReminders, useStore } from '@/state/store';

const WINDOW_LABEL: Record<RenewWindow, string> = { 1: 'Son 1 ay', 3: 'Son 3 ay', 12: 'Son 12 ay' };

export default function RenewScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const h = useStore((s) => s.allHoldings.find((x) => x.id === id));
  const settings = useStore((s) => s.calcSettings);
  const usage = useStore((s) => s.settings.renewUsage);
  const notifyMaturity = useStore((s) => s.settings.notifyMaturity ?? false);
  const index = useStore((s) => s.cpi.index);
  const prices = useStore((s) => s.prices);
  const markets = useStore((s) => s.feed.markets);
  const premium = usePremium();
  const [window, setWindow] = useState<string>('12');
  const today = todayISO();
  const month = today.slice(0, 7);

  // A deposit already looked at this month stays visible; a new one uses the free monthly result.
  const seen = usage?.month === month && usage.ids.includes(id);
  const allowed = premium || seen || renewCheckAllowed(false, usage?.month, usage?.ids.length ?? 0, month);
  useEffect(() => {
    if (h && allowed && !premium && !seen) recordRenewCheck(h.id);
  }, [h, allowed, premium, seen]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!h || h.kind !== 'deposit') {
    return (
      <Screen tabs={false}>
        <ThemedText>Bu ekran mevduatlar için.</ThemedText>
        <Button title="Geri" kind="secondary" onPress={close} />
      </Screen>
    );
  }

  const maturity = nextMaturity(h, today);
  const daysLeft = maturity ? Math.round((Date.parse(maturity) - Date.parse(today)) / 86_400_000) : undefined;
  const result = renewComparison(h, Number(window) as RenewWindow, today, prices, markets, settings, index);

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={close} />
        <View style={styles.flex}>
          <ThemedText style={styles.title}>Yenilesem mi?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {h.name}
            {maturity ? ` · vade ${formatLongDate(maturity)}${daysLeft !== undefined && daysLeft <= 7 ? ` (${daysLeft === 0 ? 'bugün' : `${daysLeft} gün sonra`})` : ''}` : ''}
          </ThemedText>
        </View>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Aynı parayı aynı dönemde farklı yerlerde tutsaydın, enflasyondan arındırılmış olarak ne olurdu? Stopaj
        düşülmüş net faizle hesaplanır.
      </ThemedText>

      <Choice options={RENEW_WINDOWS.map((w) => ({ value: String(w), label: WINDOW_LABEL[w] }))} value={window} onChange={setWindow} />

      {allowed && result ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {WINDOW_LABEL[Number(window) as RenewWindow]} · aynı dönemde enflasyon {formatPct(result.inflation, false)}
          </ThemedText>
          {result.options.map((o) => (
            <View key={o.key} style={styles.option}>
              <View style={styles.flex}>
                <ThemedText style={styles.optionLabel}>{o.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  TL olarak {formatPct(o.nominal)}
                </ThemedText>
              </View>
              <Pct ratio={o.real} size={22} />
            </View>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            Sağdaki rakam reel getiri: alım gücündeki değişim.
            {!result.options.some((o) => o.key === 'gold') ? ' Bu dönem için altın verisi yok.' : ''}
          </ThemedText>
        </Card>
      ) : (
        <Card>
          <ThemedText style={styles.optionLabel}>Bu ayki ücretsiz hakkını kullandın</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ücretsiz sürümde her ay bir mevduat için “Yenilesem mi?” sonucunu görebilirsin. Premium ile tüm
            mevduatların için sınırsız.
          </ThemedText>
          <Button title="Premium’u keşfet" onPress={() => openPaywall('renewUnlimited')} />
        </Card>
      )}

      {Platform.OS !== 'web' && (
        <Card>
          <View style={styles.option}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">Vade gününde hatırlat</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Mevduatların dolmadan 2 gün önce haber verelim.
              </ThemedText>
            </View>
            <Switch value={notifyMaturity} onValueChange={(on) => void setMaturityReminders(on)} trackColor={{ true: theme.accent, false: theme.border }} />
          </View>
        </Card>
      )}

      <Button title="Nasıl hesaplandı?" kind="secondary" onPress={() => router.push('/method')} />
      <Disclaimer text="Geçmişte ne olurdu gösterir; gelecek için öneri değildir · Yatırım tavsiyesi değildir" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800 },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6 },
  optionLabel: { fontSize: 17, lineHeight: 23, fontWeight: 600 },
});
