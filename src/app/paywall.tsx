import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Icon, Radius, Screen } from '@/components/ui';
import { BrandFonts, Spacing } from '@/constants/theme';
import { FOUNDER_YEARLY_UNTIL, LIFETIME_SEATS, PREMIUM_FEATURES, YEARLY_AFTER_FOUNDER, premiumShowcase, yearlySavings, type PremiumFeature } from '@/lib/entitlements';
import { formatLongDate, groupThousands } from '@/lib/format';
import { loadPlans, manageSubscriptionsUrl, purchasesAvailable, type Plan } from '@/lib/purchases';
import { purchasePlan, restorePurchases, setDevPremium, useStore } from '@/state/store';

const legal = (Constants.expoConfig?.extra?.legal ?? {}) as { termsUrl?: string; privacyUrl?: string };
const STORE = Platform.OS === 'android' ? 'Google Play' : 'App Store';
const PLAN_LABEL: Record<Plan['period'], string> = { yearly: 'Yıllık · Kurucu fiyatı', monthly: 'Aylık', lifetime: 'Ömür boyu' };
const PER: Record<Plan['period'], string> = { yearly: ' / yıl', monthly: ' / ay', lifetime: '' };
/** The paywall is navy in both themes, like the summary's hero card. */
const C = {
  bg: '#0F1B2D',
  card: 'rgba(255,255,255,0.06)',
  cardOn: 'rgba(142,174,255,0.14)',
  border: 'rgba(255,255,255,0.14)',
  text: '#FFFFFF',
  muted: '#A8B3C7',
  accent: '#8EAEFF',
};
const SHOWN_FEATURES = 5;

const money = (n: number, currency: string) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);

