import * as Notifications from 'expo-notifications';

import { nextCpiReleases } from './calendar';
import { formatMonth } from './format';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const TAG = 'cpi-release';

/** Schedules a local reminder for each of the next 12 TÜİK CPI releases. */
export async function enableCpiReminders(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  await disableCpiReminders();
  for (const date of nextCpiReleases(new Date(), 12)) {
    // The release covers the previous month.
    const covered = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const month = `${covered.getFullYear()}-${String(covered.getMonth() + 1).padStart(2, '0')}`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${formatMonth(month).split(' ')[0]} enflasyonu açıklandı`,
        body: 'Birikimin enflasyonun önünde mi kaldı? Hemen bak.',
        data: { tag: TAG },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(date.getTime() + 5 * 60_000) },
    });
  }
  return true;
}

export async function disableCpiReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.tag === TAG)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
