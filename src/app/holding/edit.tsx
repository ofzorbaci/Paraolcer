import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Field, Icon, IconButton, Pct, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { defaultWithholding } from '@/lib/deposit';
import { formatPct, formatRate, parseAmount, todayISO } from '@/lib/format';
import { fetchTryRate } from '@/lib/fx';
import { priceLookup } from '@/lib/lookup';
import { analyzeHolding } from '@/lib/returns';
import { GOLD_LABELS, KIND_LABELS, type GoldType, type Holding, type HoldingKind } from '@/lib/types';
import { plausibilityWarnings } from '@/lib/validate';
import { newId, saveHolding, useStore } from '@/state/store';

type Group = 'deposit' | 'fx' | 'gold' | 'fund' | 'stock' | 'other';

const GROUPS: { value: Group; label: string }[] = [
  { value: 'deposit', label: 'Mevduat' },
  { value: 'fx', label: 'Döviz' },
  { value: 'gold', label: 'Altın' },
  { value: 'fund', label: 'Fon' },
  { value: 'stock', label: 'Hisse' },
  { value: 'other', label: 'Diğer' },
];

function groupOf(kind: HoldingKind): Group {
  return kind === 'usd' || kind === 'eur' ? 'fx' : kind;
}

function numText(n: number | undefined): string {
  return n === undefined ? '' : String(n).replace('.', ',');
}

