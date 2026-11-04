import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';

import { AccountPicker, Badge } from '@/components/budget/parts';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Icon, IconButton, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { category } from '@/lib/budget/categories';
import { parseStatement, type StatementRow } from '@/lib/budget/statement';
import { formatDate, formatMoney } from '@/lib/format';
import { pickSpreadsheet } from '@/lib/spreadsheet-file';
import { ensureDefaultAccount, newBudgetId, saveTransaction, useBudget } from '@/state/budget';

/** Bank or card statement → transactions, read on the phone and confirmed before anything is saved. */
export default function StatementScreen() {
  const theme = useTheme();
  useMasked();
  const accounts = useBudget((s) => s.accounts);
  const txs = useBudget((s) => s.transactions);
  const [accountId, setAccountId] = useState(accounts[0]?.id);
  const account = accounts.find((a) => a.id === accountId);
  const [card, setCard] = useState(account?.type === 'card');
  const [file, setFile] = useState<{ name: string; data: Uint8Array | string }>();
  const [rows, setRows] = useState<StatementRow[]>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/butce'));

  const read = (f: { name: string; data: Uint8Array | string }, asCard: boolean) => {
    try {
      const parsed = parseStatement(f.data, txs, asCard);
      setRows(parsed);
      setError(parsed.length === 0 ? 'Dosyada okunacak hareket bulunamadı.' : undefined);
    } catch (e) {
      setRows(undefined);
      setError(e instanceof Error ? `${e.message}. Bankanın “Excel’e aktar” ya da CSV dosyasını seç.` : 'Dosya okunamadı.');
    }
  };

  const pick = async () => {
    setBusy(true);
    try {
      const f = await pickSpreadsheet();
      if (!f) return;
      setFile(f);
      read(f, card);
    } catch {
      setError('Dosya açılamadı.');
    } finally {
      setBusy(false);
    }
  };

  const fresh = rows?.filter((r) => !r.duplicate) ?? [];
  const save = () => {
    const id = accountId ?? ensureDefaultAccount().id;
    const now = new Date().toISOString();
    for (const r of fresh) {
      saveTransaction({
        id: newBudgetId(),
        type: r.amount > 0 ? 'income' : 'expense',
        amount: Math.round(Math.abs(r.amount) * 100),
        accountId: id,
        categoryId: r.categoryId,
        date: r.date,
        note: r.description || undefined,
        createdAt: now,
      });
    }
    router.replace('/butce');
  };

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'xmark', android: 'close', web: 'close' }} label="Kapat" onPress={close} />
        <ThemedText style={styles.title}>Ekstre içe aktar</ThemedText>
      </View>

      <View style={[styles.trust, { backgroundColor: theme.info }]}>
        <Icon name={{ ios: 'airplane', android: 'airplanemode_active', web: 'airplanemode_active' }} size={20} color={theme.infoText} />
        <ThemedText type="small" style={[styles.flex, { color: theme.infoText }]}>
          Dosyan bu telefonda okunur, internete gönderilmez. İstersen uçak modunu açıp dene: içe aktarma yine çalışır.
        </ThemedText>
      </View>

      <Card>
        <ThemedText type="smallBold">1. Hangi hesabın ekstresi?</ThemedText>
        {accounts.length > 0 ? (
          <AccountPicker
            accounts={accounts}
            value={accountId}
            onChange={(id) => {
              setAccountId(id);
              const asCard = accounts.find((a) => a.id === id)?.type === 'card';
              setCard(asCard);
              if (file) read(file, asCard);
            }}
          />
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Hesap yok; hareketler “Nakit” hesabına yazılır. İstersen önce banka ya da kart hesabını ekle.
          </ThemedText>
        )}
        <View style={styles.row}>
          <ThemedText type="small" style={styles.flex}>
            Kredi kartı ekstresi (harcamalar artı yazılı)
          </ThemedText>
          <Switch
            value={card}
            onValueChange={(v) => {
              setCard(v);
              if (file) read(file, v);
            }}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
      </Card>

      <Card>
        <ThemedText type="smallBold">2. Bankandan indirdiğin dosyayı seç</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          İnternet şubesi ya da mobil uygulamadan “hesap hareketleri” ya da “kart ekstresi”ni Excel veya CSV olarak indir.
          Tarih, açıklama ve tutar sütunlarını kendimiz buluruz; kategoriyi açıklamadan tahmin ederiz.
        </ThemedText>
        <Button title={file ? 'Başka dosya seç' : 'Excel ya da CSV seç'} onPress={() => void pick()} disabled={busy} />
        {busy && <ActivityIndicator />}
        {error && (
          <ThemedText type="small" style={{ color: theme.negative }}>
            {error}
          </ThemedText>
        )}
      </Card>

      {rows && rows.length > 0 && (
        <Card>
          <ThemedText type="smallBold">3. Kontrol et</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {file?.name} · {fresh.length} yeni hareket{rows.length > fresh.length ? `, ${rows.length - fresh.length} tanesi zaten kayıtlı, atlanacak` : ''}.
            Kaydettikten sonra her birini dokunup düzeltebilirsin.
          </ThemedText>
          {fresh.slice(0, 40).map((r) => {
            const c = category(r.categoryId);
            return (
              <View key={r.line} style={styles.row}>
                <Badge icon={c.icon} color={c.color} size={32} />
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1} style={styles.rowTitle}>
                    {r.description || c.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(r.date)} · {c.name}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.rowTitle, { color: r.amount > 0 ? theme.positive : theme.negative }]}>
                  {r.amount > 0 ? '+' : '−'}
                  {formatMoney(Math.abs(r.amount), '₺', true)}
                </ThemedText>
              </View>
            );
          })}
          {fresh.length > 40 && (
            <ThemedText type="small" themeColor="textSecondary">
              ve {fresh.length - 40} hareket daha
            </ThemedText>
          )}
          <Button title={`${fresh.length} hareketi ekle`} disabled={fresh.length === 0} onPress={save} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
  trust: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 16, padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 4 },
  rowTitle: { fontSize: 15, fontWeight: 600 },
});
