// The web build has no device authentication; the lock is a phone feature.

export async function lockAvailable(): Promise<boolean> {
  return false;
}

export async function unlock(): Promise<boolean> {
  return true;
}
