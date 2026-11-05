import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Badge, money } from '@/components/budget/parts';
import { openPaywall, usePremium } from '@/components/premium-gate';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Choice, IconButton, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { category } from '@/lib/budget/categories';
import { addDays, monthRange, toTry, weekdayIndex } from '@/lib/budget/calc';
import { monthlyCost, occurrences, REPEAT_LABEL } from '@/lib/budget/planned';
import type { Planned } from '@/lib/budget/types';
import { formatDate, formatMonth, formatTL, todayISO } from '@/lib/format';
import { requestNotificationPermission } from '@/lib/notify';
import { ensureDefaultAccount, payPlanned, setBudgetPrefs, skipPlanned, useBudget } from '@/state/budget';
import { useStore } from '@/state/store';

type Tab = 'upcoming' | 'subscriptions' | 'calendar';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** Bills and subscriptions: what is due, what it costs a month, and when. */
export default function PaymentsScreen() {
  const theme = useTheme();
  useMasked();
  const planned = useBudget((s) => s.planned);
  const remind = useBudget((s) => !!s.prefs.remindPayments);
  const rates = useStore((s) => s.prices);
  const premium = usePremium();
  const [tab, setTab] = useState<Tab>('upcoming');
  const today = todayISO();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/butce'));

  const bills = [...planned].filter((p) => p.kind === 'bill').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const subs = [...planned].filter((p) => p.kind === 'subscription').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const subsMonthly = subs.reduce((sum, p) => sum + (toTry(monthlyCost(p), p.currency, rates) ?? 0), 0);

  const toggleRemind = async (on: boolean) => {
    if (on && !premium) return openPaywall('budgetReminders');
    if (on && !(await requestNotificationPermission())) return;
    // Saving the preference reschedules the reminders (state/budget.ts → commit).
    setBudgetPrefs({ remindPayments: on });
  };

  return (
    <Screen tabs={false}>
      <View style={styles.header}>
        <IconButton name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} label="Geri" onPress={close} />
        <ThemedText style={styles.title}>Ödemeler</ThemedText>
        <IconButton
          name={{ ios: 'plus', android: 'add', web: 'add' }}
          label="Ödeme planla"
          onPress={() => router.push({ pathname: '/budget/payment', params: { kind: tab === 'subscriptions' ? 'subscription' : 'bill' } })}
        />
      </View>

      <Choice<Tab>
        options={[
          { value: 'upcoming', label: 'Yaklaşan' },
          { value: 'subscriptions', label: 'Üyelikler' },
          { value: 'calendar', label: 'Takvim' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'upcoming' &&
        (bills.length === 0 ? (
          <Empty
            title="Ödemelerini planla"
            body="Kira, aidat, faturalar, kredi taksitleri… Gününü ve tutarını bir kez yaz; günü gelince tek dokunuşla öde, bütçen kendiliğinden güncellensin."
            action="Ödeme ekle"
            onPress={() => router.push({ pathname: '/budget/payment', params: { kind: 'bill' } })}
          />
        ) : (
          <Card>
            {bills.map((p) => (
              <PlannedRow key={p.id} p={p} today={today} />
            ))}
          </Card>
        ))}

      {tab === 'subscriptions' &&
        (subs.length === 0 ? (
          <Empty
            title="Üyeliklerini tek yerde gör"
            body="Müzik, dizi, bulut depolama, spor salonu… Hepsini ekle; aylık toplamını görür, unuttuğun üyelikleri yakalarsın."
            action="Üyelik ekle"
            onPress={() => router.push({ pathname: '/budget/payment', params: { kind: 'subscription' } })}
          />
        ) : (
          <>
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Üyeliklerin ayda
              </ThemedText>
              <ThemedText style={styles.big}>{formatTL(subsMonthly)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Yılda {formatTL(subsMonthly * 12)} · {subs.length} üyelik
              </ThemedText>
            </Card>
            <Card>
              {subs.map((p) => (
                <PlannedRow key={p.id} p={p} today={today} />
              ))}
            </Card>
          </>
        ))}

      {tab === 'calendar' && <Calendar planned={planned} today={today} />}

      {Platform.OS !== 'web' && (
        <Card>
          <View style={styles.row}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">Ödeme gününde hatırlat{premium ? '' : ' · Premium'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Her planlı ödemenin günü sabah 10:00’da bildirim.
              </ThemedText>
            </View>
            <Switch value={remind && premium} onValueChange={(v) => void toggleRemind(v)} trackColor={{ true: theme.accent, false: theme.border }} />
          </View>
        </Card>
      )}
    </Screen>
  );
}

function Empty({ title, body, action, onPress }: { title: string; body: string; action: string; onPress: () => void }) {
  return (
    <Card>
      <ThemedText style={styles.cardTitle}>{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {body}
      </ThemedText>
      <Button title={action} onPress={onPress} />
    </Card>
  );
}

/** A planned payment with its next date and the pay / skip actions. */
function PlannedRow({ p, today }: { p: Planned; today: string }) {
  const theme = useTheme();
  const c = category(p.categoryId);
  const late = p.dueDate < today;
  return (
    <View style={styles.planned}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/budget/payment', params: { id: p.id } })}
        style={styles.row}>
        <Badge icon={c.icon} color={c.color} />
        <View style={styles.flex}>
          <ThemedText style={styles.rowTitle} numberOfLines={1}>
            {p.name}
          </ThemedText>
          <ThemedText type="small" style={{ color: late ? theme.negative : theme.textSecondary }}>
            {late ? 'Gecikti · ' : p.dueDate === today ? 'Bugün · ' : ''}
            {formatDate(p.dueDate)} · {REPEAT_LABEL[p.repeat]}
          </ThemedText>
        </View>
        <ThemedText style={styles.rowTitle}>{money(p.amount, p.currency)}</ThemedText>
      </Pressable>
      <View style={styles.actions}>
        <Button title="Ödendi" kind="secondary" compact onPress={() => payPlanned(p.id, p.accountId ?? ensureDefaultAccount().id, today)} />
        {p.repeat !== 'none' && <Button title="Bu seferi atla" kind="secondary" compact onPress={() => skipPlanned(p.id)} />}
      </View>
    </View>
  );
}

/** Month grid with a dot on every due day; tapping a day lists what falls on it. */
function Calendar({ planned, today }: { planned: Planned[]; today: string }) {
  const theme = useTheme();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const range = monthRange(month);
  const due = new Map<string, Planned[]>();
  for (const p of planned) for (const d of occurrences(p, range.from, range.to)) due.set(d, [...(due.get(d) ?? []), p]);
  const days: string[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);
  const lead = weekdayIndex(range.from);
  const shift = (n: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const list = due.get(selected) ?? [];

  return (
    <Card>
      <View style={styles.row}>
        <IconButton name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} label="Önceki ay" onPress={() => shift(-1)} />
        <ThemedText style={[styles.cardTitle, styles.flex, styles.center]}>{formatMonth(month)}</ThemedText>
        <IconButton name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} label="Sonraki ay" onPress={() => shift(1)} />
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((w) => (
          <ThemedText key={w} type="small" themeColor="textSecondary" style={styles.cell}>
            {w}
          </ThemedText>
        ))}
      </View>
      <View style={styles.week}>
        {Array.from({ length: lead }, (_, i) => (
          <View key={`l${i}`} style={styles.cell} />
        ))}
        {days.map((d) => {
          const on = d === selected;
          const has = due.has(d);
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(d)}${has ? `, ${due.get(d)!.length} ödeme` : ''}`}
              onPress={() => setSelected(d)}
              style={[styles.cell, styles.day, on && { backgroundColor: theme.chip }]}>
              <ThemedText type="small" style={{ color: on ? theme.onChip : d === today ? theme.accent : theme.text, fontWeight: d === today ? 800 : 500 }}>
                {Number(d.slice(8))}
              </ThemedText>
              <View style={[styles.dot, { backgroundColor: has ? (on ? theme.onChip : theme.negative) : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="smallBold">{formatDate(selected)}</ThemedText>
      {list.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Bu güne planlı ödeme yok.
        </ThemedText>
      ) : (
        list.map((p) => (
          <View key={p.id} style={styles.row}>
            <ThemedText style={[styles.rowTitle, styles.flex]}>{p.name}</ThemedText>
            <ThemedText style={styles.rowTitle}>{money(p.amount, p.currency)}</ThemedText>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 800, flex: 1 },
  cardTitle: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  big: { fontSize: 30, lineHeight: 36, fontWeight: 800 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowTitle: { fontSize: 16, fontWeight: 600 },
  planned: { gap: Spacing.two, paddingVertical: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two, paddingLeft: 52 },
  week: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', textAlign: 'center' },
  day: { paddingVertical: 6, borderRadius: 12, gap: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
