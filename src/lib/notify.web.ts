// Local notifications are not available in the web build.

export type ReminderKind = 'cpi' | 'rate';

export async function enableReminders(_kind: ReminderKind, _rateSchedule: Date[]): Promise<boolean> {
  return false;
}

export async function disableReminders(_kind: ReminderKind): Promise<void> {}

export type MaturityReminder = { id: string; name: string; date: string };

export async function scheduleMaturityReminders(_items: MaturityReminder[]): Promise<boolean> {
  return false;
}

export async function cancelMaturityReminders(): Promise<void> {}

export function onNotificationOpen(_open: (url: string) => void): () => void {
  return () => {};
}

export async function scheduleTrialEndReminder(_expiresAt: string): Promise<void> {}

export async function cancelTrialEndReminder(): Promise<void> {}

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function notifyNow(_title: string, _body: string, _url: string): Promise<void> {}
