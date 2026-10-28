// Sanity checks run on every build. A section that fails keeps its previous value
// and the build reports the error, so the app never receives an implausible number.

import type { Feed, FeedCpiRow } from '../src/lib/feed-types.ts';

export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function checkCpi(rows: FeedCpiRow[], previous: FeedCpiRow[] | undefined, today: string): void {
  const last = rows[rows.length - 1];
  if (monthsBetween(last.month, today.slice(0, 7)) > 2) throw new Error(`TÜFE eski: son ay ${last.month}`);
  for (const r of rows.slice(-24)) {
    if (r.mom < -5 || r.mom > 30 || r.yoy < -10 || r.yoy > 200) throw new Error(`TÜFE ${r.month} makul değil`);
  }
  if (previous && previous.length > rows.length) throw new Error('TÜFE serisi kısaldı');
}

export function checkPolicyRates(history: { from: string; rate: number }[], previous?: { rate: number }[]): void {
  const last = history[history.length - 1];
  if (last.rate < 0 || last.rate > 150) throw new Error(`Politika faizi makul değil: ${last.rate}`);
  const prev = previous?.[previous.length - 1];
  // TCMB has moved by 7.5 points at once; anything larger is far more likely a parsing error.
  if (prev && Math.abs(last.rate - prev.rate) > 10) throw new Error(`Politika faizi ${prev.rate} → ${last.rate} sıçradı`);
}

export function checkDecisions(dates: string[]): void {
  const sorted = [...dates].sort();
  if (sorted.join() !== dates.join() || new Set(dates).size !== dates.length) throw new Error('PPK tarihleri sırasız ya da tekrarlı');
  for (const d of dates) {
    const day = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (day === 0 || day === 6) throw new Error(`PPK tarihi hafta sonuna denk geliyor: ${d}`);
  }
}

export function checkExpectations(e: Feed['expectations'], today: string): void {
  if (monthsBetween(e.month, today.slice(0, 7)) > 2) throw new Error(`Beklenti anketi eski: ${e.month}`);
  for (const [k, v] of Object.entries(e.next12m)) {
    if (!(v > -5 && v < 200)) throw new Error(`Beklenti ${k} makul değil: ${v}`);
  }
}

/** Reminder for the one thing no source publishes in machine-readable form. */
export function withholdingWarning(validUntil: string, today: string): string | undefined {
  const days = Math.round((Date.parse(validUntil) - Date.parse(today)) / 86_400_000);
  if (days < 0) return `Stopaj oranlarının geçerlilik süresi ${validUntil} tarihinde doldu; feed/withholding.json güncellenmeli`;
  if (days <= 30) return `Stopaj oranlarının süresi ${days} gün sonra (${validUntil}) doluyor; yeni Cumhurbaşkanı Kararı kontrol edilmeli`;
  return undefined;
}
