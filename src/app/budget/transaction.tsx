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
import { CURRENCY_SIGN, type Transaction, type TxType } from '@/lib/budget/types';
import { parseAmount, todayISO } from '@/lib/format';
import { checkTransaction, deleteTransaction, ensureDefaultAccount, newBudgetId, saveTransaction, useBudget } from '@/state/budget';

const TYPES: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'Gider' },
  { value: 'income', label: 'Gelir' },
  { value: 'transfer', label: 'Transfer' },
];

const text = (minor: number | undefined) => (minor === undefined ? '' : String(fromMinor(minor)).replace('.', ','));

/** Add or edit an expense, an income, or a transfer between the user's own accounts. */
export default function TransactionScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; type?: TxType }>();
  const existing = useBudget((s) => s.transactions.find((t) => t.id === params.id));
  const accounts = useBudget((s) => s.accounts);
  const today = todayISO();

  const [type, setType] = useState<TxType>(existing?.type ?? params.type ?? 'expense');
  const [amount, setAmount] = useState(text(existing?.amount));
  const [categoryId, setCategoryId] = useState<string | undefined>(existing?.categoryId);
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(existing?.toAccountId);
  const [toAmount, setToAmount] = useState(text(existing?.toAmount));
  const [date, setDate] = useState(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  const from = accounts.find((a) => a.id === accountId);
  const to = accounts.find((a) => a.id === toAccountId);
  const crossCurrency = type === 'transfer' && !!from && !!to && from.currency !== to.currency;
  const kind = type === 'income' ? 'income' : 'expense';
  const close = () => (router.canGoBack() ? router.back() : router.replace('/butce'));

  const save = () => {
    const minor = toMinor(parseAmount(amount) ?? 0);
    const t: Transaction = {
      id: existing?.id ?? newBudgetId(),
      type,
      amount: minor,
      accountId: accountId || ensureDefaultAccount().id,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      toAmount: crossCurrency ? toMinor(parseAmount(toAmount) ?? 0) : undefined,
      categoryId: type === 'transfer' ? undefined : (categoryId ?? (kind === 'income' ? 'other-in' : 'other-out')),
      date,
      note: note.trim() || undefined,
      plannedId: existing?.plannedId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const problem = checkTransaction(t);
    if (problem) return setError(problem);
    saveTransaction(t);
    close();
  };

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Kapat" onPress={close} />
        <ThemedText style={styles.title}>{existing ? 'İşlemi düzenle' : 'Yeni işlem'}</ThemedText>
      </View>

      <Choice
        options={TYPES}
        value={type}
        onChange={(v) => {
          setType(v);
          setCategoryId(undefined);
          setError(undefined);
        }}
      />

      <Card>
        <Field
          label={type === 'transfer' ? 'Gönderilen tutar' : 'Tutar'}
          prefix={from ? CURRENCY_SIGN[from.currency] : '₺'}
          keyboardType="decimal-pad"
          placeholder="0"
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            setError(undefined);
          }}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {type === 'transfer' ? 'Hangi hesaptan' : type === 'income' ? 'Hangi hesaba' : 'Hangi hesaptan'}
        </ThemedText>
        <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} />
        {type === 'transfer' && (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Hangi hesaba
            </ThemedText>
            <AccountPicker accounts={accounts} value={toAccountId} onChange={setToAccountId} exclude={accountId} />
            {accounts.length < 2 && (
              <Button title="Önce ikinci bir hesap ekle" kind="secondary" compact onPress={() => router.push('/budget/account')} />
            )}
            {crossCurrency && (
              <Field
                label={`${to!.name} hesabına geçen`}
                prefix={CURRENCY_SIGN[to!.currency]}
                keyboardType="decimal-pad"
                value={toAmount}
                onChangeText={setToAmount}
                hint="Farklı para birimleri arasında bankanın uyguladığı kurla geçen tutar."
              />
            )}
          </>
        )}
      </Card>

      {type !== 'transfer' && (
        <Card>
          <ThemedText type="smallBold">Kategori</ThemedText>
          <CategoryPicker options={categoriesFor(kind)} value={categoryId} onChange={setCategoryId} />
        </Card>
      )}

      <Card>
        <DateField label="Tarih" value={date} onChange={setDate} max={today} />
        <Field label="Not (isteğe bağlı)" placeholder={type === 'income' ? 'ör. Ekim maaşı' : 'ör. Haftalık market'} value={note} onChangeText={setNote} />
      </Card>

      {error && (
        <ThemedText type="small" style={{ color: theme.negative }}>
          {error}
        </ThemedText>
      )}
      <Button title="Kaydet" onPress={save} />
      {type === 'transfer' && (
        <ThemedText type="small" themeColor="textSecondary">
          Transfer kendi hesapların arasında para taşır; gelir ya da gider sayılmaz.
        </ThemedText>
      )}
      {existing && (
        <Button
          title={confirming ? 'Emin misin? Sil' : 'İşlemi sil'}
          kind="danger"
          onPress={() => {
            if (!confirming) return setConfirming(true);
            deleteTransaction(existing.id);
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
