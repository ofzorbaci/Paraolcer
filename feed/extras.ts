// Smaller public sources for the feed: Turkish public holidays (Nager.Date), yearly inflation
// around the world (World Bank) and a BLS fallback for US CPI. Parsers are pure so they can be
// tested without the network.

/** Nager.Date /PublicHolidays/{year}/TR → sorted 'YYYY-MM-DD' list of nationwide public holidays. */
export function parseNagerHolidays(json: unknown): { date: string; name: string }[] {
  if (!Array.isArray(json)) throw new Error('Tatil yanıtı liste değil');
  const out = json
    .filter((h) => h && typeof h.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.global !== false)
    .map((h) => ({ date: h.date as string, name: String(h.localName ?? h.name ?? '') }));
  if (out.length < 8) throw new Error(`Tatil listesi kısa (${out.length})`);
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Countries shown next to Türkiye, in this order. ISO3 codes; EMU is the euro area. */
export const WORLD_COUNTRIES = ['TUR', 'ARG', 'USA', 'EMU', 'DEU', 'GBR', 'BRA', 'RUS', 'IND', 'CHN', 'JPN'];

const COUNTRY_TR: Record<string, string> = {
  TUR: 'Türkiye',
  ARG: 'Arjantin',
  USA: 'ABD',
  EMU: 'Euro bölgesi',
  DEU: 'Almanya',
  GBR: 'Birleşik Krallık',
  BRA: 'Brezilya',
  RUS: 'Rusya',
  IND: 'Hindistan',
  CHN: 'Çin',
  JPN: 'Japonya',
};

export type WorldInflationItem = { code: string; name: string; year: string; value: number };

/** World Bank FP.CPI.TOTL.ZG (mrnev=1) → the latest yearly CPI change per country. */
export function parseWorldBankInflation(json: unknown): WorldInflationItem[] {
  const rows = Array.isArray(json) && Array.isArray(json[1]) ? (json[1] as Record<string, unknown>[]) : undefined;
  if (!rows) throw new Error('Dünya Bankası yanıtı beklenen biçimde değil');
  const out: WorldInflationItem[] = [];
  for (const r of rows) {
    const code = String(r.countryiso3code ?? '');
    const value = Number(r.value);
    const year = String(r.date ?? '');
    if (!COUNTRY_TR[code] || r.value === null || !Number.isFinite(value) || !/^\d{4}$/.test(year)) continue;
    out.push({ code, name: COUNTRY_TR[code], year, value: Math.round(value * 10) / 10 });
  }
  if (!out.some((i) => i.code === 'TUR')) throw new Error('Dünya Bankası verisinde Türkiye yok');
  return WORLD_COUNTRIES.map((c) => out.find((i) => i.code === c)).filter((i): i is WorldInflationItem => !!i);
}

/** BLS timeseries API v2 (CUSR0000SA0, CPI-U seasonally adjusted) → monthly index, oldest first. */
export function parseBlsCpi(json: unknown): { month: string; value: number }[] {
  const body = json as { status?: string; Results?: { series?: { data?: { year: string; period: string; value: string }[] }[] } };
  const data = body?.Results?.series?.[0]?.data;
  if (body?.status !== 'REQUEST_SUCCEEDED' || !Array.isArray(data)) throw new Error('BLS yanıtı başarısız');
  const out = data
    .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period) && Number(d.value) > 0)
    .map((d) => ({ month: `${d.year}-${d.period.slice(1)}`, value: Number(d.value) }))
    .sort((a, b) => a.month.localeCompare(b.month));
  if (out.length < 24) throw new Error(`BLS serisi kısa (${out.length})`);
  return out;
}
