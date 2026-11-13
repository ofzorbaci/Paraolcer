// An unencrypted snapshot in the app's Documents folder, rewritten after every change.
// iOS includes that folder in the phone's iCloud backup and Android's Auto Backup covers app
// data, so the snapshot moves to a new phone with the device backup. It also lets the app
// recover if its own storage is ever lost during an update.

import { Directory, File, Paths } from 'expo-file-system';

import type { Holding, Settings } from './types';

export type Snapshot = { savedAt: string; holdings: Holding[]; settings: Settings };

const NAME = 'paralens-otomatik-yedek.json';
/** Snapshot names written by earlier versions: read if the current one is missing, removed after a new write. */
const OLD_NAME = 'paraolcer-otomatik-yedek.json';
const OLD_BUDGET_NAME = 'paraolcer-butce-yedek.json';

function file(name = NAME): File {
  return new File(new Directory(Paths.document), name);
}

function removeOld(name: string) {
  try {
    const f = file(name);
    if (f.exists) f.delete();
  } catch {
    /* nothing to remove */
  }
}

export async function writeSnapshot(holdings: Holding[], settings: Settings): Promise<string | undefined> {
  try {
    const savedAt = new Date().toISOString();
    const f = file();
    f.create({ overwrite: true });
    await f.write(JSON.stringify({ savedAt, holdings, settings } satisfies Snapshot));
    removeOld(OLD_NAME);
    return savedAt;
  } catch {
    return undefined;
  }
}

export async function readSnapshot(): Promise<Snapshot | undefined> {
  try {
    const current = file();
    const f = current.exists ? current : file(OLD_NAME);
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
  removeOld(OLD_NAME);
}

const BUDGET_NAME = 'paralens-butce-yedek.json';

function budgetFile(name = BUDGET_NAME): File {
  return new File(new Directory(Paths.document), name);
}

/** The budget's own snapshot, next to the holdings one. */
export async function writeBudgetSnapshot(data: unknown): Promise<void> {
  try {
    const f = budgetFile();
    f.create({ overwrite: true });
    await f.write(JSON.stringify({ savedAt: new Date().toISOString(), data }));
    removeOld(OLD_BUDGET_NAME);
  } catch {
    /* a failed snapshot must never break saving */
  }
}

export async function readBudgetSnapshot<T>(): Promise<T | undefined> {
  try {
    const current = budgetFile();
    const f = current.exists ? current : budgetFile(OLD_BUDGET_NAME);
    if (!f.exists) return undefined;
    return (JSON.parse(await f.text()) as { data: T }).data;
  } catch {
    return undefined;
  }
}

export function deleteBudgetSnapshot() {
  try {
    const f = budgetFile();
    if (f.exists) f.delete();
  } catch {
    /* nothing to delete */
  }
  removeOld(OLD_BUDGET_NAME);
}
