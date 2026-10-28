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
