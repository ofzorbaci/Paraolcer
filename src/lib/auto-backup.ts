// An unencrypted snapshot in the app's Documents folder, rewritten after every change.
// iOS includes that folder in the phone's iCloud backup and Android's Auto Backup covers app
// data, so the snapshot moves to a new phone with the device backup. It also lets the app
// recover if its own storage is ever lost during an update.

import { Directory, File, Paths } from 'expo-file-system';

import type { Holding, Settings } from './types';

export type Snapshot = { savedAt: string; holdings: Holding[]; settings: Settings };

const NAME = 'paraolcer-otomatik-yedek.json';

function file(): File {
  return new File(new Directory(Paths.document), NAME);
}

export async function writeSnapshot(holdings: Holding[], settings: Settings): Promise<string | undefined> {
  try {
    const savedAt = new Date().toISOString();
    const f = file();
    f.create({ overwrite: true });
    await f.write(JSON.stringify({ savedAt, holdings, settings } satisfies Snapshot));
    return savedAt;
  } catch {
    return undefined;
  }
}

export async function readSnapshot(): Promise<Snapshot | undefined> {
  try {
    const f = file();
    if (!f.exists) return undefined;
    const data = JSON.parse(await f.text()) as Snapshot;
    return Array.isArray(data.holdings) ? data : undefined;
  } catch {
    return undefined;
  }
}

export function deleteSnapshot() {
  try {
    const f = file();
    if (f.exists) f.delete();
  } catch {
    /* nothing to delete */
  }
}
