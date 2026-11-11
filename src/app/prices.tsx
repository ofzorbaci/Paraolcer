import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { holdingTitle } from '@/components/holding-card';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, Field, IconButton, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, formatTL, parseAmount } from '@/lib/format';
import { priceAgeDays, priceLookup } from '@/lib/lookup';
import { enteredLabel, enteredPrice, manualHoldings, STALE_DAYS, withEnteredPrice } from '@/lib/stale';
import { isUsdPriced, KIND_LABELS } from '@/lib/types';
import { saveHolding, useStore } from '@/state/store';

/**
 * "Fiyatları güncelle": every hand-priced holding (BIST stocks, funds and symbols the feeds do not
 * price, "Diğer") on one screen, oldest price first. Type the new prices, or tap "Aynı kaldı" to
 * mark a price checked today, then save once.
 */
export default function PricesScreen() {
  const theme = useTheme();
  useMasked();
  const all = useStore((s) => s.holdings);
  const [list] = useState(() => manualHoldings(all));
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [same, setSame] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<number>();
  const now = new Date();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/holdings'));

  const changes = list
    .map((h) => {
      const price = typed[h.id]?.trim() ? parseAmount(typed[h.id]) : undefined;
      if (price !== undefined && price > 0) return withEnteredPrice(h, price, now);
      const current = enteredPrice(h);
      if (same[h.id] && current !== undefined) return withEnteredPrice(h, current, now);
      return undefined;
    })
    .filter((h): h is NonNullable<typeof h> => !!h);

  const save = () => {
    // The latest saved copy of each holding, so nothing else on it is overwritten.
    for (const c of changes) {
      const fresh = all.find((x) => x.id === c.id);
      saveHolding(fresh ? { ...fresh, currentPrice: c.currentPrice, currentPriceUsd: c.currentPriceUsd, priceUpdatedAt: c.priceUpdatedAt } : c);
    }
    setSaved(changes.length);
    setTyped({});
    setSame({});
  };

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={close} />
        <ThemedText style={styles.title}>Fiyatları güncelle</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Bu varlıkların fiyatı otomatik gelmiyor (BIST hisseleri için lisanslı bir kaynak bağlanana kadar). “Fiyata bak” ile
        güncel fiyatı gör, buraya yaz; hepsini tek seferde kaydet. Fiyat değişmediyse “Aynı kaldı”ya dokun.
      </ThemedText>

      {list.length === 0 && (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Elle fiyat girilen bir varlığın yok; hepsinin fiyatı otomatik geliyor.
          </ThemedText>
        </Card>
      )}

      {list.map((h) => {
        const usd = isUsdPriced(h.kind);
        const current = enteredPrice(h);
        const label = enteredLabel(h, now);
        const stale = (priceAgeDays(h, now) ?? Infinity) >= STALE_DAYS;
        const lookup = priceLookup(h.kind, h.name);
        return (
          <Card key={h.id} style={styles.row}>
            <View style={styles.rowHead}>
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {holdingTitle(h)}
                </ThemedText>
                <ThemedText type="small" style={stale ? { color: theme.negative } : undefined} themeColor="textSecondary">
                  {KIND_LABELS[h.kind]} ·{' '}
                  {current !== undefined
                    ? `${usd ? formatMoney(current, '$', true) : formatTL(current, true)} · ${label ?? 'tarih yok'}`
                    : 'Henüz fiyat girilmedi'}
                </ThemedText>
              </View>
              {lookup && (
                <Button title={`Fiyata bak · ${lookup.site}`} kind="secondary" compact onPress={() => WebBrowser.openBrowserAsync(lookup.url)} />
              )}
            </View>
            <View style={styles.inputRow}>
              <Field
                style={styles.flex}
                label="Güncel birim fiyat"
                prefix={usd ? '$' : '₺'}
                decimals={6}
                keyboardType="decimal-pad"
                placeholder={current !== undefined ? String(current).replace('.', ',') : ''}
                value={typed[h.id] ?? ''}
                onChangeText={(t) => {
                  setTyped((x) => ({ ...x, [h.id]: t }));
                  setSaved(undefined);
                }}
              />
              {current !== undefined && (
                <Button
                  title={same[h.id] ? 'Aynı kaldı ✓' : 'Aynı kaldı'}
                  kind={same[h.id] ? 'primary' : 'secondary'}
                  compact
                  onPress={() => {
                    setSame((x) => ({ ...x, [h.id]: !x[h.id] }));
                    setSaved(undefined);
                  }}
                />
              )}
            </View>
          </Card>
        );
      })}

      {list.length > 0 && (
        <Button
          title={changes.length ? `${changes.length} fiyatı kaydet` : 'Kaydedilecek değişiklik yok'}
          disabled={!changes.length}
          onPress={save}
        />
      )}
      {saved !== undefined && (
        <ThemedText type="small" style={[styles.center, { color: theme.accent }]}>
          {saved} fiyat kaydedildi; yanında “Senin girdiğin” ve bugünün tarihi yazar.
        </ThemedText>
      )}
      <Disclaimer text="Elle girilen fiyatlar yalnızca bu telefonda saklanır ve hiçbir yere gönderilmez." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
  flex: { flex: 1 },
  row: { gap: Spacing.two },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  center: { textAlign: 'center' },
});
