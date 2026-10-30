import { Link, router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { HeroCard } from '@/components/hero';
import { MAIN_PORTFOLIO, NO_PORTFOLIOS } from '@/components/portfolios-card';
import { QuickStart } from '@/components/quick-start';
import { openPaywall, PremiumGate, usePremium } from '@/components/premium-gate';
import { SourcesFooter } from '@/components/source-line';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Disclaimer, IconButton, InfoBanner, Pct, Screen, ScreenHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAlternatives, usePortfolio } from '@/hooks/use-portfolio';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { nextCpiReleases, nextRateDecisions } from '@/lib/calendar';
import { formatMonth, formatRate, formatTL, todayISO } from '@/lib/format';
import { goalProgress, goalTarget } from '@/lib/alerts';
import { currentPolicyRate } from '@/lib/feed';
import { karneFresh } from '@/lib/karne';
import { nextMaturity } from '@/lib/renew';
import type { CpiIndex } from '@/lib/cpi';
import { analyzeHolding, analyzePortfolio } from '@/lib/returns';
import { KIND_LABELS, type Holding, type LivePrices, type Settings } from '@/lib/types';
import { maybeAskForReview, removeSamples, selectPortfolio, setReminders, updateSettings, useStore } from '@/state/store';

const RELEASE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });

