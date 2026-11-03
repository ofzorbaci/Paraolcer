import { router } from 'expo-router';
import type { SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { category } from '@/lib/budget/categories';
import { fromMinor } from '@/lib/budget/calc';
import { CURRENCY_SIGN, type Account, type BudgetCurrency, type Category, type Transaction } from '@/lib/budget/types';
import { formatDate, formatMoney } from '@/lib/format';

/** Material Symbols names (Android, web) → SF Symbols (iOS). */
const SF: Record<string, string> = {
  shopping_cart: 'cart',
  home: 'house',
  bolt: 'bolt',
  restaurant: 'fork.knife',
  directions_car: 'car',
  shopping_bag: 'bag',
  medical_services: 'cross.case',
  school: 'graduationcap',
  movie: 'film',
  subscriptions: 'play.rectangle',
  credit_score: 'creditcard',
  trending_up: 'chart.line.uptrend.xyaxis',
  more_horiz: 'ellipsis',
  work: 'briefcase',
  laptop: 'laptopcomputer',
  home_work: 'building.2',
  savings: 'banknote',
  payments: 'banknote',
  account_balance: 'building.columns',
  credit_card: 'creditcard',
  account_balance_wallet: 'wallet.pass',
  swap_horiz: 'arrow.left.arrow.right',
};

export function symbol(material: string): SymbolViewProps['name'] {
  return { ios: (SF[material] ?? 'circle') as never, android: material as never, web: material as never };
}

/** "₺1.250" / "$40,5" from minor units, honouring "hide amounts". */
export function money(minor: number, currency: BudgetCurrency = 'TRY', precise = true): string {
  return formatMoney(fromMinor(minor), CURRENCY_SIGN[currency], precise);
}

/** Round coloured icon for a category or an account type. */
export function Badge({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22` }]}>
      <Icon name={symbol(icon)} size={size * 0.5} color={color} />
    </View>
  );
}

/** A grid of tappable categories with icons. */
export function CategoryPicker({ options, value, onChange }: { options: Category[]; value?: string; onChange: (id: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {options.map((c) => {
        const on = c.id === value;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={c.name}
            onPress={() => onChange(c.id)}
            style={[styles.cat, { borderColor: on ? c.color : theme.border, backgroundColor: on ? `${c.color}1A` : theme.backgroundElement }]}>
            <Icon name={symbol(c.icon)} size={18} color={c.color} />
            <ThemedText type="small" numberOfLines={1} style={on ? { color: c.color, fontWeight: 700 } : undefined}>
              {c.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Chips for picking one of the user's accounts. */
export function AccountPicker({ accounts, value, onChange, exclude }: { accounts: Account[]; value?: string; onChange: (id: string) => void; exclude?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {accounts
        .filter((a) => a.id !== exclude)
        .map((a) => {
          const on = a.id === value;
          return (
            <Pressable
              key={a.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(a.id)}
              style={[styles.acc, { backgroundColor: on ? theme.chip : theme.backgroundElement, borderColor: on ? theme.chip : theme.border }]}>
              <ThemedText type="small" numberOfLines={1} style={{ color: on ? theme.onChip : theme.text, fontWeight: 600 }}>
                {a.name} {a.currency === 'TRY' ? '' : CURRENCY_SIGN[a.currency]}
              </ThemedText>
            </Pressable>
          );
        })}
    </View>
  );
}

/** One transaction in a list: category icon, name, account and date, signed amount. Tapping edits it. */
export function TxRow({ t, accounts }: { t: Transaction; accounts: Map<string, Account> }) {
  const theme = useTheme();
  const from = accounts.get(t.accountId);
  const to = t.toAccountId ? accounts.get(t.toAccountId) : undefined;
  const c = category(t.categoryId);
  const transfer = t.type === 'transfer';
  const title = transfer ? `${from?.name ?? '?'} → ${to?.name ?? '?'}` : t.note || c.name;
  const sign = t.type === 'income' ? '+' : transfer ? '' : '−';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/budget/transaction', params: { id: t.id } })}
      style={styles.row}>
      <Badge icon={transfer ? 'swap_horiz' : c.icon} color={transfer ? theme.chartMuted : c.color} />
      <View style={styles.flex}>
        <ThemedText style={styles.rowTitle} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {transfer ? 'Transfer' : c.name} · {from?.name ?? '—'} · {formatDate(t.date)}
        </ThemedText>
      </View>
      <ThemedText style={[styles.amount, { color: t.type === 'income' ? theme.positive : transfer ? theme.text : theme.negative }]}>
        {sign}
        {money(t.amount, from?.currency)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  acc: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 8 },
  flex: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: 600 },
  amount: { fontSize: 16, fontWeight: 700 },
});
