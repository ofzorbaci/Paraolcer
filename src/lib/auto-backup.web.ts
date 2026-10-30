// The web build keeps no file snapshot; browser storage is the only copy.
import type { Holding, Settings } from './types';

export type Snapshot = { savedAt: string; holdings: Holding[]; settings: Settings };

export async function writeSnapshot(_holdings: Holding[], _settings: Settings): Promise<string | undefined> {
  return undefined;
}

export async function readSnapshot(): Promise<Snapshot | undefined> {
  return undefined;
}

export function deleteSnapshot() {}
