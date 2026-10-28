import * as DocumentPicker from 'expo-document-picker';

import { encryptBackup, type BackupData } from './backup';

/** Web: download the encrypted file. */
export async function exportBackup(data: BackupData, password: string): Promise<void> {
  const text = await encryptBackup(data, password, (n) => crypto.getRandomValues(new Uint8Array(n)));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `reel-getiri-yedek-${data.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function pickBackupText(): Promise<string | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json'] });
  if (result.canceled) return undefined;
  return (await fetch(result.assets[0].uri)).text();
}
