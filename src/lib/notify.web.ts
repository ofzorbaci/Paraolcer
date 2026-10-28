// Local notifications are not available in the web build.

export type ReminderKind = 'cpi' | 'rate';

export async function enableReminders(_kind: ReminderKind, _rateSchedule: Date[]): Promise<boolean> {
  return false;
}

export async function disableReminders(_kind: ReminderKind): Promise<void> {}
