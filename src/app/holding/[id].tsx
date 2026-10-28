import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, Field, ReturnPill, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMonth, formatPct, formatTL, parseAmount, todayISO } from '@/lib/format';
import { analyzeHolding } from '@/lib/returns';
import { KIND_LABELS, LIVE_PRICED } from '@/lib/types';
import { deleteHolding, saveHolding, useStore } from '@/state/store';

export default function HoldingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const h = useStore((s) => s.holdings.find((x) => x.id === id));
  const settings = useStore((s) => s.settings);
  const index = useStore((s) => s.cpi.index);
  const fx = useStore((s) => s.fx);
  const [price, setPrice] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (!h) {
    return (
      <Screen tabs={false}>
        <ThemedText>Bu varlık bulunamadı.</ThemedText>
      </Screen>
    );
  }

  const a = analyzeHolding(h, todayISO(), fx, settings, index);
  const manual = h.kind !== 'deposit' && !LIVE_PRICED.includes(h.kind);
  const newPrice = parseAmount(price);

  return (
    <Screen tabs={false}>
      <Stack.Screen options={{ title: h.name }} />

      <Card>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">{h.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {KIND_LABELS[h.kind]} · {formatDate(h.buyDate)}
            </ThemedText>
          </View>
          <ReturnPill ratio={a.real} />
        </View>
        <Row label="Yatırdığın" value={formatTL(a.cost)} />
        <Row label="Bugünkü değeri" value={a.value === undefined ? '—' : formatTL(a.value)} strong />
        <Row label="Nominal getiri" value={a.nominal === undefined ? '—' : formatPct(a.nominal)} />
        <Row label="Dönem enflasyonu" value={formatPct(a.inflation.factor - 1)} />
        <Row label="Reel getiri" value={a.real === undefined ? '—' : formatPct(a.real)} strong />
        <Row label="Korunmak için gereken" value={formatTL(a.breakEven)} />
        {a.realGain !== undefined && (
          <ThemedText type="small" style={{ color: a.realGain >= 0 ? theme.positive : theme.negative }}>
            {a.realGain >= 0
              ? `Bugünün parasıyla ${formatTL(a.realGain)} gerçek kazanç.`
              : `Bugünün parasıyla ${formatTL(-a.realGain)} gerçek kayıp.`}
          </ThemedText>
        )}
        {settings.inflationSource === 'tuik' && (
          <ThemedText type="small" themeColor="textSecondary">
            TÜFE: {formatMonth(a.inflation.fromMonth)} → {formatMonth(a.inflation.toMonth)}
            {a.inflation.complete ? '' : ' (son açıklanan ay)'}
          </ThemedText>
        )}
      </Card>

      {manual && (
        <Card>
          <ThemedText type="smallBold">Güncel fiyatı güncelle</ThemedText>
          {h.currentPrice !== undefined && (
            <ThemedText type="small" themeColor="textSecondary">
              Şu an: {formatTL(h.currentPrice, true)}
              {h.priceUpdatedAt ? ` · ${formatDate(h.priceUpdatedAt.slice(0, 10))}` : ''}
            </ThemedText>
          )}
          <Field label="Birim fiyat (TL)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
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
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { gap: Spacing.two },
});
