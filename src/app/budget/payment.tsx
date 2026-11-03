import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccountPicker, CategoryPicker } from '@/components/budget/parts';
import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Field, IconButton, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { categoriesFor } from '@/lib/budget/categories';
import { fromMinor, toMinor } from '@/lib/budget/calc';
import { REPEAT_LABEL } from '@/lib/budget/planned';
import { CURRENCY_LABEL, CURRENCY_SIGN, type BudgetCurrency, type Planned, type Repeat } from '@/lib/budget/types';
import { parseAmount, todayISO } from '@/lib/format';
import { deletePlanned, newBudgetId, savePlanned, useBudget } from '@/state/budget';

const REPEATS: Repeat[] = ['monthly', 'yearly', 'weekly', 'none'];
const CURRENCIES: BudgetCurrency[] = ['TRY', 'usd', 'eur', 'gbp'];

/** Plan a bill or a subscription: amount, due date and how often it repeats. */
export default function PaymentScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; kind?: Planned['kind'] }>();
  const existing = useBudget((s) => s.planned.find((p) => p.id === params.id));
  const accounts = useBudget((s) => s.accounts);
  const today = todayISO();

  const [kind, setKind] = useState<Planned['kind']>(existing?.kind ?? params.kind ?? 'bill');
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? String(fromMinor(existing.amount)).replace('.', ',') : '');
  const [currency, setCurrency] = useState<BudgetCurrency>(existing?.currency ?? 'TRY');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? (kind === 'subscription' ? 'subscriptions' : 'bills'));
  const [accountId, setAccountId] = useState(existing?.accountId);
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? today);
  const [repeat, setRepeat] = useState<Repeat>(existing?.repeat ?? 'monthly');
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/budget/payments'));

  const save = () => {
    const minor = toMinor(parseAmount(amount) ?? 0);
    if (!name.trim()) return setError('Bir ad yaz (ör. Kira, Elektrik, Netflix)');
    if (!(minor > 0)) return setError('Sıfırdan büyük bir tutar gir');
    savePlanned({
      id: existing?.id ?? newBudgetId(),
      name: name.trim(),
      kind,
      amount: minor,
      currency,
      categoryId,
      accountId,
      dueDate,
      repeat,
      anchorDay: Number(dueDate.slice(8, 10)),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    close();
  };

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Kapat" onPress={close} />
        <ThemedText style={styles.title}>{existing ? 'Ödemeyi düzenle' : 'Ödeme planla'}</ThemedText>
      </View>

      <Choice<Planned['kind']>
        options={[
          { value: 'bill', label: 'Fatura / ödeme' },
          { value: 'subscription', label: 'Üyelik' },
        ]}
        value={kind}
        onChange={(k) => {
          setKind(k);
          if (!existing) setCategoryId(k === 'subscription' ? 'subscriptions' : 'bills');
        }}
      />

      <Card>
        <Field
          label="Adı"
          placeholder={kind === 'subscription' ? 'ör. Müzik aboneliği' : 'ör. Kira, Doğalgaz'}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(undefined);
          }}
        />
        <Field label="Tutar" prefix={CURRENCY_SIGN[currency]} keyboardType="decimal-pad" placeholder="0" value={amount} onChangeText={setAmount} />
        <Choice options={CURRENCIES.map((c) => ({ value: c, label: CURRENCY_LABEL[c] }))} value={currency} onChange={setCurrency} />
        <DateField label="Sonraki ödeme günü" value={dueDate} onChange={setDueDate} max="2099-12-31" />
        <ThemedText type="small" themeColor="textSecondary">
          Ne sıklıkla?
        </ThemedText>
        <Choice options={REPEATS.map((r) => ({ value: r, label: REPEAT_LABEL[r] }))} value={repeat} onChange={setRepeat} />
      </Card>

      <Card>
        <ThemedText type="smallBold">Kategori</ThemedText>
        <CategoryPicker options={categoriesFor('expense')} value={categoryId} onChange={setCategoryId} />
      </Card>

      {accounts.length > 0 && (
        <Card>
          <ThemedText type="smallBold">Hangi hesaptan ödenir? (isteğe bağlı)</ThemedText>
          <AccountPicker accounts={accounts} value={accountId} onChange={(id) => setAccountId(id === accountId ? undefined : id)} />
        </Card>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.negative }}>
          {error}
        </ThemedText>
      )}
      <Button title="Kaydet" onPress={save} />
      {existing && (
        <Button
          title={confirming ? 'Emin misin? Sil' : 'Planı sil'}
          kind="danger"
          onPress={() => {
            if (!confirming) return setConfirming(true);
            deletePlanned(existing.id);
            close();
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
});
