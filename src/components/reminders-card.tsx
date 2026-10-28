import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { nextCpiReleases, nextRateDecisions } from '@/lib/calendar';
import { RATE_SCHEDULE, type ReminderKind } from '@/lib/notify';
import { setReminders, useStore } from '@/state/store';

export const ANNOUNCEMENT_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

/** Local reminders for TÜİK CPI releases and TCMB rate decisions, each switched on its own. */
export function RemindersCard() {
  const theme = useTheme();
  const settings = useStore((s) => s.settings);
  const [status, setStatus] = useState<string>();
  const now = new Date();
  const nextCpi = nextCpiReleases(now, 1)[0];
  const nextRates = nextRateDecisions(now, RATE_SCHEDULE);

  const toggle = async (kind: ReminderKind, on: boolean) => {
    const ok = await setReminders(kind, on);
    setStatus(on && !ok ? 'Bildirim izni verilmedi. Telefon ayarlarından izin verebilirsin.' : undefined);
  };

  const row = (kind: ReminderKind, title: string, detail: string, value: boolean, disabled = false) => (
    <View style={styles.row}>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled || Platform.OS === 'web'}
        onValueChange={(on) => toggle(kind, on)}
        trackColor={{ true: theme.accent, false: theme.border }}
      />
    </View>
  );

  return (
    <Card>
      <ThemedText style={styles.title}>Bildirimler</ThemedText>
      {row(
        'cpi',
        'Enflasyon açıklandığında',
        `TÜİK her ayın 3’ünde 10:00’da açıklar (hafta sonuysa pazartesi). Sonraki: ${ANNOUNCEMENT_FMT.format(nextCpi)}.`,
        settings.notifyCpi,
      )}
      {row(
        'rate',
        'Faiz kararı açıklandığında',
        nextRates.length > 0
          ? `TCMB Para Politikası Kurulu kararı 14:00’te açıklanır. Sonraki: ${ANNOUNCEMENT_FMT.format(nextRates[0])}.`
          : 'Uygulamadaki toplantı takvimi bitti; yeni takvim bir güncellemeyle gelecek.',
        settings.notifyRate ?? false,
        nextRates.length === 0,
      )}
      {nextRates.length > 0 && nextRates.length <= 2 && (
        <ThemedText type="small" themeColor="textSecondary">
          Takvimde {nextRates.length} toplantı kaldı; TCMB yeni takvimi açıklayınca uygulama güncellenmeli.
        </ThemedText>
      )}
      {Platform.OS === 'web' && (
        <ThemedText type="small" themeColor="textSecondary">
          Bildirimler yalnızca telefonda çalışır.
        </ThemedText>
      )}
      {status && (
        <ThemedText type="small" themeColor="textSecondary">
          {status}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Hatırlatmalar telefonda kurulur, internet ya da sunucu gerektirmez. Bildirimde rakam yazmaz; açıklanan oranı
        uygulamada görürsün.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  flex: { flex: 1, gap: 2 },
});
