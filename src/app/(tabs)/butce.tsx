import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, money, TxRow } from '@/components/budget/parts';
import { PersonalInflationCard } from '@/components/budget/personal-inflation-card';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field, IconButton, Screen, ScreenHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { accountBalance, addDays, byCategory, monthRange, toMinor, totalBalance, totals, weekRange } from '@/lib/budget/calc';
import { occurrences } from '@/lib/budget/planned';
import { ACCOUNT_TYPES, type Account } from '@/lib/budget/types';
import { formatDate, formatLongDate, formatTL, parseAmount, todayISO } from '@/lib/format';
import { ensureDefaultAccount, payPlanned, setBudgetPrefs, useBudget } from '@/state/budget';
import { useStore } from '@/state/store';

/** Day-to-day money: balance across accounts, this week's spending, bills due, where it went. */
export default function BudgetScreen() {
  const theme = useTheme();
  useMasked();
  const accounts = useBudget((s) => s.accounts);
  const txs = useBudget((s) => s.transactions);
  const planned = useBudget((s) => s.planned);
  const prefs = useBudget((s) => s.prefs);
  const ready = useBudget((s) => s.ready);
  const rates = useStore((s) => s.prices);
  const today = todayISO();
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const { total, missing } = totalBalance(accounts, txs, rates);
  const month = totals(txs, monthRange(today.slice(0, 7)), accounts, rates);
  const week = totals(txs, weekRange(today), accounts, rates);
  const top = byCategory(txs, monthRange(today.slice(0, 7)), accounts, rates).slice(0, 4);
  const recent = [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  // Overdue and the next seven days.
  const due = planned
    .flatMap((p) => occurrences(p, '2000-01-01', addDays(today, 7), 1).map((date) => ({ p, date })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const empty = ready && txs.length === 0 && planned.length === 0;

  const add = (type?: 'income') => {
    ensureDefaultAccount();
    router.push({ pathname: '/budget/transaction', params: type ? { type } : {} });
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow={formatLongDate(today)}
        title="Bütçe"
        right={<IconButton name={{ ios: 'plus', android: 'add', web: 'add' }} label="İşlem ekle" onPress={() => add()} />}
      />

      {empty ? (
        <Card>
          <ThemedText style={styles.cardTitle}>Paran nereye gidiyor?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Harcamalarını, gelirlerini ve yaklaşan ödemelerini buraya yaz; haftalık limitini ve bu ayın dağılımını
            görelim. Hesap açmana gerek yok, her şey telefonunda kalır.
          </ThemedText>
          <Button title="İlk harcamanı ekle" onPress={() => add()} />
          <Button title="Gelir ekle" kind="secondary" onPress={() => add('income')} />
          <Button title="Fatura ya da üyelik planla" kind="secondary" onPress={() => router.push('/budget/payment')} />
          <Button title="Banka ya da kart ekstresi içe aktar" kind="secondary" onPress={() => router.push('/budget/statement')} />
        </Card>
      ) : (
        <>
          <View style={[styles.hero, { backgroundColor: theme.hero }]}>
            <ThemedText type="small" style={{ color: theme.heroMuted }}>
              Toplam bakiye
            </ThemedText>
            <ThemedText style={[styles.big, { color: theme.heroText }]} adjustsFontSizeToFit numberOfLines={1}>
              {formatTL(total, true)}
            </ThemedText>
            {missing.length > 0 && (
              <ThemedText type="small" style={{ color: theme.heroMuted }}>
                {missing.map((a) => a.name).join(', ')} kur gelene kadar toplama katılmadı.
              </ThemedText>
            )}
            <View style={styles.heroRow}>
              <View style={styles.flex}>
                <ThemedText type="small" style={{ color: theme.heroMuted }}>
                  Bu ay gelir
                </ThemedText>
                <ThemedText style={[styles.heroValue, { color: theme.heroAccent }]}>+{formatTL(month.income)}</ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText type="small" style={{ color: theme.heroMuted }}>
                  Bu ay gider
                </ThemedText>
                <ThemedText style={[styles.heroValue, { color: '#FDBA74' }]}>−{formatTL(month.expense)}</ThemedText>
              </View>
            </View>
          </View>

          <PersonalInflationCard />

          <WeekCard spent={week.expense} limit={prefs.weeklyLimit} />

          <Card>
            <View style={styles.head}>
              <ThemedText style={styles.cardTitle}>Yaklaşan ödemeler</ThemedText>
              <Link label="Tümü" onPress={() => router.push('/budget/payments')} />
            </View>
            {due.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Önümüzdeki 7 günde ödeme yok. Kira, fatura ve üyeliklerini planla, günü gelince buradan tek dokunuşla öde.
              </ThemedText>
            ) : (
              due.slice(0, 5).map(({ p, date }) => (
                <View key={`${p.id}${date}`} style={styles.dueRow}>
                  <View style={styles.flex}>
                    <ThemedText style={styles.rowTitle} numberOfLines={1}>
                      {p.name}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: date < today ? theme.negative : theme.textSecondary }}>
                      {date < today ? `Gecikti · ${formatDate(date)}` : date === today ? 'Bugün' : formatDate(date)} · {money(p.amount, p.currency)}
                    </ThemedText>
                  </View>
                  <Button
                    title="Öde"
                    kind="secondary"
                    compact
                    onPress={() => payPlanned(p.id, p.accountId ?? ensureDefaultAccount().id, today)}
                  />
                </View>
              ))
            )}
            <Button title="Ödeme planla" kind="secondary" compact onPress={() => router.push('/budget/payment')} />
          </Card>

          <Card>
            <View style={styles.head}>
              <ThemedText style={styles.cardTitle}>Bu ay nereye gitti?</ThemedText>
              <Link label="Analizler" onPress={() => router.push('/budget/analysis')} />
            </View>
            {top.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Bu ay henüz harcama yok.
              </ThemedText>
            ) : (
              top.map((r) => (
                <View key={r.id} style={styles.catRow}>
                  <Badge icon={r.icon} color={r.color} size={32} />
                  <View style={styles.flex}>
                    <View style={styles.head}>
                      <ThemedText style={styles.rowTitle}>{r.label}</ThemedText>
                      <ThemedText style={styles.rowTitle}>{formatTL(r.amount)}</ThemedText>
                    </View>
                    <View style={[styles.track, { backgroundColor: theme.border }]}>
                      <View style={[styles.fill, { backgroundColor: r.color, width: `${Math.max(2, r.share * 100)}%` }]} />
                    </View>
                  </View>
                </View>
              ))
            )}
          </Card>

          <Accounts accounts={accounts} balances={(a) => accountBalance(a, txs)} />

          <Card>
            <ThemedText style={styles.cardTitle}>Son işlemler</ThemedText>
            {recent.map((t) => (
              <TxRow key={t.id} t={t} accounts={byId} />
            ))}
            <View style={styles.pair}>
              <View style={styles.flex}>
                <Button title="Gider ekle" onPress={() => add()} />
              </View>
              <View style={styles.flex}>
                <Button title="Gelir ekle" kind="secondary" onPress={() => add('income')} />
              </View>
            </View>
            <Button title="Ekstre içe aktar" kind="secondary" compact onPress={() => router.push('/budget/statement')} />
          </Card>
        </>
      )}
    </Screen>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <ThemedText style={[styles.link, { color: theme.accent }]}>{label} ›</ThemedText>
    </Pressable>
  );
}

