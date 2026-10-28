// Parses the CPI table on TCMB's "Tüketici Fiyatları" page.
// Kept free of imports so feed/build.mts can run it under plain Node.

export type CpiRow = {
  /** 'YYYY-MM' */
  month: string;
  /** annual change, % */
  yoy: number;
  /** monthly change, % */
  mom: number;
};

export const TCMB_CPI_URL =
  'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Enflasyon+Verileri/Tuketici+Fiyatlari';

const MONTH_CELL = /^(\d{2})-(\d{4})$/;

function toNumber(text: string): number {
  return Number(text.trim().replace(',', '.'));
}

/** Returns rows sorted oldest first. Throws if the page no longer looks like the CPI table. */
export function parseTcmbCpiHtml(html: string): CpiRow[] {
  const cells = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
    m[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim(),
  );

  const byMonth = new Map<string, CpiRow>();
  for (let i = 0; i + 2 < cells.length; i++) {
    const match = MONTH_CELL.exec(cells[i]);
    if (!match) continue;
    const yoy = toNumber(cells[i + 1]);
    const mom = toNumber(cells[i + 2]);
    if (!Number.isFinite(yoy) || !Number.isFinite(mom)) continue;
    const month = `${match[2]}-${match[1]}`;
    byMonth.set(month, { month, yoy, mom });
    i += 2;
  }

  const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  if (rows.length < 24) {
    throw new Error(`TÜFE tablosu ayrıştırılamadı (${rows.length} satır bulundu)`);
  }
  assertContiguous(rows);
  return rows;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

function assertContiguous(rows: CpiRow[]) {
  for (let i = 1; i < rows.length; i++) {
    const expected = nextMonth(rows[i - 1].month);
    if (rows[i].month !== expected) {
      throw new Error(`TÜFE serisinde boşluk: ${expected} eksik`);
    }
  }
}
