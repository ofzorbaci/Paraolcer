// TÜİK publishes CPI on the 3rd of each month at 10:00 (Turkey time);
// a weekend release moves to the following Monday. Public holidays are not modelled.

export function cpiReleaseDate(year: number, monthIndex: number): Date {
  const d = new Date(year, monthIndex, 3, 10, 0, 0);
  const day = d.getDay();
  if (day === 6) d.setDate(5);
  if (day === 0) d.setDate(4);
  return d;
}

/** The next `count` release moments after `from`. */
export function nextCpiReleases(from: Date, count: number): Date[] {
  const out: Date[] = [];
  let y = from.getFullYear();
  let m = from.getMonth();
  while (out.length < count) {
    const d = cpiReleaseDate(y, m);
    if (d > from) out.push(d);
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  return out;
}
