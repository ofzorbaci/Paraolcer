import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useMasked } from '@/hooks/use-masked';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatTL, parseAmount } from '@/lib/format';
import { requestNotificationPermission } from '@/lib/notify';
import { setGoal, setRealAlert, useStore } from '@/state/store';

/** Premium: "tell me if my real return turns negative" and a goal in today's lira. */
export function GoalsCard() {
  const theme = useTheme();
  useMasked();
  const realAlert = useStore((s) => s.settings.alertRealBelowZero ?? false);
  const goal = useStore((s) => s.settings.goal);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string>();

  const toggle = async (on: boolean) => {
    if (on && !(await requestNotificationPermission())) {
      setStatus('Bildirim izni yok. Ayarlar’dan bildirimlere izin verip tekrar dene.');
      return;
    }
    setStatus(undefined);
    setRealAlert(on);
  };

  const saveGoal = async () => {
    const value = parseAmount(amount);
    if (!value) return;
    await requestNotificationPermission();
    setGoal(value);
    setAmount('');
  };

  return (
    <Card>
      <ThemedText style={styles.title}>Alarm ve hedef</ThemedText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="smallBold">Reel getirim eksiye düşerse haber ver</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Fiyatlar ya da yeni TÜFE güncellenince kontrol ederiz; durum değişince tek bildirim gelir.
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel="Reel getiri alarmı"
          value={realAlert}
          onValueChange={(v) => void toggle(v)}
          trackColor={{ true: theme.accent, false: theme.border }}
        />
      </View>

      <ThemedText type="smallBold">Hedef: bugünün lirasıyla</ThemedText>
      {goal ? (
        <View style={styles.goal}>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDate(goal.setAt)} fiyatlarıyla {formatTL(goal.amount)}. Enflasyon arttıkça hedef de aynı alım gücünü
            koruyacak şekilde büyür; ilerlemeni Özet’te görürsün.
          </ThemedText>
          <Button title="Hedefi kaldır" kind="secondary" compact onPress={() => setGoal(undefined)} />
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Örneğin “bugünün lirasıyla ₺1.000.000”. Birikimin bu alım gücüne ulaşınca haber veririz.
        </ThemedText>
      )}
      <Field label={goal ? 'Yeni hedef' : 'Hedef tutar'} prefix="₺" keyboardType="decimal-pad" placeholder="1.000.000" value={amount} onChangeText={setAmount} />
      <Button title="Hedefi kaydet" disabled={!parseAmount(amount)} onPress={() => void saveGoal()} />
      {status && (
        <ThemedText type="small" style={{ color: theme.negative }}>
          {status}
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  goal: { gap: Spacing.two, alignItems: 'flex-start' },
});
