import { cpiReleaseDate } from './calendar';

// The CPI-day report card: one look at how the portfolio did against the new figure.
// It carries ratios only, so the shareable image never reveals amounts.

export type Grade = { letter: 'A' | 'B' | 'C' | 'D'; verdict: string };

export function gradeFor(real: number): Grade {
  if (real >= 0.05) return { letter: 'A', verdict: 'Enflasyonu rahat yendin' };
  if (real >= 0) return { letter: 'B', verdict: 'Enflasyonu yendin' };
  if (real >= -0.05) return { letter: 'C', verdict: 'Kıl payı geride kaldın' };
  return { letter: 'D', verdict: 'Alım gücün eridi' };
}

/** True from the CPI release (3rd of the month) until the 20th, for the month after `cpiMonth`. */
export function karneFresh(cpiMonth: string, today: string): boolean {
  const [y, m] = cpiMonth.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return today.slice(0, 7) === next && Number(today.slice(8, 10)) <= 20;
}

/**
 * The CPI month that should be out by `now` when it is not in the data yet — e.g. on the release
 * morning before the feed caught up. Screens then say "güncelleniyor" instead of passing last
 * month off as the new one.
 */
export function cpiPendingMonth(now: Date, lastMonth: string): string | undefined {
  const y = now.getFullYear();
  const m = now.getMonth();
  const released = now >= cpiReleaseDate(y, m);
  const back = released ? 1 : 2;
  const d = new Date(y, m - back, 1);
  const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return lastMonth < expected ? expected : undefined;
}

/** Sum of the lira gaps shown at maturities this year. */
export function renewSavingsThisYear(log: { maturity: string; diff: number }[] | undefined, today: string): number {
  return (log ?? []).filter((e) => e.maturity.slice(0, 4) === today.slice(0, 4)).reduce((a, e) => a + e.diff, 0);
}
