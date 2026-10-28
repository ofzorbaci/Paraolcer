import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { encryptBackup, type BackupData } from './backup';

/** Encrypts the data and opens the share sheet, so the user can save it to Files, iCloud Drive or Google Drive. */
export async function exportBackup(data: BackupData, password: string): Promise<void> {
  const text = await encryptBackup(data, password, (n) => Crypto.getRandomBytes(n));
  const file = new File(Paths.cache, `paraolcer-yedek-${data.exportedAt.slice(0, 10)}.json`);
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Yedeği kaydet' });
}

/** Lets the user pick a backup file; undefined if they cancel. */
export async function pickBackupText(): Promise<string | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (result.canceled) return undefined;
  return new File(result.assets[0].uri).text();
}
