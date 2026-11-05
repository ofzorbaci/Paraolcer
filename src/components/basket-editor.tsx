import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { openPaywall, usePremium, useUnlocked } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BASKET_GROUPS, basketFromAnswers, basketRate, defaultBasket, type Basket, type BasketAnswers, type BasketGroup } from '@/lib/basket';
import { formatMonth, formatRate, parseAmount } from '@/lib/format';
import { updateSettings, useStore } from '@/state/store';

const num = (n: number | undefined) => (n === undefined ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

/**
 * The personal basket: five questions fill the spending shares, the result shows right away and
 * can be saved for free. Fine-tuning every share and rise, and using the rate everywhere, is Premium.
 */
export function BasketEditor({ onSaved }: { onSaved?: () => void }) {
  const theme = useTheme();
  const premium = usePremium();
  const fineTune = useUnlocked('personalBasket');
  const saved = useStore((s) => s.settings.basket);
  const officialYoy = useStore((s) => s.cpi.rows[s.cpi.rows.length - 1].yoy);
  const groups = useStore((s) => s.feed.cpiGroups);
  const [basket, setBasket] = useState<Basket>(saved ?? defaultBasket(officialYoy, groups));
  // A new basket starts with the questions; a saved one opens on its result.
  const [quiz, setQuiz] = useState(!saved);
  const [editing, setEditing] = useState(false);
  const personal = basketRate(basket);
  const official = groups?.general ?? officialYoy;

  const edit = (kind: 'weights' | 'rates', id: BasketGroup, text: string) => {
    const n = parseAmount(text);
    setBasket((b) => ({ ...b, [kind]: { ...b[kind], [id]: n ?? 0 } }));
  };

  const save = (everywhere: boolean) => {
    if (personal === undefined) return;
    const rate = Math.round(personal * 100) / 100;
    updateSettings({ basket, customAnnualRate: rate, ...(everywhere && { inflationSource: 'custom' as const }) });
    onSaved?.();
  };

  if (quiz) {
    return (
      <BasketQuiz
        onDone={(answers) => {
          setBasket(basketFromAnswers(answers, officialYoy, groups));
          setQuiz(false);
        }}
      />
    );
  }

  return (
    <>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Cevaplarına göre tahmini enflasyonun
        </ThemedText>
        <View style={styles.line}>
          <ThemedText style={[styles.big, { color: personal !== undefined && personal > official ? theme.negative : theme.accent }]}>
            {personal === undefined ? '—' : formatRate(personal)}
          </ThemedText>
          <ThemedText themeColor="textSecondary">— TÜFE {formatRate(official)}</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {groups ? `Grup artışları TÜİK’in ${formatMonth(groups.month)} verisi. ` : ''}
          Bütçe’ye bir ay harcama yazınca tahmin yerine senin gerçek harcamandan hesaplarız.
        </ThemedText>
        <Button title="Kaydet: Özet’te bu orana karşı da ölç" onPress={() => save(false)} disabled={personal === undefined} />
        <Button
          title={premium ? 'Tüm hesaplarda bu oranı kullan' : 'Tüm hesaplarda kullan · Premium'}
          kind="secondary"
          onPress={() => (premium ? save(true) : openPaywall('enagDetail'))}
          disabled={personal === undefined}
        />
        <Button title="Soruları yeniden cevapla" kind="secondary" compact onPress={() => setQuiz(true)} />
      </Card>

      <Card>
        <ThemedText type="smallBold">Payları ve artışları düzenle{fineTune ? '' : ' · Premium'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Kiran ya da okul ücretin TÜİK ortalamasından farklı arttıysa kendi rakamını yaz.
        </ThemedText>
        {!editing ? (
          <Button
            title="Kalem kalem düzenle"
            kind="secondary"
            onPress={() => (fineTune ? setEditing(true) : openPaywall('personalBasket'))}
          />
        ) : (
          <View style={styles.basket}>
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
                <Field style={styles.col} label="" suffix="%" keyboardType="decimal-pad" value={num(basket.weights[g.id])} onChangeText={(t) => edit('weights', g.id, t)} />
                <Field style={styles.col} label="" suffix="%" keyboardType="decimal-pad" value={num(basket.rates[g.id])} onChangeText={(t) => edit('rates', g.id, t)} />
              </View>
            ))}
          </View>
        )}
      </Card>
    </>
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
  const answered = QUESTIONS.filter((q) => answers[q.key]).length;
  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        5 kısa soru · {answered}/5
      </ThemedText>
      {QUESTIONS.map((q) => (
        <View key={q.key} style={styles.question}>
          <ThemedText type="smallBold">{q.label}</ThemedText>
          <Choice options={q.options} value={answers[q.key] ?? ''} onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} />
        </View>
      ))}
      <Button
        title="Enflasyonumu hesapla"
        disabled={answered < QUESTIONS.length}
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
    </Card>
  );
}

const styles = StyleSheet.create({
  question: { gap: 6 },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, flexWrap: 'wrap' },
  big: { fontSize: 32, lineHeight: 40, fontWeight: 800 },
  basket: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  col: { width: 88 },
});
