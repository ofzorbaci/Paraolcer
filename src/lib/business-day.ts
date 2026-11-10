// A deposit that matures on a weekend or public holiday is paid on the next business day.
// The holiday list comes from the data feed (Nager.Date); like the withholding table, the store
// hands each new feed to this module.

import snapshot from '../data/feed-snapshot.json';
import type { Feed } from './feed-types';

let holidays = new Map<string, string>(((snapshot as Partial<Feed>).holidays?.dates ?? []).map((h) => [h.date, h.name]));

export function setHolidays(next: Feed['holidays']) {
  if (next) holidays = new Map(next.dates.map((h) => [h.date, h.name]));
}

function addDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Why `date` is not a business day: 'Cumartesi', 'Pazar' or the holiday's name; undefined if it is one. */
export function closedReason(date: string, list: Map<string, string> = holidays): string | undefined {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day === 6) return 'Cumartesi';
  if (day === 0) return 'Pazar';
  return list.get(date);
}

/** The first business day on or after `date`. */
export function nextBusinessDay(date: string, list: Map<string, string> = holidays): string {
  let d = date;
  for (let i = 0; i < 20 && closedReason(d, list); i++) d = addDay(d);
  return d;
}

/** The payout day of a maturity and, when it moves, why ("Ramazan Bayramı 1. Gün"). */
export function payout(maturity: string, list: Map<string, string> = holidays): { date: string; reason?: string } {
  const date = nextBusinessDay(maturity, list);
  return date === maturity ? { date } : { date, reason: closedReason(maturity, list) };
}