/** This week's spending against the user's own limit. */
function WeekCard({ spent, limit }: { spent: number; limit?: number }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const limitTl = limit ? limit / 100 : undefined;
  const ratio = limitTl ? spent / limitTl : 0;
  const over = limitTl !== undefined && spent > limitTl;

  return (
    <Card style={over ? { borderColor: theme.negativeBorder } : undefined}>
      <View style={styles.head}>
        <ThemedText style={styles.cardTitle}>Bu hafta harcadığın</ThemedText>
        {limitTl !== undefined && (
          <ThemedText type="smallBold" style={{ color: over ? theme.negative : theme.textSecondary }}>
            %{Math.round(ratio * 100)}
          </ThemedText>
        )}
      </View>
      <ThemedText style={[styles.week, { color: over ? theme.negative : theme.text }]}>
        {formatTL(spent)}
        {limitTl !== undefined && <ThemedText themeColor="textSecondary"> / {formatTL(limitTl)}</ThemedText>}
      </ThemedText>
      {limitTl !== undefined && (
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View style={[styles.fill, { backgroundColor: over ? theme.negative : theme.accent, width: `${Math.min(100, ratio * 100)}%` }]} />
        </View>
      )}
      {over && (
        <ThemedText type="small" style={{ color: theme.negative }}>
          Limiti {formatTL(spent - limitTl!)} aştın. Hafta pazartesi yeniden başlar.
        </ThemedText>
      )}
      {editing ? (
        <>
          <Field label="Haftalık limit" prefix="₺" keyboardType="decimal-pad" placeholder="5.000" value={text} onChangeText={setText} />
          <View style={styles.pair}>
            <View style={styles.flex}>
              <Button
                title="Kaydet"
                disabled={!parseAmount(text)}
                onPress={() => {
                  setBudgetPrefs({ weeklyLimit: toMinor(parseAmount(text)!) });
                  setEditing(false);
                }}
              />
            </View>
            {limit !== undefined && (
              <View style={styles.flex}>
                <Button
                  title="Limiti kaldır"
                  kind="secondary"
                  onPress={() => {
                    setBudgetPrefs({ weeklyLimit: undefined });
                    setEditing(false);
                  }}
                />
              </View>
            )}
          </View>
        </>
      ) : (
        <Button
          title={limit ? 'Limiti değiştir' : 'Haftalık harcama limiti koy'}
          kind="secondary"
          compact
          onPress={() => {
            setText(limitTl ? String(limitTl).replace('.', ',') : '');
            setEditing(true);
          }}
        />
      )}
    </Card>
  );
}

