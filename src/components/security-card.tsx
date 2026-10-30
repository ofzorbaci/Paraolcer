import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { lockAvailable, unlock } from '@/lib/lock';
import { updateSettings, useStore } from '@/state/store';

/** App lock and "hide amounts": the privacy promises made visible. */
export function SecurityCard() {
  const theme = useTheme();
  const appLock = useStore((s) => s.settings.appLock ?? false);
  const hideAmounts = useStore((s) => s.settings.hideAmounts ?? false);
  const [status, setStatus] = useState<string>();

  const toggleLock = async (on: boolean) => {
    if (!on) return updateSettings({ appLock: false });
    if (!(await lockAvailable())) {
      setStatus('Telefonunda şifre, parmak izi ya da Face ID tanımlı değil. Önce telefon ayarlarından ekle.');
      return;
    }
    // Turning the lock on needs one successful unlock, so nobody locks the owner out.
    if (await unlock()) {
      updateSettings({ appLock: true });
      setStatus(undefined);
    }
  };

  const row = (title: string, detail: string, value: boolean, onChange: (v: boolean) => void, disabled = false) => (
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
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: theme.accent, false: theme.border }}
      />
    </View>
  );

  return (
    <Card>
      <ThemedText style={styles.title}>Güvenlik</ThemedText>
      {row(
        'Uygulama kilidi',
        Platform.OS === 'web'
          ? 'Kilit yalnızca telefonda çalışır.'
          : 'Açılışta ve 30 saniyeden uzun ayrıldıktan sonra Face ID, parmak izi ya da telefon şifresi sorulur.',
        appLock,
        (v) => void toggleLock(v),
        Platform.OS === 'web',
      )}
      {row('Tutarları gizle', 'Tüm TL tutarları ••••• olarak görünür; yüzdeler görünmeye devam eder.', hideAmounts, (v) =>
        updateSettings({ hideAmounts: v }),
      )}
      {status && (
        <ThemedText type="small" themeColor="textSecondary">
          {status}
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  flex: { flex: 1, gap: 2 },
});
