import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { money } from '@/components/budget/parts';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, Field, IconButton, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { accountBalance, fromMinor, toMinor } from '@/lib/budget/calc';
import { ACCOUNT_TYPES, CURRENCY_LABEL, CURRENCY_SIGN, type AccountType, type BudgetCurrency } from '@/lib/budget/types';
import { parseAmount } from '@/lib/format';
import { deleteAccount, newBudgetId, saveAccount, transactionCount, useBudget } from '@/state/budget';

const CURRENCIES: BudgetCurrency[] = ['TRY', 'usd', 'eur', 'gbp'];

/** Add or edit an account: cash, bank, card, digital wallet or investment, in any currency. */
export default function AccountScreen() {
  const theme = useTheme();
  useMasked();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useBudget((s) => s.accounts.find((a) => a.id === id));
  const txs = useBudget((s) => s.transactions);
  const used = existing ? transactionCount(existing.id) : 0;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<AccountType>(existing?.type ?? 'bank');
  const [currency, setCurrency] = useState<BudgetCurrency>(existing?.currency ?? 'TRY');
  const [opening, setOpening] = useState(existing ? String(fromMinor(existing.opening)).replace('.', ',') : '');
  const [confirming, setConfirming] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/butce'));
  // A card's opening balance is usually a debt.
  const openingMinor = toMinor(parseAmount(opening.replace(/^-/, '')) ?? 0) * (opening.trim().startsWith('-') ? -1 : 1);

  const save = () => {
    saveAccount({
      id: existing?.id ?? newBudgetId(),
      name: name.trim() || ACCOUNT_TYPES.find((t) => t.id === type)!.label,
      type,
      currency,
      opening: openingMinor,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    close();
  };

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Kapat" onPress={close} />
        <ThemedText style={styles.title}>{existing ? 'Hesabı düzenle' : 'Hesap ekle'}</ThemedText>
      </View>

      {existing && (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Güncel bakiye
          </ThemedText>
          <ThemedText style={styles.balance}>{money(accountBalance(existing, txs), existing.currency)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {used} işlem
          </ThemedText>
        </Card>
      )}

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Hesap türü
        </ThemedText>
        <Choice options={ACCOUNT_TYPES.map((t) => ({ value: t.id, label: t.label }))} value={type} onChange={setType} />
        <Field label="Adı" placeholder="ör. Maaş hesabı, Bonus kart" value={name} onChangeText={setName} />
        <ThemedText type="small" themeColor="textSecondary">
          Para birimi
        </ThemedText>
        {existing && used > 0 ? (
          <ThemedText type="small">{CURRENCY_LABEL[currency]} · işlemi olan hesabın para birimi değişmez</ThemedText>
        ) : (
          <Choice options={CURRENCIES.map((c) => ({ value: c, label: CURRENCY_LABEL[c] }))} value={currency} onChange={setCurrency} />
        )}
        <Field
          label="Başlangıç bakiyesi"
          prefix={CURRENCY_SIGN[currency]}
          keyboardType="numbers-and-punctuation"
          placeholder="0"
          value={opening}
          onChangeText={setOpening}
          hint={type === 'card' ? 'Kartın borcu varsa eksi yaz: -12.500' : 'Hesabı eklediğin gün içinde olan para.'}
        />
      </Card>

      <Button title="Kaydet" onPress={save} />
      {existing && (
        <>
          <Button
            title={confirming ? `Emin misin? Hesap ve ${used} işlemi silinir` : 'Hesabı sil'}
            kind="danger"
            onPress={() => {
              if (!confirming) return setConfirming(true);
              deleteAccount(existing.id);
              close();
            }}
          />
          {confirming && (
            <ThemedText type="small" style={{ color: theme.negative }}>
              Bu geri alınamaz. Bu hesaba bağlı planlı ödemeler hesapsız olarak kalır.
            </ThemedText>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
  balance: { fontSize: 28, lineHeight: 34, fontWeight: 800 },
});
