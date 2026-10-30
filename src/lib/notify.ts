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
const MATURITY_TAG = 'deposit-maturity';
/** Fire a few minutes after the announcement so the number is out. */
const DELAY_MS = 5 * 60_000;

type Reminder = { title: string; body: string; date: Date; url?: string };

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
      body: 'Karnen hazır: birikimin enflasyonun önünde mi kaldı?',
      date,
      url: '/karne',
    };
  });
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.granted || (await Notifications.requestPermissionsAsync()).granted;
}

export const requestNotificationPermission = ensurePermission;

/** Shows a notification right away, e.g. when an alarm condition flips. */
export async function notifyNow(title: string, body: string, url: string): Promise<void> {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({ content: { title, body, data: { tag: 'alert', url } }, trigger: null });
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
      content: { title: r.title, body: r.body, data: { tag: TAGS[kind], ...(r.url && { url: r.url }) } },
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

export type MaturityReminder = { id: string; name: string; date: string };

/**
 * One reminder per deposit, two days before its next maturity at 10:00. Tapping it opens
 * "Yenilesem mi?" for that deposit.
 */
export async function scheduleMaturityReminders(items: MaturityReminder[]): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  await cancelMaturityReminders();
  const now = Date.now();
  for (const m of items) {
    const [y, mo, d] = m.date.split('-').map(Number);
    const at = new Date(y, mo - 1, d - 2, 10, 0, 0);
    if (at.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${m.name}: vaden 2 gün sonra doluyor`,
        body: 'Yenilemeden önce son dönemde dolar ve altınla nasıl kıyaslandığına bak.',
        data: { tag: MATURITY_TAG, url: `/renew/${m.id}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
  return true;
}

export async function cancelMaturityReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.tag === MATURITY_TAG)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Opens the screen a tapped notification points to. */
export function onNotificationOpen(open: (url: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const url = r.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
  });
  return () => sub.remove();
}

const TRIAL_TAG = 'trial-end';

/** "Your free trial ends in 2 days", so a trial never turns into a surprise charge. */
export async function scheduleTrialEndReminder(expiresAt: string): Promise<void> {
  if (!(await ensurePermission())) return;
  await cancelTrialEndReminder();
  const at = new Date(Date.parse(expiresAt) - 2 * 86_400_000);
  if (at.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Paraölçer Premium denemen 2 gün sonra bitiyor',
      body: 'Devam etmek istemiyorsan mağaza ayarlarından iptal edebilirsin; deneme süresinde ücret alınmaz.',
      data: { tag: TRIAL_TAG, url: '/profile' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

export async function cancelTrialEndReminder(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.tag === TRIAL_TAG)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
