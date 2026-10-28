import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { holdingTitle } from '@/components/holding-card';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, Field, IconButton, Pct, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatLongDate, formatMonth, formatPct, formatTL, parseAmount, todayISO } from '@/lib/format';
import { priceLookup } from '@/lib/lookup';
import { analyzeHolding } from '@/lib/returns';
import { isLivePriced, KIND_LABELS } from '@/lib/types';
import { deleteHolding, saveHolding, useStore } from '@/state/store';

export default function HoldingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const h = useStore((s) => s.holdings.find((x) => x.id === id));
  const settings = useStore((s) => s.settings);
  const index = useStore((s) => s.cpi.index);
  const prices = useStore((s) => s.prices);
  const [price, setPrice] = useState('');
  const [confirming, setConfirming] = useState(false);

  const header = (title: string) => (
    <View style={styles.header}>
      <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={() => router.back()} />
      <ThemedText style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>
    </View>
  );

  if (!h) {
    return (
      <Screen tabs={false}>
        {header('Varlık')}
        <ThemedText>Bu varlık bulunamadı.</ThemedText>
      </Screen>
    );
  }

  const a = analyzeHolding(h, todayISO(), prices, settings, index);
  const manual = h.kind !== 'deposit' && !isLivePriced(h.kind);
  const newPrice = parseAmount(price);
  const lookup = priceLookup(h.kind, h.name);
  const losing = a.real !== undefined && a.real < 0;

  return (
    <Screen tabs={false}>
      {header(holdingTitle(h))}

      <Card style={losing ? { borderColor: theme.negativeBorder } : undefined}>
        <ThemedText type="small" themeColor="textSecondary">
          {KIND_LABELS[h.kind]} · {formatLongDate(h.buyDate)}
        </ThemedText>
        <View style={styles.big}>
          <Pct ratio={a.real} size={44} />
          <ThemedText themeColor="textSecondary">reel getiri</ThemedText>
        </View>
        {a.realGain !== undefined && (
          <ThemedText style={{ color: a.realGain >= 0 ? theme.positive : theme.negative, fontWeight: 600 }}>
            {a.realGain >= 0
              ? `Bugünün parasıyla ${formatTL(a.realGain)} gerçek kazanç.`
              : `Bugünün parasıyla ${formatTL(-a.realGain)} alım gücü kaybı.`}
          </ThemedText>
        )}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Row label="Yatırdığın" value={formatTL(a.cost)} />
        <Row label="Bugünkü değeri" value={a.value === undefined ? '—' : formatTL(a.value)} strong />
        <Row label="Nominal getiri" value={a.nominal === undefined ? '—' : formatPct(a.nominal)} />
        <Row label="Dönem enflasyonu" value={formatPct(a.inflation.factor - 1)} />
        <Row label="Korunmak için gereken" value={formatTL(a.breakEven)} />
        {settings.inflationSource === 'tuik' && (
          <ThemedText type="small" themeColor="textSecondary">
            TÜFE: {formatMonth(a.inflation.fromMonth)} → {formatMonth(a.inflation.toMonth)}
            {a.inflation.complete ? '' : ' (son açıklanan ay)'}
          </ThemedText>
        )}
        {isLivePriced(h.kind) && prices[h.kind] !== undefined && (
          <ThemedText type="small" themeColor="textSecondary">
            Güncel {h.kind === 'gold' ? 'gram fiyatı' : 'kur'}: {formatTL(prices[h.kind]!, true)} (otomatik)
          </ThemedText>
        )}
      </Card>

      {manual && (
        <Card>
          <ThemedText style={styles.cardTitle}>Güncel fiyatı güncelle</ThemedText>
          {h.currentPrice !== undefined && (
            <ThemedText type="small" themeColor="textSecondary">
              Şu an {formatTL(h.currentPrice, true)}
              {h.priceUpdatedAt ? ` · ${formatDate(h.priceUpdatedAt.slice(0, 10))} tarihinde girildi` : ''}
            </ThemedText>
          )}
          {lookup && (
            <Button
              title={`Fiyata bak · ${lookup.site}`}
              kind="secondary"
              icon={{ ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' }}
              onPress={() => WebBrowser.openBrowserAsync(lookup.url)}
            />
          )}
          <Field label="Birim fiyat" prefix="₺" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
          <Button
            title="Fiyatı kaydet"
            disabled={!newPrice}
            onPress={() => {
              saveHolding({ ...h, currentPrice: newPrice, priceUpdatedAt: new Date().toISOString() });
              setPrice('');
            }}
          />
        </Card>
      )}

      <View style={styles.actions}>
        <Button title="Düzenle" kind="secondary" onPress={() => router.push({ pathname: '/holding/edit', params: { id: h.id } })} />
        <Button
          title={confirming ? 'Emin misin? Kalıcı olarak sil' : 'Sil'}
          kind="danger"
          onPress={() => {
            if (!confirming) return setConfirming(true);
            deleteHolding(h.id);
            router.back();
          }}
        />
      </View>

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 24, lineHeight: 30, fontWeight: 800, flex: 1 },
  big: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  divider: { height: 1, marginVertical: Spacing.one },
  cardTitle: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  actions: { gap: Spacing.two },
});
