import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Field, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatDate, parseAmount, parseDate, todayISO } from '@/lib/format';
import { fetchTryRate } from '@/lib/fx';
import { KIND_LABELS, LIVE_PRICED, type Holding, type HoldingKind } from '@/lib/types';
import { newId, saveHolding, useStore } from '@/state/store';

const KINDS = Object.entries(KIND_LABELS).map(([value, label]) => ({ value: value as HoldingKind, label }));

const QUANTITY_LABEL: Record<HoldingKind, string> = {
  deposit: '',
  usd: 'Miktar (USD)',
  eur: 'Miktar (EUR)',
  gold: 'Miktar (gram)',
  stock: 'Adet',
  fund: 'Pay adedi',
  other: 'Adet',
};

function numText(n: number | undefined): string {
  return n === undefined ? '' : String(n).replace('.', ',');
}

export default function EditHoldingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => s.holdings.find((h) => h.id === id));
  const today = todayISO();

  const [kind, setKind] = useState<HoldingKind>(existing?.kind ?? 'deposit');
  const [name, setName] = useState(existing?.name ?? '');
  const [date, setDate] = useState(existing ? formatDate(existing.buyDate) : '');
  const [quantity, setQuantity] = useState(numText(existing?.quantity));
  const [unitCost, setUnitCost] = useState(numText(existing?.unitCost));
  const [amount, setAmount] = useState(existing?.kind === 'deposit' ? numText(existing.unitCost) : '');
  const [rate, setRate] = useState(numText(existing?.depositRate));
  const [current, setCurrent] = useState(numText(existing?.currentPrice));
  const [rateNote, setRateNote] = useState<string>();
  const [tried, setTried] = useState(false);

  const buyDate = parseDate(date, today);
  const isDeposit = kind === 'deposit';
  const isLive = LIVE_PRICED.includes(kind);

  // Fill the historical exchange rate for currency purchases.
  useEffect(() => {
    if (!isLive || !buyDate || unitCost) return;
    let cancelled = false;
    fetchTryRate(kind as 'usd' | 'eur', buyDate)
      .then((r) => {
        if (cancelled) return;
        setUnitCost(numText(Number(r.toFixed(4))));
        setRateNote('O günün Avrupa Merkez Bankası kuru dolduruldu, kendi alış kurunla değiştirebilirsin.');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, buyDate]);

  const q = isDeposit ? 1 : parseAmount(quantity);
  const cost = isDeposit ? parseAmount(amount) : parseAmount(unitCost);
  const depositRate = parseAmount(rate);
  const currentPrice = current.trim() ? parseAmount(current) : undefined;

  const errors = {
    date: !buyDate ? '2005 ile bugün arasında bir tarih gir (GG.AA.YYYY)' : undefined,
    quantity: !isDeposit && !(q && q > 0) ? 'Sıfırdan büyük bir miktar gir' : undefined,
    cost: !(cost && cost > 0) ? 'Sıfırdan büyük bir tutar gir' : undefined,
    rate: isDeposit && depositRate === undefined ? 'Yıllık net faiz oranını gir (ör. 42)' : undefined,
    current: current.trim() && currentPrice === undefined ? 'Geçerli bir fiyat gir' : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (e: string | undefined) => (tried ? e : undefined);

  const onSave = () => {
    setTried(true);
    if (!valid) return;
    const priceChanged = currentPrice !== existing?.currentPrice;
    const holding: Holding = {
      id: existing?.id ?? newId(),
      kind,
      name: name.trim() || KIND_LABELS[kind],
      buyDate: buyDate!,
      quantity: q!,
      unitCost: cost!,
      depositRate: isDeposit ? depositRate : undefined,
      currentPrice: isDeposit ? undefined : currentPrice,
      priceUpdatedAt: priceChanged ? new Date().toISOString() : existing?.priceUpdatedAt,
    };
    saveHolding(holding);
    router.back();
  };

  return (
    <Screen tabs={false}>
      <Card>
        <ThemedText type="smallBold">Ne aldın?</ThemedText>
        <Choice options={KINDS} value={kind} onChange={(k) => { setKind(k); setRateNote(undefined); }} />
      </Card>

      <Card>
        <Field label="İsim (isteğe bağlı)" placeholder={KIND_LABELS[kind]} value={name} onChangeText={setName} />
        <Field
          label="Alış tarihi"
          placeholder="GG.AA.YYYY"
          keyboardType="numbers-and-punctuation"
          value={date}
          onChangeText={setDate}
          error={show(errors.date)}
        />

        {isDeposit ? (
          <>
            <Field label="Yatırılan tutar (TL)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} error={show(errors.cost)} />
            <Field
              label="Yıllık net faiz (%)"
              keyboardType="decimal-pad"
              value={rate}
              onChangeText={setRate}
              error={show(errors.rate)}
              hint="Stopaj sonrası net oran. Faiz her yıl bileşik kabul edilir."
            />
          </>
        ) : (
          <>
            <Field label={QUANTITY_LABEL[kind]} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} error={show(errors.quantity)} />
            <Field
              label={isLive ? 'Alış kuru (TL)' : 'Birim alış fiyatı (TL)'}
              keyboardType="decimal-pad"
              value={unitCost}
              onChangeText={(t) => { setUnitCost(t); setRateNote(undefined); }}
              error={show(errors.cost)}
              hint={rateNote}
            />
            <Field
              label={isLive ? 'Güncel kur (TL, boş bırak: otomatik)' : 'Güncel birim fiyat (TL)'}
              keyboardType="decimal-pad"
              value={current}
              onChangeText={setCurrent}
              error={show(errors.current)}
              hint={isLive ? 'Boş bırakırsan günlük referans kur kullanılır.' : 'Bu varlığın fiyatını şimdilik sen güncelliyorsun.'}
            />
          </>
        )}
      </Card>

      <View style={styles.actions}>
        <Button title={existing ? 'Kaydet' : 'Ekle'} onPress={onSave} />
        <Button title="Vazgeç" kind="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.two },
});
