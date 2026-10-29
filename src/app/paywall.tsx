import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Icon, IconButton, Radius, Screen } from '@/components/ui';
import { BrandFonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PREMIUM_FEATURES, yearlySavings, type PremiumFeature } from '@/lib/entitlements';
import { formatLongDate } from '@/lib/format';
import { loadPlans, manageSubscriptionsUrl, purchasesAvailable, type Plan } from '@/lib/purchases';
import { purchasePlan, restorePurchases, setDevPremium, useStore } from '@/state/store';

const legal = (Constants.expoConfig?.extra?.legal ?? {}) as { termsUrl?: string; privacyUrl?: string };
const STORE = Platform.OS === 'android' ? 'Google Play' : 'App Store';
const money = (n: number, currency: string) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);

/** Back to where the user came from, or to the summary when the paywall was opened by a link. */
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function PaywallScreen() {
  const theme = useTheme();
  const { feature } = useLocalSearchParams<{ feature?: PremiumFeature }>();
  const premium = useStore((s) => s.premium);
  const [plans, setPlans] = useState<Plan[]>();
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    loadPlans()
      .then((p) => {
        setPlans(p);
        setSelected(p[0]?.id);
      })
      .catch(() => setPlans([]));
  }, []);

  // The feature that brought the user here is listed first.
  const features = [...PREMIUM_FEATURES].sort((a, b) => Number(b.id === feature) - Number(a.id === feature));
  const plan = plans?.find((p) => p.id === selected);
  const monthly = plans?.find((p) => p.period === 'monthly');

  const run = async (job: () => Promise<boolean>, success: string, none?: string) => {
    setBusy(true);
    setMessage(undefined);
    try {
      const ok = await job();
      if (ok) {
        setMessage(success);
        setTimeout(close, 900);
      } else if (none) setMessage(none);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Bir şeyler ters gitti.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabs={false}>
      <View style={styles.top}>
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Kapat" onPress={() => close()} />
      </View>

      <View style={styles.hero}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <ThemedText style={styles.brand}>Paraölçer Premium</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Alım gücünü tam ölç: geçmişini, senaryolarını ve alternatiflerini gör.
        </ThemedText>
      </View>

      <View style={[styles.features, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {features.map((f) => (
          <View key={f.id} style={styles.feature}>
            <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} color={theme.accent} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{f.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {f.detail}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      {premium.active ? (
        <View style={styles.block}>
          <ThemedText style={styles.center}>
            {premium.source === 'dev'
              ? 'Geliştirici modunda Premium açık.'
              : premium.trial
                ? `Deneme süren devam ediyor${premium.expiresAt ? `, ${formatLongDate(premium.expiresAt.slice(0, 10))} tarihinde bitiyor` : ''}.`
                : 'Premium abonesin. Teşekkürler!'}
          </ThemedText>
          {premium.source === 'store' && (
            <Button title="Aboneliği yönet" kind="secondary" onPress={() => WebBrowser.openBrowserAsync(manageSubscriptionsUrl(premium))} />
          )}
        </View>
      ) : plans === undefined ? (
        <ActivityIndicator style={styles.block} />
      ) : plans.length === 0 ? (
        <View style={styles.block}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {purchasesAvailable()
              ? 'Abonelik seçenekleri şu an yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.'
              : `Abonelik, uygulamanın ${STORE} sürümünde açılacak.`}
          </ThemedText>
          {__DEV__ && (
            <Button title="Geliştirici: Premium'u simüle et" kind="secondary" onPress={() => { setDevPremium(true); close(); }} />
          )}
        </View>
      ) : (
        <>
          <View style={styles.plans}>
            {plans.map((p) => {
              const on = p.id === selected;
              const saving = p.period === 'yearly' && monthly ? yearlySavings(monthly.price, p.price) : undefined;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setSelected(p.id)}
                  style={[
                    styles.plan,
                    { borderColor: on ? theme.accent : theme.border, borderWidth: on ? 2 : 1, backgroundColor: on ? theme.info : theme.backgroundElement },
                  ]}>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">{p.period === 'yearly' ? 'Yıllık' : 'Aylık'}</ThemedText>
                    {saving && (
                      <ThemedText type="small" themeColor="textSecondary">
                        Aylık {money(saving.perMonth, p.currencyCode)}’ye denk{saving.savingPct > 0 ? ` · %${saving.savingPct} tasarruf` : ''}
                      </ThemedText>
                    )}
                    {p.trialDays ? (
                      <ThemedText type="small" style={{ color: theme.accent }}>
                        İlk {p.trialDays} gün ücretsiz
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={styles.price}>
                    {p.priceString}
                    <ThemedText type="small" themeColor="textSecondary">
                      {p.period === 'yearly' ? ' / yıl' : ' / ay'}
                    </ThemedText>
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Button
            title={plan?.trialDays ? `${plan.trialDays} gün ücretsiz başla` : 'Abone ol'}
            disabled={!plan || busy}
            onPress={() => plan && run(() => purchasePlan(plan), 'Premium açıldı. Hoş geldin!')}
          />
          {plan && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.fine}>
              {plan.trialDays
                ? `${plan.trialDays} gün ücretsiz, ardından ${plan.priceString} / ${plan.period === 'yearly' ? 'yıl' : 'ay'}. `
                : `${plan.priceString} / ${plan.period === 'yearly' ? 'yıl' : 'ay'}. `}
              Ödeme {STORE} hesabından alınır. Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse aynı fiyatla
              otomatik yenilenir. {STORE} hesap ayarlarından istediğin zaman iptal edebilirsin
              {plan.trialDays ? '; deneme süresinde iptal edersen ücret alınmaz' : ''}.
            </ThemedText>
          )}
        </>
      )}

      {busy && <ActivityIndicator />}
      {message && (
        <ThemedText type="small" style={[styles.center, { color: theme.accent }]}>
          {message}
        </ThemedText>
      )}

      <View style={styles.links}>
        {!premium.active && purchasesAvailable() && (
          <Pressable
            accessibilityRole="button"
            onPress={() => run(restorePurchases, 'Aboneliğin geri yüklendi.', 'Bu hesapta aktif bir abonelik bulunamadı.')}>
            <ThemedText type="small" style={{ color: theme.accent }}>
              Satın alımları geri yükle
            </ThemedText>
          </Pressable>
        )}
        {!!legal.termsUrl && (
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(legal.termsUrl!)}>
            <ThemedText type="small" themeColor="textSecondary">
              Kullanım koşulları
            </ThemedText>
          </Pressable>
        )}
        {!!legal.privacyUrl && (
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(legal.privacyUrl!)}>
            <ThemedText type="small" themeColor="textSecondary">
              Gizlilik politikası
            </ThemedText>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  top: { alignItems: 'flex-end' },
  hero: { alignItems: 'center', gap: Spacing.two },
  logo: { width: 72, height: 72, borderRadius: 18 },
  brand: { fontFamily: BrandFonts.wordmark, fontWeight: 'normal', fontSize: 26, lineHeight: 32 },
  features: { borderWidth: 1, borderRadius: Radius.card, padding: 20, gap: 14 },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  block: { gap: Spacing.three, marginVertical: Spacing.two },
  plans: { gap: 10 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.inner, padding: Spacing.three },
  price: { fontSize: 18, lineHeight: 24, fontWeight: 800 },
  fine: { textAlign: 'center', fontSize: 12, lineHeight: 17 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.four, marginTop: Spacing.two },
});
