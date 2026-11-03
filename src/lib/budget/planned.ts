// Planned payments and subscriptions: when they fall due and what paying one does.

import { addDays } from './calc';
import type { Planned, Repeat } from './types';

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** The occurrence after `date` for a repeat; monthly and yearly keep the anchor day where the month allows. */
export function nextAfter(date: string, repeat: Repeat, anchorDay: number): string | undefined {
  if (repeat === 'none') return undefined;
  if (repeat === 'weekly') return addDays(date, 7);
  const [y, m] = date.split('-').map(Number);
  const months = repeat === 'monthly' ? 1 : 12;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(anchorDay, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Due dates of `p` between `from` and `to`, inclusive. */
export function occurrences(p: Planned, from: string, to: string, limit = 60): string[] {
  const out: string[] = [];
  let d: string | undefined = p.dueDate;
  while (d && d <= to && out.length < limit) {
    if (d >= from) out.push(d);
    d = nextAfter(d, p.repeat, p.anchorDay);
  }
  return out;
}

/** What paying the current occurrence leaves: the next one, or nothing for a one-off. */
export function afterPaying(p: Planned): Planned | undefined {
  const next = nextAfter(p.dueDate, p.repeat, p.anchorDay);
  return next ? { ...p, dueDate: next } : undefined;
}

/** A subscription's cost per month in its own minor units. */
export function monthlyCost(p: Planned): number {
  if (p.repeat === 'yearly') return Math.round(p.amount / 12);
  if (p.repeat === 'weekly') return Math.round((p.amount * 52) / 12);
  return p.amount;
}

export const REPEAT_LABEL: Record<Repeat, string> = { none: 'Tek sefer', weekly: 'Her hafta', monthly: 'Her ay', yearly: 'Her yıl' };
