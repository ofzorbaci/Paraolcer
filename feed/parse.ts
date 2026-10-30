// Pure parsers for the official TCMB pages the feed is built from.
// Each throws when the page no longer looks the way it should, so a layout
// change fails the build loudly instead of publishing wrong numbers.

const MONTHS: Record<string, number> = {
  ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6,
  temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
};

function monthNumber(name: string): number {
  const n = MONTHS[name.toLocaleLowerCase('tr-TR')];
  if (!n) throw new Error(`Bilinmeyen ay adı: ${name}`);
  return n;
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;| /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function tableRows(html: string): string[][] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => decode(c[1])),
  );
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** TCMB "PPK/<year>" page: first column of the table holds decision days like "22 Ocak 2026". */
export function parsePpkYear(html: string, year: number): string[] {
  const rows = tableRows(html);
  const header = rows.findIndex((r) => /Toplantı Kararı/i.test(r[0] ?? ''));
  if (header < 0) throw new Error(`PPK ${year}: karar tablosu bulunamadı`);
  const dates = rows.slice(header + 1).map((r) => {
    const m = /^(\d{1,2}) (\S+) (\d{4})$/.exec(r[0] ?? '');
    if (!m) throw new Error(`PPK ${year}: okunamayan tarih "${r[0]}"`);
    return iso(Number(m[3]), monthNumber(m[2]), Number(m[1]));
  });
  if (dates.length === 0 || dates.some((d) => !d.startsWith(String(year)))) {
    throw new Error(`PPK ${year}: tarih listesi beklenmedik`);
  }
  return dates;
}

/** TCMB "1 Hafta Repo" page: rows of "dd.mm.yyyy | borrowing | lending", oldest first. */
export function parsePolicyRates(html: string): { from: string; rate: number }[] {
  const out: { from: string; rate: number }[] = [];
  for (const r of tableRows(html)) {
    const d = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(r[0] ?? '');
    if (!d) continue;
    const rate = Number((r[2] ?? '').replace(',', '.'));
    if (!Number.isFinite(rate)) continue;
    out.push({ from: iso(Number(d[3]), Number(d[2]), Number(d[1])), rate });
  }
  if (out.length < 5) throw new Error(`Politika faizi tablosu okunamadı (${out.length} satır)`);
  for (let i = 1; i < out.length; i++) {
    if (out[i].from <= out[i - 1].from) throw new Error('Politika faizi tablosu tarih sırasında değil');
  }
  return out;
}

/** Link to the World Bank "Pink Sheet" monthly prices workbook on its commodity markets page. */
export function findPinkSheetUrl(html: string): string {
  const m = /https:\/\/thedocs\.worldbank\.org[^"]*CMO-Historical-Data-Monthly\.xlsx/.exec(html);
  if (!m) throw new Error('Dünya Bankası aylık fiyat dosyası bulunamadı');
  return m[0];
}

/** Rows of the "Monthly Prices" sheet → gold, USD per troy ounce, keyed 'YYYY-MM'. */
export function parsePinkSheetGold(rows: unknown[][]): { month: string; value: number }[] {
  const header = rows.findIndex((r) => Array.isArray(r) && r.some((c) => String(c).trim() === 'Gold'));
  if (header < 0) throw new Error('Pink Sheet: altın sütunu yok');
  const col = rows[header].findIndex((c) => String(c).trim() === 'Gold');
  const out: { month: string; value: number }[] = [];
  for (const r of rows.slice(header + 1)) {
    const m = /^(\d{4})M(\d{2})$/.exec(String(r?.[0] ?? ''));
    const v = Number(r?.[col]);
    if (m && Number.isFinite(v) && v > 0) out.push({ month: `${m[1]}-${m[2]}`, value: v });
  }
  if (out.length < 24) throw new Error(`Pink Sheet: altın serisi kısa (${out.length})`);
  return out;
}

/** Last rate of each month from a daily series keyed 'YYYY-MM-DD'. */
export function monthEnds(daily: Record<string, number>): { month: string; value: number }[] {
  const last = new Map<string, { day: string; value: number }>();
  for (const [day, value] of Object.entries(daily)) {
    const month = day.slice(0, 7);
    const prev = last.get(month);
    if (!prev || day > prev.day) last.set(month, { day, value });
  }
  return [...last].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, value: v.value }));
}

/** Link to the latest "Sektörel Enflasyon Beklentileri" report PDF on its TCMB page. */
export function findSebReportUrl(html: string): string {
  const m = /href="(\/wps\/wcm\/connect\/[0-9a-f-]{36}\/SEB-Rapor\.pdf[^"]*)"/.exec(html);
  if (!m) throw new Error('SEB rapor bağlantısı bulunamadı');
  return 'https://www.tcmb.gov.tr' + m[1].replace(/&amp;/g, '&');
}

/**
 * The SEB report states all three 12-month expectations in one sentence:
 * "2026 yılı Ekim ayında 12 ay sonrası yıllık enflasyon beklentileri … piyasa katılımcıları
 * için … yüzde 23,89 …, reel sektör için … yüzde 31,80 …, hanehalkı için … yüzde 43,75 …"
 */