/** Back to where the user came from, or to the summary when the paywall was opened by a link. */
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function PaywallScreen() {
  const { feature } = useLocalSearchParams<{ feature?: PremiumFeature }>();
  const premium = useStore((s) => s.premium);
  const holdings = useStore((s) => s.allHoldings);
  // Real seats left from the published feed; never a made-up countdown.
  const seatsLeft = useStore((s) => s.feed.offer?.lifetimeSeatsLeft);
  const showcase = premiumShowcase(holdings);
  const [plans, setPlans] = useState<Plan[]>();
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [allFeatures, setAllFeatures] = useState(false);

  useEffect(() => {
    loadPlans()
      .then((p) => {
        setPlans(p);
        setSelected(p[0]?.id);
      })
      .catch(() => setPlans([]));
  }, []);

  // The feature that brought the user here comes first, then what fits their money.
  const rank = (id: PremiumFeature) => (id === feature ? -1 : showcase.lead.includes(id) ? showcase.lead.indexOf(id) : 10);
  const features = [...PREMIUM_FEATURES].sort((a, b) => rank(a.id) - rank(b.id));
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
    <Screen tabs={false} background={C.bg}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => close()} hitSlop={10} style={styles.closeBtn}>
          <Icon name={{ ios: 'xmark', android: 'close', web: 'close' }} color={C.muted} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <ThemedText style={[styles.brand, { color: C.text }]}>{showcase.title}</ThemedText>
        <ThemedText type="small" style={{ color: C.muted }}>
          {showcase.subtitle}
        </ThemedText>
      </View>

      <View style={styles.features}>
        {features.slice(0, allFeatures ? undefined : SHOWN_FEATURES).map((f) => (
          <View key={f.id} style={styles.feature}>
            <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} color={C.accent} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" style={{ color: C.text }}>
                {f.title}
              </ThemedText>
              <ThemedText type="small" style={{ color: C.muted }}>
                {f.detail}
              </ThemedText>
            </View>
          </View>
        ))}
        {!allFeatures && features.length > SHOWN_FEATURES && (
          <Pressable accessibilityRole="button" onPress={() => setAllFeatures(true)} hitSlop={6}>
            <ThemedText type="small" style={{ color: C.accent }}>
              Ve {features.length - SHOWN_FEATURES} özellik daha · tümünü gör ›
            </ThemedText>
          </Pressable>
        )}
      </View>

      {premium.active ? (
        <View style={styles.block}>
          <ThemedText style={[styles.center, { color: C.text }]}>
            {premium.source === 'dev'
              ? 'Geliştirici modunda Premium açık.'
              : premium.trial
                ? `Deneme süren devam ediyor${premium.expiresAt ? `, ${formatLongDate(premium.expiresAt.slice(0, 10))} tarihinde bitiyor` : ''}.`
                : premium.lifetime
                  ? 'Kurucu Üyesin: Premium ömür boyu açık. Teşekkürler!'
                  : 'Premium abonesin. Teşekkürler!'}
          </ThemedText>
          {premium.source === 'store' && !premium.lifetime && (
            <Button title="Aboneliği yönet" kind="secondary" onPress={() => WebBrowser.openBrowserAsync(manageSubscriptionsUrl(premium))} />
          )}
        </View>
      ) : plans === undefined ? (
        <ActivityIndicator style={styles.block} color={C.text} />
      ) : plans.length === 0 ? (
        <View style={styles.block}>
          <ThemedText type="small" style={[styles.center, { color: C.muted }]}>
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
              const best = p.period === 'yearly' && plans.length > 1;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${PLAN_LABEL[p.period]}${best ? ', en avantajlı' : ''}, ${p.priceString}${PER[p.period]}`}
                  onPress={() => setSelected(p.id)}
                  style={[
                    styles.plan,
                    best && styles.planWithBadge,
                    { borderColor: on ? C.accent : C.border, borderWidth: on ? 2 : 1, backgroundColor: on ? C.cardOn : C.card },
                  ]}>
                  {best && (
                    <View style={styles.badge}>
                      <ThemedText style={styles.badgeText}>EN AVANTAJLI</ThemedText>
                    </View>
                  )}
                  <View style={styles.flex}>
                    <ThemedText type="smallBold" style={{ color: C.text }}>
                      {PLAN_LABEL[p.period]}
                    </ThemedText>
                    {saving && (
                      // The billed total stays the most prominent number (App Store rule 3.1.2);
                      // the monthly equivalent is the strongest of the supporting lines.
                      <ThemedText type="smallBold" style={{ color: C.accent }}>
                        Ayda {money(saving.perMonth, p.currencyCode)}
                        {saving.savingPct > 0 ? ` · %${saving.savingPct} tasarruf` : ''}
                      </ThemedText>
                    )}
                    {p.period === 'yearly' && (
                      <ThemedText type="small" style={{ color: C.muted }}>
                        {formatLongDate(FOUNDER_YEARLY_UNTIL)} tarihinden sonra {YEARLY_AFTER_FOUNDER} / yıl
                      </ThemedText>
                    )}
                    {p.period === 'lifetime' && (
                      <ThemedText type="small" style={{ color: C.muted }}>
                        Tek seferlik ödeme, abonelik yok · ilk {groupThousands(LIFETIME_SEATS)} kişi
                        {seatsLeft !== null && seatsLeft !== undefined ? ` · ${groupThousands(seatsLeft)} koltuk kaldı` : ''}
                      </ThemedText>
                    )}
                    {p.period === 'monthly' && (
                      <ThemedText type="small" style={{ color: C.muted }}>
                        İstediğin zaman iptal et
                      </ThemedText>
                    )}
                    {p.trialDays ? (
                      <ThemedText type="small" style={{ color: C.accent }}>
                        İlk {p.trialDays} gün ücretsiz
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={[styles.price, { color: C.text }]}>
                    {p.priceString}
                    <ThemedText type="small" style={{ color: C.muted }}>
                      {PER[p.period]}
                    </ThemedText>
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!plan || busy}
            onPress={() => plan && run(() => purchasePlan(plan), 'Premium açıldı. Hoş geldin!')}
            style={({ pressed }) => [styles.cta, { opacity: !plan || busy ? 0.5 : pressed ? 0.85 : 1 }]}>
            <ThemedText style={styles.ctaText}>
              {plan?.period === 'lifetime' ? 'Ömür boyu al' : plan?.trialDays ? `${plan.trialDays} gün ücretsiz dene` : 'Abone ol'}
            </ThemedText>
          </Pressable>
          {plan && (
            <ThemedText type="small" style={[styles.fine, { color: C.muted }]}>
              {plan.period === 'lifetime'
                ? `${plan.priceString}, tek seferlik. Ödeme ${STORE} hesabından alınır; otomatik yenileme yoktur.`
                : `${plan.trialDays ? `${plan.trialDays} gün ücretsiz, ardından ` : ''}${plan.priceString}${PER[plan.period]}. Ödeme ${STORE} hesabından alınır. Abonelik, dönem bitmeden en az 24 saat önce iptal edilmezse aynı fiyatla otomatik yenilenir. ${STORE} hesap ayarlarından istediğin zaman iptal edebilirsin${plan.trialDays ? '; deneme süresinde iptal edersen ücret alınmaz' : ''}.`}
            </ThemedText>
          )}
          <Pressable accessibilityRole="button" onPress={() => close()} hitSlop={8} style={styles.skip}>
            <ThemedText type="small" style={{ color: C.muted }}>
              Şimdilik ücretsiz devam et
            </ThemedText>
          </Pressable>
          {plan?.trialDays && plan.period !== 'lifetime' ? (
            <ThemedText type="small" style={[styles.center, { color: C.accent }]}>
              Sürpriz ücret yok: deneme bitmeden 2 gün önce sana hatırlatacağız.
            </ThemedText>
          ) : null}
        </>
      )}

      {busy && <ActivityIndicator color={C.text} />}
      {message && (
        <ThemedText type="small" style={[styles.center, { color: C.accent }]}>
          {message}
        </ThemedText>
      )}

      {!!legal.termsUrl && (
        <ThemedText type="small" style={[styles.center, styles.fine, { color: C.muted }]}>
          Satın alarak Kullanım Koşulları’nı kabul etmiş olursun. Dijital içerik hemen kullanıma açıldığı için cayma
          hakkı yoktur; iade talepleri {STORE} üzerinden değerlendirilir.
        </ThemedText>
      )}

      <View style={styles.links}>
        {!premium.active && purchasesAvailable() && (
          <Pressable
            accessibilityRole="button"
            onPress={() => run(restorePurchases, 'Aboneliğin geri yüklendi.', 'Bu hesapta aktif bir abonelik bulunamadı.')}>
            <ThemedText type="small" style={{ color: C.muted }}>
              Satın alımları geri yükle
            </ThemedText>
          </Pressable>
        )}
        {!!legal.termsUrl && (
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(legal.termsUrl!)}>
            <ThemedText type="small" style={{ color: C.muted }}>
              Koşullar
            </ThemedText>
          </Pressable>
        )}
        {!!legal.privacyUrl && (
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(legal.privacyUrl!)}>
            <ThemedText type="small" style={{ color: C.muted }}>
              Gizlilik
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
  closeBtn: { padding: 6 },
  hero: { gap: Spacing.two },
  logo: { width: 56, height: 56, borderRadius: 14 },
  brand: { fontFamily: BrandFonts.wordmark, fontWeight: 'normal', fontSize: 30, lineHeight: 36 },
  features: { gap: 14, marginVertical: Spacing.two },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  block: { gap: Spacing.three, marginVertical: Spacing.two },
  plans: { gap: 10 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: Radius.card, padding: Spacing.three },
  planWithBadge: { marginTop: 10 },
  badge: { position: 'absolute', top: -11, right: 16, backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { color: C.bg, fontSize: 11, lineHeight: 16, fontWeight: 800, letterSpacing: 0.5 },
  cta: { backgroundColor: C.text, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.two },
  ctaText: { color: C.bg, fontSize: 17, lineHeight: 22, fontWeight: 800 },
  skip: { alignSelf: 'center', paddingVertical: 4 },
  price: { fontSize: 18, lineHeight: 24, fontWeight: 800 },
  fine: { textAlign: 'center', fontSize: 12, lineHeight: 17 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.four, marginTop: Spacing.two },
});