export default function SummaryScreen() {
  const theme = useTheme();
  const ready = useStore((s) => s.ready);
  const lastCpi = useStore((s) => s.cpi.rows[s.cpi.rows.length - 1]);
  const { items, total, byKind, settings, ownTotal, ownRate } = usePortfolio();
  const alternatives = useAlternatives();
  const premium = usePremium();
  const hidden = useMasked();
  const restored = useStore((s) => s.restoredFromSnapshot);
  const portfolios = useStore((s) => s.settings.portfolios) ?? NO_PORTFOLIOS;
  const activePortfolio = useStore((s) => s.settings.activePortfolio);
  const goal = useStore((s) => s.settings.goal);
  const allHoldings = useStore((s) => s.allHoldings);
  const index = useStore((s) => s.cpi.index);
  const prices = useStore((s) => s.prices);
  // A positive result on screen is the moment to ask for a review (rarely, after a few opens).
  const positive = !!total && total.real >= 0 && !items.some((i) => i.holding.sample);
  useEffect(() => {
    if (positive) void maybeAskForReview(true);
  }, [positive]);
  const nextRelease = nextCpiReleases(new Date(), 1)[0];
  // The nearest deposit maturity within a week, for the "Yenilesem mi?" nudge.
  const upcoming = items
    .filter((i) => i.holding.kind === 'deposit' && !i.holding.sample)
    .map((i) => {
      const date = nextMaturity(i.holding, todayISO());
      return date && { id: i.holding.id, name: i.holding.name, days: Math.round((Date.parse(date) - Date.parse(todayISO())) / 86_400_000) };
    })
    .filter((x): x is { id: string; name: string; days: number } => !!x && x.days <= 7)
    .sort((a, b) => a.days - b.days)[0];
  const rateSchedule = useStore((s) => s.rateSchedule);
  const policy = currentPolicyRate(useStore((s) => s.feed));
  const nextRate = nextRateDecisions(new Date(), rateSchedule, 1)[0];
  const anyReminder = settings.notifyCpi || !!settings.notifyRate;
  const tuik = settings.inflationSource === 'tuik';
  const goalView = premium && goal ? goalSummary(goal, allHoldings, prices, settings, index) : undefined;

  // The bell switches both reminders; Profil lets them be set one by one.
  const toggleReminders = async () => {
    const on = !anyReminder;
    const [cpiOk] = await Promise.all([setReminders('cpi', on), nextRate && (premium || !on) ? setReminders('rate', on) : true]);
    if (!on) Alert.alert('Hatırlatmalar kapatıldı', 'Enflasyon ve faiz kararı açıklamalarında bildirim gelmeyecek.');
    else if (cpiOk)
      Alert.alert(
        'Hatırlatmalar açık',
        `Enflasyon: ${RELEASE_FMT.format(nextRelease)}, 10:00.` +
          (nextRate && premium ? `
Faiz kararı: ${RELEASE_FMT.format(nextRate)}, 14:00.` : ''),
      );
    else Alert.alert('Bildirim izni yok', 'Ayarlar’dan bildirimlere izin verip tekrar dene.');
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow={`Başlangıçtan bu yana · ${formatMonth(todayISO().slice(0, 7))}`}
        title="Paraölçer"
        wordmark
        right={
          <View style={styles.headerButtons}>
          <IconButton
            name={{ ios: hidden ? 'eye.slash' : 'eye', android: hidden ? 'visibility_off' : 'visibility', web: hidden ? 'visibility_off' : 'visibility' }}
            label={hidden ? 'Tutarları göster' : 'Tutarları gizle'}
            active={hidden}
            onPress={() => updateSettings({ hideAmounts: !hidden })}
          />
          <IconButton
            name={{ ios: anyReminder ? 'bell.fill' : 'bell', android: 'notifications', web: 'notifications' }}
            label="Enflasyon ve faiz kararı hatırlatmaları"
            active={anyReminder}
            onPress={toggleReminders}
          />
          </View>
        }
      />

      {restored && (
        <InfoBanner title="Verilerin geri yüklendi" body="Uygulama verilerine ulaşamadı ve otomatik yedekten geri yükledi." />
      )}

      {portfolios.length > 0 && (
        <Choice
          options={[{ value: 'main', label: MAIN_PORTFOLIO }, ...portfolios.map((p) => ({ value: p.id, label: p.name }))]}
          value={activePortfolio && portfolios.some((p) => p.id === activePortfolio) ? activePortfolio : 'main'}
          onChange={(v) => selectPortfolio(v === 'main' ? undefined : v)}
        />
      )}

      {ready && items.length === 0 && <QuickStart />}

      {items.some((i) => i.holding.sample) && (
        <View style={[styles.sample, { backgroundColor: theme.info }]}>
          <ThemedText type="small" style={[styles.flex, { color: theme.infoText }]}>
            Bunlar örnek verilerdir. Kendi birikimini ekleyince örnekleri silebilirsin.
          </ThemedText>
          <Button title="Örnekleri sil" kind="secondary" compact onPress={removeSamples} />
        </View>
      )}

      {total && (
        <HeroCard
          total={total}
          inflationLabel={tuik ? 'TÜFE' : 'Enflasyon'}
          own={ownTotal && ownRate ? { rate: ownRate, real: ownTotal.real } : undefined}
          // Free users see the total; the per-holding detail is Premium.
          onOwnPress={premium ? undefined : () => openPaywall('enagDetail')}
        />
      )}

      {total && karneFresh(lastCpi.month, todayISO()) && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/karne')}
          style={[styles.sample, { backgroundColor: theme.info }]}>
          <ThemedText type="small" style={[styles.flex, { color: theme.infoText }]}>
            <ThemedText type="smallBold" style={{ color: theme.infoText }}>
              {formatMonth(lastCpi.month).split(' ')[0]} karnen hazır.
            </ThemedText>{' '}
            Enflasyonun önünde misin? Bak ve paylaş ›
          </ThemedText>
        </Pressable>
      )}

      {goalView && (
        <Card>
          <View style={styles.cardHead}>
            <ThemedText style={styles.cardTitle}>Hedefin</ThemedText>
            <ThemedText type="smallBold">%{Math.round(goalView.progress * 100)}</ThemedText>
          </View>
          <View style={[styles.track, { backgroundColor: theme.border }]}>
            <View style={[styles.fill, { backgroundColor: theme.accent, width: `${goalView.progress * 100}%` }]} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {formatTL(goalView.value)} / {formatTL(goalView.target)} (bugünün lirasıyla; tüm portföyler
            {allHoldings.some((h) => h.sample) ? ', örnekler hariç' : ''})
          </ThemedText>
        </Card>
      )}

      {byKind.length > 0 && (
        <Card>
          <View style={styles.cardHead}>
            <ThemedText style={styles.cardTitle}>Kim koruyor, kim eritiyor?</ThemedText>
            <Link href="/holdings" asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <ThemedText style={[styles.link, { color: theme.accent }]}>Tümü</ThemedText>
              </Pressable>
            </Link>
          </View>
          {byKind.map((k) => (
            <View key={k.kind} style={styles.kindRow}>
              <ThemedText style={styles.kindLabel}>{KIND_LABELS[k.kind]}</ThemedText>
              <Pct ratio={k.real} size={18} />
            </View>
          ))}
        </Card>
      )}

      {total && (total.unpriced > 0 || total.incomplete) && (
        <ThemedText type="small" themeColor="textSecondary">
          {total.unpriced > 0 ? `${total.unpriced} varlığın güncel fiyatı olmadığı için hesaba katılmadı. ` : ''}
          {total.incomplete && tuik ? `TÜFE ${formatMonth(lastCpi.month)} verisine kadar hesaplandı.` : ''}
        </ThemedText>
      )}

      {alternatives.list.length > 0 && (
        <PremiumGate feature="alternatives" pitch="Aynı parayı dolarda ya da mevduatta tutsaydın bugün ne olurdu, reel olarak karşılaştır.">
        <Card>
          <ThemedText style={styles.cardTitle}>Başka ne yapabilirdin?</ThemedText>
          {alternatives.list.map((a) => (
            <View key={a.key} style={styles.kindRow}>
              <View style={styles.flex}>
                <ThemedText style={[styles.kindLabel, a.key === 'portfolio' && styles.bold]}>{a.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatTL(a.value)}
                </ThemedText>
              </View>
              <Pct ratio={a.real} size={18} />
            </View>
          ))}
          {alternatives.loading && (
            <ThemedText type="small" themeColor="textSecondary">
              Dolar karşılaştırması yükleniyor…
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            Aynı paralar aynı tarihlerde yatırılsaydı; reel getiri aynı enflasyona göre. Mevduat:{' '}
            {alternatives.terms.fromPortfolio ? 'senin mevduatlarının' : 'örnek'} koşulları (brüt{' '}
            {formatRate(alternatives.terms.grossRate)}, {alternatives.terms.termDays} gün, {formatRate(alternatives.terms.withholding)}{' '}
            stopaj) tüm dönem için varsayıldı.
          </ThemedText>
        </Card>
        </PremiumGate>
      )}

      {total && <SourcesFooter />}

      {upcoming && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/renew/[id]', params: { id: upcoming.id } })}
          style={[styles.sample, { backgroundColor: theme.info }]}>
          <ThemedText type="small" style={[styles.flex, { color: theme.infoText }]}>
            <ThemedText type="smallBold" style={{ color: theme.infoText }}>
              {upcoming.name}: vaden {upcoming.days === 0 ? 'bugün' : `${upcoming.days} gün sonra`} doluyor.
            </ThemedText>{' '}
            Yenilemeden önce son dönemde dolar ve altınla kıyasla ›
          </ThemedText>
        </Pressable>
      )}

      <InfoBanner
        title={`${formatMonth(lastCpi.month).split(' ')[0]} enflasyonu açıklandı`}
        body={`Aylık ${formatRate(lastCpi.mom)}, yıllık ${formatRate(lastCpi.yoy)}. Politika faizi ${formatRate(policy.rate)}. Sonraki açıklama ${RELEASE_FMT.format(nextRelease)}, 10:00.${nextRate ? ` Sonraki faiz kararı ${RELEASE_FMT.format(nextRate)}, 14:00.` : ''}`}
      />

      <Disclaimer />
    </Screen>
  );
}

function goalSummary(
  goal: NonNullable<Settings['goal']>,
  holdings: Holding[],
  prices: LivePrices,
  settings: Settings,
  index: CpiIndex,
) {
  const today = todayISO();
  const total = analyzePortfolio(holdings.filter((h) => !h.sample).map((h) => analyzeHolding(h, today, prices, settings, index)));
  const target = goalTarget(goal, today, settings, index);
  const value = total?.value ?? 0;
  return { value, target, progress: goalProgress(value, target) };
}

const styles = StyleSheet.create({
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.one },
  cardTitle: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  link: { fontSize: 17, fontWeight: 600 },
  kindRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  kindLabel: { fontSize: 17 },
  headerButtons: { flexDirection: 'row', gap: Spacing.two },
  sample: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 16, padding: Spacing.three },
  bold: { fontWeight: 700 },
  flex: { flex: 1 },
});
