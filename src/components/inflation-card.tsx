import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { openPaywall, usePremium } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { BASKET_GROUPS, basketFromAnswers, basketRate, defaultBasket, type Basket, type BasketAnswers, type BasketGroup } from '@/lib/basket';
import { formatMonth, formatRate, parseAmount } from '@/lib/format';
import type { InflationSource } from '@/lib/types';
import { updateSettings, useStore } from '@/state/store';

const num = (n: number | undefined) => (n === undefined ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

/**
 * The yardstick. Anyone can enter an ENAG/personal rate and see it as one extra line on the
 * summary; applying it to every holding and building it from a spending basket is Premium.
 */
export function InflationCard() {
  const premium = usePremium();
  const settings = useStore((s) => s.settings);
  const officialYoy = useStore((s) => s.cpi.rows[s.cpi.rows.length - 1].yoy);
  const groups = useStore((s) => s.feed.cpiGroups);
  const [rate, setRate] = useState(settings.customAnnualRate ? num(settings.customAnnualRate) : '');
  const [basket, setBasket] = useState<Basket>(settings.basket ?? defaultBasket(officialYoy, groups));
  const [showBasket, setShowBasket] = useState(false);
  // A new basket starts with five questions; a saved one opens straight in the table.
  const [quiz, setQuiz] = useState(!settings.basket);
  const personal = basketRate(basket);

  const edit = (kind: 'weights' | 'rates', id: BasketGroup, text: string) => {
    const n = parseAmount(text);
    setBasket((b) => ({ ...b, [kind]: { ...b[kind], [id]: n ?? 0 } }));
  };

  return (
    <Card>
      <ThemedText style={styles.title}>Enflasyon ölçüsü</ThemedText>
      <Field
        label="ENAG ya da kendi yıllık oranın"
        suffix="%"
        keyboardType="decimal-pad"
        placeholder="ör. 60"
        value={rate}
        onChangeText={(t) => {
          setRate(t);
          const n = parseAmount(t);
          if (t.trim() === '') updateSettings({ customAnnualRate: 0 });
          else if (n !== undefined && n < 1000) updateSettings({ customAnnualRate: n });
        }}
        hint="Girersen Özet’te “TÜFE’ye göre −%3 · senin oranınla −%11” gibi ek bir satır görürsün."
      />
      <ThemedText type="small" themeColor="textSecondary">
        Tüm hesaplarda hangi ölçü kullanılsın?
      </ThemedText>
      <Choice<InflationSource>
        options={[
          { value: 'tuik', label: 'TÜİK (resmi)' },
          { value: 'custom', label: premium ? 'Benim oranım' : 'Benim oranım · Premium' },
        ]}
        value={premium ? settings.inflationSource : 'tuik'}
        onChange={(inflationSource) =>
          inflationSource === 'custom' && !premium ? openPaywall('enagDetail') : updateSettings({ inflationSource })
        }
      />

      <View style={styles.sep} />
      <ThemedText type="smallBold">Kişisel enflasyon sepeti{premium ? '' : ' · Premium'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Kiracıyla ev sahibinin enflasyonu aynı değil. Harcama paylarını ve yaşadığın artışları gir, sana özel oranı
        hesaplayalım.
      </ThemedText>
      {!showBasket ? (
        <Button
          title="Sepetimi hesapla"
          kind="secondary"
          onPress={() => (premium ? setShowBasket(true) : openPaywall('personalBasket'))}
        />
      ) : quiz ? (
        <BasketQuiz
          onDone={(answers) => {
            setBasket(basketFromAnswers(answers, officialYoy, groups));
            setQuiz(false);
          }}
        />
      ) : (
        <View style={styles.basket}>
          <ThemedText type="small" themeColor="textSecondary">
            Paylar cevaplarına göre dolduruldu.{' '}
            {groups
              ? `Yıllık artışlar TÜİK’in ${formatMonth(groups.month)} grup verisi; kiran ya da okul ücretin farklı arttıysa onu yaz.`
              : 'Yıllık artışlar resmi oranla başlar; kiran ya da okul ücretin ne kadar arttıysa onu yaz.'}
          </ThemedText>
          <View style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              Grup
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
              Pay
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
              Yıllık artış
            </ThemedText>
          </View>
          {BASKET_GROUPS.map((g) => (
            <View key={g.id} style={styles.row}>
              <View style={styles.flex}>
                <ThemedText type="smallBold">{g.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {g.hint}
                </ThemedText>
              </View>
              <Field
                style={styles.col}
                label=""
                suffix="%"
                keyboardType="decimal-pad"
                value={num(basket.weights[g.id])}
                onChangeText={(t) => edit('weights', g.id, t)}
              />
              <Field
                style={styles.col}
                label=""
                suffix="%"
                keyboardType="decimal-pad"
                value={num(basket.rates[g.id])}
                onChangeText={(t) => edit('rates', g.id, t)}
              />
            </View>
          ))}
          <ThemedText type="smallBold">
            Senin enflasyonun: {personal === undefined ? '—' : formatRate(personal)} · TÜİK: {formatRate(officialYoy)}
          </ThemedText>
          <Button
            title="Bu oranı kullan"
            disabled={personal === undefined}
            onPress={() => {
              updateSettings({ basket, customAnnualRate: Math.round(personal! * 100) / 100, inflationSource: 'custom' });
              setRate(num(personal));
              setShowBasket(false);
            }}
          />
        </View>
      )}
    </Card>
  );
}

const QUESTIONS: { key: keyof BasketAnswers; label: string; options: { value: string; label: string }[] }[] = [
  { key: 'rents', label: 'Kira ödüyor musun?', options: [{ value: 'y', label: 'Evet' }, { value: 'n', label: 'Hayır' }] },
  { key: 'car', label: 'Araban var mı?', options: [{ value: 'y', label: 'Evet' }, { value: 'n', label: 'Hayır' }] },
  { key: 'schoolKids', label: 'Okul çağında çocuğun var mı?', options: [{ value: 'y', label: 'Evet' }, { value: 'n', label: 'Hayır' }] },
  {
    key: 'eatOut',
    label: 'Dışarıda ne sıklıkla yemek yersin?',
    options: [
      { value: 'rarely', label: 'Nadiren' },
      { value: 'sometimes', label: 'Haftada birkaç' },
      { value: 'often', label: 'Neredeyse her gün' },
    ],
  },
  { key: 'healthHigh', label: 'Düzenli sağlık harcaman var mı?', options: [{ value: 'y', label: 'Evet' }, { value: 'n', label: 'Hayır' }] },
];

function BasketQuiz({ onDone }: { onDone: (a: BasketAnswers) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const complete = QUESTIONS.every((q) => answers[q.key]);
  return (
    <View style={styles.basket}>
      {QUESTIONS.map((q) => (
        <View key={q.key} style={styles.question}>
          <ThemedText type="smallBold">{q.label}</ThemedText>
          <Choice options={q.options} value={answers[q.key] ?? ''} onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} />
        </View>
      ))}
      <Button
        title="Paylarımı doldur"
        disabled={!complete}
        onPress={() =>
          onDone({
            rents: answers.rents === 'y',
            car: answers.car === 'y',
            schoolKids: answers.schoolKids === 'y',
            eatOut: answers.eatOut as BasketAnswers['eatOut'],
            healthHigh: answers.healthHigh === 'y',
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  question: { gap: 6 },
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  sep: { height: Spacing.two },
  basket: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  col: { width: 88 },
});