/** Accounts grouped by type, each with its balance in its own currency. */
function Accounts({ accounts, balances }: { accounts: Account[]; balances: (a: Account) => number }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.head}>
        <ThemedText style={styles.cardTitle}>Hesaplar</ThemedText>
        <Link label="Hesap ekle" onPress={() => router.push('/budget/account')} />
      </View>
      {ACCOUNT_TYPES.filter((t) => accounts.some((a) => a.type === t.id)).map((t) => (
        <View key={t.id} style={styles.group}>
          <ThemedText type="small" themeColor="textSecondary">
            {t.label}
          </ThemedText>
          {accounts
            .filter((a) => a.type === t.id)
            .map((a) => {
              const b = balances(a);
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/budget/account', params: { id: a.id } })}
                  style={styles.dueRow}>
                  <Badge icon={t.icon} color={theme.accent} size={32} />
                  <ThemedText style={[styles.rowTitle, styles.flex]} numberOfLines={1}>
                    {a.name}
                  </ThemedText>
                  <ThemedText style={styles.rowTitle}>{money(b, a.currency)}</ThemedText>
                </Pressable>
              );
            })}
        </View>
      ))}
      {accounts.some((a) => a.currency !== 'TRY') && (
        <ThemedText type="small" themeColor="textSecondary">
          Döviz hesapları toplam bakiyeye güncel kurla çevrilir.
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { borderRadius: 24, padding: Spacing.four, gap: Spacing.one },
  big: { fontSize: 34, lineHeight: 42, fontWeight: 800 },
  heroRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  heroValue: { fontSize: 18, fontWeight: 700 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  cardTitle: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  link: { fontSize: 15, fontWeight: 600 },
  week: { fontSize: 26, lineHeight: 32, fontWeight: 800 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 6 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 4 },
  rowTitle: { fontSize: 16, fontWeight: 600 },
  group: { gap: 2 },
  pair: { flexDirection: 'row', gap: Spacing.two },
});