export default function EditHoldingScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => s.allHoldings.find((h) => h.id === id));
  const settings = useStore((s) => s.calcSettings);
  const index = useStore((s) => s.cpi.index);
  const prices = useStore((s) => s.prices);
  const today = todayISO();

  const [group, setGroup] = useState<Group>(existing ? groupOf(existing.kind) : 'deposit');
  const [currency, setCurrency] = useState<'usd' | 'eur'>(existing?.kind === 'eur' ? 'eur' : 'usd');
  const [name, setName] = useState(existing?.name ?? '');
  const [buyDate, setBuyDate] = useState<string | undefined>(existing?.buyDate);
  const [quantity, setQuantity] = useState(numText(existing?.quantity));
  const [unitCost, setUnitCost] = useState(numText(existing?.unitCost));
  const [principal, setPrincipal] = useState(existing?.kind === 'deposit' ? numText(existing.unitCost) : '');
  const [gross, setGross] = useState(numText(existing?.grossRate ?? existing?.depositRate));
  const [term, setTerm] = useState(numText(existing?.termDays ?? 32));
  const [withholding, setWithholding] = useState(numText(existing?.withholding));
  const [current, setCurrent] = useState(numText(existing?.currentPrice));
  const [goldType, setGoldType] = useState<GoldType>(existing?.goldType ?? 'gram');
  const [rateNote, setRateNote] = useState<string>();
  const [refRate, setRefRate] = useState<number>();
  const [tried, setTried] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string>();

  const kind: HoldingKind = group === 'fx' ? currency : group;
  const isDeposit = kind === 'deposit';
  const isFx = group === 'fx';
  const isGold = kind === 'gold';
  const manualPrice = !isDeposit && !isFx && !isGold;
  const lookup = priceLookup(kind, name);

  // The ECB rate of the purchase day: pre-fills the cost and is the reference for the plausibility check.
  useEffect(() => {
    if (!isFx || !buyDate) return;
    let cancelled = false;
    fetchTryRate(currency, buyDate)
      .then((r) => {
        if (cancelled) return;
        setRefRate(r);
        if (unitCost) return;
        setUnitCost(numText(Number(r.toFixed(4))));
        setRateNote('O günün Avrupa Merkez Bankası kuru. Kendi alış kurunla değiştirebilirsin.');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFx, currency, buyDate]);

  const termDays = parseAmount(term);
  const autoWithholding = defaultWithholding(termDays && termDays > 0 ? termDays : 32);
  const draft: Partial<Holding> = isDeposit
    ? {
        quantity: 1,
        unitCost: parseAmount(principal),
        grossRate: parseAmount(gross),
        termDays: termDays ? Math.round(termDays) : undefined,
        withholding: withholding.trim() ? parseAmount(withholding) : autoWithholding,
      }
    : {
        quantity: parseAmount(quantity),
        unitCost: parseAmount(unitCost),
        currentPrice: manualPrice && current.trim() ? parseAmount(current) : undefined,
      };

  const errors = {
    date: !buyDate ? 'Tarih seç' : undefined,
    quantity: !isDeposit && !(draft.quantity && draft.quantity > 0) ? 'Sıfırdan büyük bir miktar gir' : undefined,
    cost: !(draft.unitCost && draft.unitCost > 0) ? 'Sıfırdan büyük bir tutar gir' : undefined,
    gross: isDeposit && draft.grossRate === undefined ? 'Yıllık brüt faizi gir (ör. 40)' : undefined,
    term: isDeposit && !(draft.termDays && draft.termDays > 0) ? 'Vadeyi gün olarak gir' : undefined,
    withholding: isDeposit && (draft.withholding === undefined || draft.withholding >= 100) ? 'Geçerli bir oran gir' : undefined,
    current: manualPrice && current.trim() && draft.currentPrice === undefined ? 'Geçerli bir fiyat gir' : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (e: string | undefined) => (tried ? e : undefined);

  const holding: Holding | undefined = valid
    ? {
        id: existing?.id ?? newId(),
        kind,
        name: name.trim() || (isGold ? GOLD_LABELS[goldType] : KIND_LABELS[kind]),
        goldType: isGold ? goldType : undefined,
        buyDate: buyDate!,
        quantity: draft.quantity!,
        unitCost: draft.unitCost!,
        currentPrice: draft.currentPrice,
        priceUpdatedAt:
          draft.currentPrice !== existing?.currentPrice ? new Date().toISOString() : existing?.priceUpdatedAt,
        grossRate: draft.grossRate,
        termDays: draft.termDays,
        withholding: draft.withholding,
      }
    : undefined;
  const preview = holding ? analyzeHolding(holding, today, prices, settings, index) : undefined;

  const warnings = holding ? plausibilityWarnings(holding, { referenceRate: isFx ? refRate : undefined, prices }) : [];
  const warningKey = warnings.map((w) => w.message).join('|');
  const needsConfirm = warnings.length > 0 && acknowledged !== warningKey;

  const onSave = () => {
    setTried(true);
    if (!holding) return;
    // First tap shows the warnings; a second tap on "Yine de kaydet" saves.
    if (needsConfirm) return setAcknowledged(warningKey);
    saveHolding(holding);
    router.back();
  };

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton
          name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          label="Geri"
          onPress={() => router.back()}
        />
        <ThemedText style={styles.title}>{existing ? 'Varlığı düzenle' : 'Varlık ekle'}</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="small" themeColor="textSecondary">
          Varlık türü
        </ThemedText>
        <Choice options={GROUPS} value={group} onChange={(g) => { setGroup(g); setRateNote(undefined); }} />
        {isFx && (
          <Choice
            options={[
              { value: 'usd', label: 'Dolar ($)' },
              { value: 'eur', label: 'Euro (€)' },
            ]}
            value={currency}
            onChange={(c) => { setCurrency(c); setUnitCost(''); setRateNote(undefined); }}
          />
        )}
        {isGold && (
          <Choice
            options={(Object.keys(GOLD_LABELS) as GoldType[]).map((g) => ({
              value: g,
              label: g === 'gram' ? 'Gram' : GOLD_LABELS[g].split(' ')[0],
            }))}
            value={goldType}
            onChange={setGoldType}
          />
        )}
      </View>

      <Card style={styles.form}>
        {isDeposit ? (
          <>
            <Field label="Yatırdığın tutar" prefix="₺" keyboardType="decimal-pad" placeholder="100.000" value={principal} onChangeText={setPrincipal} error={show(errors.cost)} />
            <View style={styles.pair}>
              <Field style={styles.flex} label="Yıllık brüt faiz" prefix="%" keyboardType="decimal-pad" placeholder="40" value={gross} onChangeText={setGross} error={show(errors.gross)} />
              <Field style={styles.flex} label="Vade" suffix="gün" keyboardType="number-pad" placeholder="32" value={term} onChangeText={setTerm} error={show(errors.term)} />
            </View>
            <Field
              label="Stopaj"
              prefix="%"
              keyboardType="decimal-pad"
              placeholder={String(autoWithholding).replace('.', ',')}
              value={withholding}
              onChangeText={setWithholding}
              error={show(errors.withholding)}
              hint={`Boş bırakırsan vadeye göre %${String(autoWithholding).replace('.', ',')} uygulanır.`}
            />
            <DateField label="Başlangıç tarihi" value={buyDate} onChange={setBuyDate} max={today} />
          </>
        ) : (
          <>
            {manualPrice && (
              <Field
                label={kind === 'fund' ? 'Fon kodu / adı' : kind === 'stock' ? 'Hisse kodu' : 'İsim'}
                placeholder={kind === 'fund' ? 'ör. TTE' : kind === 'stock' ? 'ör. THYAO' : KIND_LABELS[kind]}
                autoCapitalize="characters"
                value={name}
                onChangeText={setName}
              />
            )}
            <Field
              label={isFx || (isGold && goldType === 'gram') ? 'Miktar' : 'Adet'}
              prefix={isFx ? (currency === 'usd' ? '$' : '€') : undefined}
              suffix={isGold && goldType === 'gram' ? 'gr' : undefined}
              keyboardType="decimal-pad"
              value={quantity}
              onChangeText={setQuantity}
              error={show(errors.quantity)}
            />
            <DateField label="Alış tarihi" value={buyDate} onChange={setBuyDate} max={today} />
            <Field
              label={isFx ? 'Alış kuru' : isGold ? (goldType === 'gram' ? 'Gram alış fiyatı' : 'Adet alış fiyatı') : 'Birim alış fiyatı'}
              prefix="₺"
              keyboardType="decimal-pad"
              value={unitCost}
              onChangeText={(t) => { setUnitCost(t); setRateNote(undefined); }}
              error={show(errors.cost)}
              hint={rateNote}
            />
            {manualPrice ? (
              <Field
                label="Güncel birim fiyat"
                prefix="₺"
                keyboardType="decimal-pad"
                value={current}
                onChangeText={setCurrent}
                error={show(errors.current)}
                hint="Bu varlığın fiyatını şimdilik sen güncelliyorsun."
              />
            ) : null}
            {lookup && (
              <Button
                title={`Güncel fiyata bak · ${lookup.site}`}
                kind="secondary"
                compact
                icon={{ ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' }}
                onPress={() => WebBrowser.openBrowserAsync(lookup.url)}
              />
            )}
            {manualPrice ? null : (
              <ThemedText type="small" themeColor="textSecondary">
                {isGold && goldType !== 'gram'
                  ? 'Güncel değer, içindeki saf altından otomatik hesaplanır. Kuyumcu fiyatına işçilik eklendiği için biraz düşük görünebilir.'
                  : `Güncel ${isGold ? 'gram altın fiyatı' : 'kur'} otomatik alınır.`}
              </ThemedText>
            )}
          </>
        )}
      </Card>

      {preview && preview.real !== undefined && (
        <View style={[styles.preview, { backgroundColor: theme.info }]}>
          <ThemedText type="smallBold" style={{ color: theme.infoText }}>
            Anlık hesap
          </ThemedText>
          <Row
            label={isDeposit ? 'Stopaj sonrası net getiri' : 'TL getiri'}
            value={formatPct(preview.nominal!, false)}
            strong
          />
          <Row label="Aynı dönem enflasyon" value={formatPct(preview.inflation.factor - 1, false)} strong />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.previewTotal}>
            <ThemedText style={[styles.previewLabel, { color: theme.infoText }]}>Reel getirin</ThemedText>
            <Pct ratio={preview.real} size={28} />
          </View>
          {isDeposit && draft.grossRate !== undefined && draft.withholding !== undefined && (
            <ThemedText type="small" themeColor="textSecondary">
              Yıllık net faiz {formatRate(draft.grossRate * (1 - draft.withholding / 100))}
            </ThemedText>
          )}
        </View>
      )}

      <View style={styles.lock}>
        <Icon name={{ ios: 'lock', android: 'lock', web: 'lock' }} size={16} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          Verilerin yalnızca telefonunda saklanır
        </ThemedText>
      </View>
      {warnings.length > 0 && !needsConfirm && (
        <View style={[styles.warn, { backgroundColor: theme.negativeSoft, borderColor: theme.negativeBorder }]}>
          <ThemedText type="smallBold" style={{ color: theme.negative }}>
            Emin misin?
          </ThemedText>
          {warnings.map((w) => (
            <ThemedText key={w.field} type="small" style={{ color: theme.negative }}>
              • {w.message}
            </ThemedText>
          ))}
        </View>
      )}
      <Button title={warnings.length > 0 && !needsConfirm ? 'Yine de kaydet' : 'Kaydet'} onPress={onSave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800 },
  section: { gap: Spacing.two },
  form: { gap: Spacing.three },
  pair: { flexDirection: 'row', gap: 12 },
  preview: { borderRadius: 20, padding: 20, gap: Spacing.two },
  divider: { height: 1, marginVertical: Spacing.one },
  previewTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLabel: { fontSize: 18, fontWeight: 700 },
  warn: { borderWidth: 1, borderRadius: 16, padding: Spacing.three, gap: 4 },
  lock: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
});
