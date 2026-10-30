import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { decryptBackup, MIN_PASSWORD, type BackupData } from '@/lib/backup';
import { exportBackup, pickBackupText } from '@/lib/backup-file';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate, formatStamp } from '@/lib/format';
import { restoreData, useStore } from '@/state/store';

/** Password-protected backup to a file the user keeps (Files, iCloud Drive, Google Drive). */
export function BackupCard() {
  const theme = useTheme();
  const holdings = useStore((s) => s.allHoldings);
  const autoBackupAt = useStore((s) => s.autoBackupAt);
  const settings = useStore((s) => s.settings);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const [pending, setPending] = useState<BackupData>();
  const shortPassword = password.length < MIN_PASSWORD;

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(true);
    setStatus(label);
    try {
      await job();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Bir şeyler ters gitti');
    } finally {
      setBusy(false);
    }
  };

  const onExport = () =>
    run('Şifreleniyor…', async () => {
      await exportBackup({ holdings, settings, exportedAt: new Date().toISOString() }, password);
      setStatus('Yedek hazır. Kaydettiğin yeri ve şifreni unutma; şifre olmadan açılamaz.');
    });

  const onPick = () =>
    run('Yedek açılıyor…', async () => {
      const text = await pickBackupText();
      if (!text) return setStatus(undefined);
      const data = await decryptBackup(text, password);
      setPending(data);
      setStatus(undefined);
    });

  return (
    <Card>
      <ThemedText style={styles.title}>Yedekleme</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Verilerin her değişiklikte telefonunda otomatik yedeklenir; bu yedek telefonun iCloud ya da Google yedeğine
        dahildir. Telefon değiştirirken ya da ekstra güvence için şifreli bir yedek dosyası da oluşturabilirsin.
      </ThemedText>
      {autoBackupAt && (
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Son otomatik yedek: {formatStamp(autoBackupAt)}
        </ThemedText>
      )}
      <Field
        label="Yedek şifresi"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={password}
        onChangeText={setPassword}
        hint={`En az ${MIN_PASSWORD} karakter. Şifreyi kaybedersen yedek açılamaz.`}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title="Yedek oluştur" compact disabled={busy || shortPassword || holdings.length === 0} onPress={onExport} />
        </View>
        <View style={styles.flex}>
          <Button title="Geri yükle" kind="secondary" compact disabled={busy || password.length === 0} onPress={onPick} />
        </View>
      </View>
      {status && (
        <ThemedText type="small" themeColor="textSecondary">
          {status}
        </ThemedText>
      )}
      {pending && (
        <View style={styles.confirm}>
          <ThemedText type="smallBold">
            {formatLongDate(pending.exportedAt.slice(0, 10))} tarihli yedekte {pending.holdings.length} varlık var.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Şu anki {holdings.length} varlığın yerine geçecek.
          </ThemedText>
          <Button
            title="Yedeği yükle"
            kind="danger"
            onPress={() => {
              restoreData(pending.holdings, pending.settings);
              setPending(undefined);
              setStatus(`${pending.holdings.length} varlık geri yüklendi.`);
            }}
          />
          <Button title="Vazgeç" kind="secondary" onPress={() => setPending(undefined)} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, lineHeight: 26, fontWeight: 700 },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  confirm: { gap: Spacing.two, marginTop: Spacing.two },
});
