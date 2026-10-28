import * as Notifications from 'expo-notifications';

import { nextCpiReleases, nextRateDecisions } from './calendar';
import { formatMonth } from './format';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type ReminderKind = 'cpi' | 'rate';

const TAGS: Record<ReminderKind, string> = { cpi: 'cpi-release', rate: 'rate-decision' };
/** Fire a few minutes after the announcement so the number is out. */
const DELAY_MS = 5 * 60_000;

type Reminder = { title: string; body: string; date: Date };

function upcoming(kind: ReminderKind, now: Date, rateSchedule: Date[]): Reminder[] {
  if (kind === 'rate') {
    return nextRateDecisions(now, rateSchedule).map((date) => ({
      title: 'Merkez Bankası faiz kararı açıklandı',
      body: 'Politika faizindeki değişiklik mevduatının reel getirisini etkiler. Hemen bak.',
      date,
    }));
  }
  return nextCpiReleases(now, 12).map((date) => {
    // The release covers the previous month.
    const covered = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const month = `${covered.getFullYear()}-${String(covered.getMonth() + 1).padStart(2, '0')}`;
    return {
      title: `${formatMonth(month).split(' ')[0]} enflasyonu açıklandı`,
      body: 'Birikimin enflasyonun önünde mi kaldı? Hemen bak.',
      date,
    };
  });
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted || (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Schedules local reminders for the upcoming announcements of `kind`; false if notifications are not permitted.
 * `rateSchedule` is the PPK calendar from the data feed.
 */
export async function enableReminders(kind: ReminderKind, rateSchedule: Date[]): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  await disableReminders(kind);
  for (const r of upcoming(kind, new Date(), rateSchedule)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { tag: TAGS[kind] } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.date.getTime() + DELAY_MS) },
    });
  }
  return true;
}

export async function disableReminders(kind: ReminderKind): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.tag === TAGS[kind])
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
