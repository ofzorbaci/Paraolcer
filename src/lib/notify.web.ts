// Local notifications are not available in the web build.
import ppk from '@/data/ppk.json';

import { rateDecisionDates } from './calendar';

export type ReminderKind = 'cpi' | 'rate';

export const RATE_SCHEDULE = rateDecisionDates(ppk.dates, ppk.time);

export async function enableReminders(_kind: ReminderKind): Promise<boolean> {
  return false;
}

export async function disableReminders(_kind: ReminderKind): Promise<void> {}
