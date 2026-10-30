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