export function parseSebText(text: string): { month: string; market: number; realSector: number; household: number } {
  const t = text.replace(/\s+/g, ' ');
  const m =
    /(\d{4}) yılı (\S+) ayında 12 ay sonrası yıllık enflasyon beklentileri.*?piyasa katılımcıları için.*?yüzde ([\d,]+).*?reel sektör için.*?yüzde ([\d,]+).*?hanehalkı için.*?yüzde ([\d,]+)/i.exec(
      t,
    );
  if (!m) throw new Error('Beklenti cümlesi SEB raporunda bulunamadı');
  const num = (s: string) => Number(s.replace(',', '.'));
  return {
    month: `${m[1]}-${String(monthNumber(m[2])).padStart(2, '0')}`,
    market: num(m[3]),
    realSector: num(m[4]),
    household: num(m[5]),
  };
}

/** FRED CSV ("observation_date,CPIAUCSL") → monthly index, keyed 'YYYY-MM'. */
export function parseFredMonthly(csv: string): { month: string; value: number }[] {
  const out: { month: string; value: number }[] = [];
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [date, raw] = line.split(',');
    const v = Number(raw);
    if (/^\d{4}-\d{2}-01$/.test(date) && Number.isFinite(v) && v > 0) out.push({ month: date.slice(0, 7), value: v });
  }
  if (out.length < 24) throw new Error(`ABD TÜFE serisi kısa (${out.length})`);
  for (let i = 1; i < out.length; i++) {
    const change = out[i].value / out[i - 1].value - 1;
    if (Math.abs(change) > 0.03) throw new Error(`ABD TÜFE ${out[i].month}: aylık %${(change * 100).toFixed(1)} olağan dışı`);
  }
  return out;
}

/**
 * EVDS weekly items → the latest week with every series filled. `codes` pairs a series code
 * with the longest term (days) it covers, e.g. ['TP.TRY.MT03', 92].
 */
export function parseEvdsDepositRates(
  items: Record<string, unknown>[],
  codes: [string, number | null][],
): { date: string; byTerm: { maxDays: number | null; rate: number }[] } {
  for (const item of [...items].reverse()) {
    const rates = codes.map(([code]) => Number(item[code.replace(/\./g, '_')]));
    if (rates.every((r) => Number.isFinite(r) && r > 0)) {
      if (rates.some((r) => r < 1 || r > 150)) throw new Error(`Mevduat faizi olağan dışı: ${rates.join(', ')}`);
      const [d, m, y] = String(item.Tarih).split('-');
      return { date: `${y}-${m}-${d}`, byTerm: codes.map(([, maxDays], i) => ({ maxDays, rate: rates[i] })) };
    }
  }
  throw new Error('EVDS: dolu mevduat faizi haftası yok');
}

/** TÜİK main-group codes behind the basket groups; everything else is "other". */
export const CPI_GROUP_CODES = { food: '01', housing: '04', health: '06', transport: '07', education: '10' } as const;

/**
 * EVDS monthly CPI indices (GENEL and main groups) and the yearly main-group weights → each basket
 * group's yearly change. "other" is the remainder, so the groups at TÜİK weights add up to the
 * headline rate exactly.
 */
export function parseCpiGroups(
  indexItems: Record<string, unknown>[],
  weightItems: Record<string, unknown>[],
): { month: string; yoy: Record<string, number>; weights: Record<string, number>; general: number } {
  const rows = indexItems.filter((r) => Number(r.TP_TUKFIY2025_GENEL) > 0);
  if (rows.length < 13) throw new Error(`TÜFE grupları: ${rows.length} ay`);
  const last = rows[rows.length - 1];
  const yearAgo = rows[rows.length - 13];
  const [y, m] = String(last.Tarih).split('-');
  const month = `${y}-${m.padStart(2, '0')}`;
  const change = (code: string) => {
    const now = Number(last[`TP_TUKFIY2025_${code}`]);
    const then = Number(yearAgo[`TP_TUKFIY2025_${code}`]);
    if (!(now > 0 && then > 0)) throw new Error(`TÜFE grubu ${code} eksik`);
    return (now / then - 1) * 100;
  };
  const w = weightItems[weightItems.length - 1];
  const weight = (code: string) => {
    const v = Number(w[`TP_TUKFIYAGRLK_${code}`]);
    if (!(v > 0 && v < 100)) throw new Error(`TÜFE ağırlığı ${code} eksik`);
    return v;
  };
  const general = change('GENEL');
  const yoy: Record<string, number> = {};
  const weights: Record<string, number> = {};
  for (const [key, code] of Object.entries(CPI_GROUP_CODES)) {
    yoy[key] = change(code);
    weights[key] = weight(code);
  }
  const named = Object.values(weights).reduce((a, b) => a + b, 0);
  weights.other = 100 - named;
  yoy.other = (general * 100 - Object.keys(CPI_GROUP_CODES).reduce((a, k) => a + weights[k] * yoy[k], 0)) / weights.other;
  if (Math.abs(yoy.other) > 500) throw new Error(`TÜFE "diğer" grubu olağan dışı: ${yoy.other.toFixed(1)}`);
  return { month, yoy, weights, general };
}
