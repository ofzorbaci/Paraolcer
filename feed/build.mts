// Builds feed/public/feed.json from official TCMB sources.
// Usage: node feed/build.mts
// Each section is fetched and validated on its own; a failing section keeps its previous
// value and is listed in `errors`, and the process exits 1 so the scheduled job reports it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { extractText, getDocumentProxy } from 'unpdf';
import * as XLSX from 'xlsx';

import { parseTcmbCpiHtml, TCMB_CPI_URL } from '../src/lib/cpi-parse.ts';
import { FEED_VERSION, type Feed, type SecurityPrice } from '../src/lib/feed-types.ts';
import {
  findPinkSheetUrl,
  findSebReportUrl,
  monthEnds,
  CPI_GROUP_CODES,
  parseCpiGroups,
  parseEvdsDepositRates,
  parseEvdsMonthly,
  parseFredMonthly,
  parsePinkSheetGold,
  parsePolicyRates,
  parsePpkYear,
  parseSebText,
} from './parse.ts';
import { parseBlsCpi, parseNagerHolidays, parseWorldBankInflation, WORLD_COUNTRIES } from './extras.ts';
import { fetchSecurityList, mergeSecurityPrices, securitiesConfig } from './securities.ts';
import { buildUsQuotes, type Universe } from './us-quotes.ts';
import {
  checkCpi,
  checkDecisions,
  checkExpectations,
  checkPolicyRates,
  withholdingWarning,
} from './validate.ts';

const TCMB = 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu';
const URLS = {
  ppk: (year: number) => `${TCMB}/Temel+Faaliyetler/Para+Politikasi/PPK/${year}`,
  policyRate: `${TCMB}/Temel+Faaliyetler/Para+Politikasi/Merkez+Bankasi+Faiz+Oranlari/1+Hafta+Repo`,
  seb: `${TCMB}/Istatistikler/Egilim+Anketleri/Sektorel+Enflasyon+Beklentileri/`,
};

const OUT = fileURLToPath(new URL('./public/feed.json', import.meta.url));
/** The same feed bundled into the app, used until the first download and when offline. */
const SNAPSHOT = fileURLToPath(new URL('../src/data/feed-snapshot.json', import.meta.url));
const WITHHOLDING = fileURLToPath(new URL('./withholding.json', import.meta.url));

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (paraolcer feed)' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

const today = new Date().toISOString().slice(0, 10);
const previousPath = existsSync(OUT) ? OUT : SNAPSHOT;
const previous: Partial<Feed> = existsSync(previousPath) ? JSON.parse(readFileSync(previousPath, 'utf8')) : {};
const errors: string[] = [];

async function section<T>(name: string, build: () => Promise<T>, fallback: T | undefined): Promise<T | undefined> {
  try {
    return await build();
  } catch (e) {
    errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    return fallback;
  }
}

const cpi = await section(
  'TÜFE',
  async () => {
    const rows = parseTcmbCpiHtml(await (await get(TCMB_CPI_URL)).text());
    checkCpi(rows, previous.cpi?.rows, today);
    return { rows, source: TCMB_CPI_URL };
  },
  previous.cpi,
);

const policyRate = await section(
  'Politika faizi',
  async () => {
    const history = parsePolicyRates(await (await get(URLS.policyRate)).text()).slice(-24);
    checkPolicyRates(history, previous.policyRate?.history);
    return { history, source: URLS.policyRate };
  },
  previous.policyRate,
);

const rateDecisions = await section(
  'PPK takvimi',
  async () => {
    const year = Number(today.slice(0, 4));
    const dates = parsePpkYear(await (await get(URLS.ppk(year))).text(), year);
    // Next year's calendar appears in December; until then its page may not exist.
    try {
      dates.push(...parsePpkYear(await (await get(URLS.ppk(year + 1))).text(), year + 1));
    } catch {
      /* not published yet */
    }
    checkDecisions(dates);
    return { dates, time: '14:00', source: URLS.ppk(year) };
  },
  previous.rateDecisions,
);

const expectations = await section(
  'Beklenti anketi',
  async () => {
    const pdfUrl = findSebReportUrl(await (await get(URLS.seb)).text());
    const bytes = new Uint8Array(await (await get(pdfUrl)).arrayBuffer());
    const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
    const { month, ...next12m } = parseSebText(text);
    const e = { month, next12m, source: URLS.seb };
    checkExpectations(e, today);
    return e;
  },
  previous.expectations,
);

const markets = await section(
  'Piyasa geçmişi',
  async () => {
    // Six years of month-end USD/TRY (ECB via Frankfurter) and monthly gold (World Bank Pink Sheet).
    const from = `${Number(today.slice(0, 4)) - 6}-01-01`;
    const fx = (await (await get(`https://api.frankfurter.dev/v1/${from}..${today}?base=USD&symbols=TRY`)).json()) as {
      rates: Record<string, { TRY: number }>;
    };
    const usdTry = monthEnds(Object.fromEntries(Object.entries(fx.rates).map(([d, r]) => [d, r.TRY])));
    const fxEur = (await (await get(`https://api.frankfurter.dev/v1/${from}..${today}?base=EUR&symbols=TRY`)).json()) as {
      rates: Record<string, { TRY: number }>;
    };
    const eurTry = monthEnds(Object.fromEntries(Object.entries(fxEur.rates).map(([d, r]) => [d, r.TRY])));
    const pinkUrl = findPinkSheetUrl(await (await get('https://www.worldbank.org/en/research/commodity-markets')).text());
    const wb = XLSX.read(new Uint8Array(await (await get(pinkUrl)).arrayBuffer()));
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Monthly Prices'], { header: 1 });
    const goldUsdOz = parsePinkSheetGold(rows).filter((g) => g.month >= from.slice(0, 7));
    if (usdTry.length < 24) throw new Error('Dolar kuru serisi kısa');
    if (eurTry.length < 24) throw new Error('Euro kuru serisi kısa');
    return {
      usdTry,
      eurTry,
      goldUsdOz,
      source: 'Avrupa Merkez Bankası (Frankfurter) · Dünya Bankası Pink Sheet (CC BY 4.0)',
    };
  },
  previous.markets,
);

const usCpi = await section(
  'ABD TÜFE',
  async () => {
    // BLS CPI-U via FRED; public-domain data, cited in the app. BLS's own API is the fallback.
    const from = `${Number(today.slice(0, 4)) - 6}-01`;
    try {
      const rows = parseFredMonthly(await (await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL')).text());
      return { rows: rows.filter((r) => r.month >= from), source: 'ABD Çalışma İstatistikleri Bürosu (BLS) CPI-U, FRED üzerinden' };
    } catch (fredError) {
      const year = Number(today.slice(0, 4));
      const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesid: ['CUSR0000SA0'], startyear: String(year - 6), endyear: String(year) }),
      });
      if (!res.ok) throw fredError;
      const rows = parseBlsCpi(await res.json());
      return { rows: rows.filter((r) => r.month >= from), source: 'ABD Çalışma İstatistikleri Bürosu (BLS) CPI-U' };
    }
  },
  previous.usCpi,
);

// TCMB EVDS needs a free API key (GitHub secret EVDS_API_KEY). Series: weighted average rates on
// new TRY savings deposits (bie_mt100h, tasarruf mevduatı) by term: up to 1, 3, 6, 12 months, longer; override with EVDS_DEPOSIT_SERIES="CODE:maxDays,…" if TCMB renames them.
const EVDS_KEY = process.env.EVDS_API_KEY;
const DEPOSIT_SERIES: [string, number | null][] = (process.env.EVDS_DEPOSIT_SERIES ??
  'TP.TRYTAS.MT01:31,TP.TRYTAS.MT02:92,TP.TRYTAS.MT03:183,TP.TRYTAS.MT04:365,TP.TRYTAS.MT05:')
  .split(',')
  .map((x) => {
    const [code, days] = x.split(':');
    return [code, days ? Number(days) : null];
  });
const depositRates = EVDS_KEY
  ? await section(
      'Mevduat faizi',
      async () => {
        const d = new Date(Date.now() - 60 * 86_400_000);
        const fmt = (x: Date) => `${String(x.getUTCDate()).padStart(2, '0')}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${x.getUTCFullYear()}`;
        const url = `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=${DEPOSIT_SERIES.map(([c]) => c).join('-')}&startDate=${fmt(d)}&endDate=${fmt(new Date())}&type=json`;
        const res = await fetch(url, { headers: { key: EVDS_KEY } });
        if (!res.ok) throw new Error(`EVDS → HTTP ${res.status}`);
        const { items } = (await res.json()) as { items: Record<string, unknown>[] };
        return { ...parseEvdsDepositRates(items, DEPOSIT_SERIES), source: 'TCMB EVDS, yeni açılan TL tasarruf mevduatlarına uygulanan ağırlıklı ortalama faiz' };
      },
      previous.depositRates,
    )
  : previous.depositRates;

const cpiGroups = EVDS_KEY
  ? await section(
      'TÜFE grupları',
      async () => {
        const evds = async (codes: string[], from: string) => {
          const fmt = (x: Date) => `${String(x.getUTCDate()).padStart(2, '0')}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${x.getUTCFullYear()}`;
          const url = `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=${codes.join('-')}&startDate=${from}&endDate=${fmt(new Date())}&type=json`;
          const res = await fetch(url, { headers: { key: EVDS_KEY } });
          if (!res.ok) throw new Error(`EVDS → HTTP ${res.status}`);
          return ((await res.json()) as { items: Record<string, unknown>[] }).items;
        };
        const groups = Object.values(CPI_GROUP_CODES);
        const year = Number(today.slice(0, 4));
        const indices = await evds(['GENEL', ...groups].map((c) => `TP.TUKFIY2025.${c}`), `01-01-${year - 2}`);
        const weights = await evds(groups.map((c) => `TP.TUKFIYAGRLK.${c}`), `01-01-${year - 1}`);
        const g = parseCpiGroups(indices, weights);
        return { ...g, source: 'TÜİK TÜFE ana grupları ve ağırlıkları, TCMB EVDS üzerinden' } as Feed['cpiGroups'];
      },
      previous.cpiGroups,
    )
  : previous.cpiGroups;

// Fund and stock closing prices: only when a licensed provider is configured (see securities.ts).
const securitiesCfg = securitiesConfig(process.env);
const securities = securitiesCfg
  ? await section(
      'Fon ve hisse fiyatları',
      async () => {
        const list = async (url: string | undefined, prev: Record<string, SecurityPrice> | undefined, label: string) => {
          if (!url) return {};
          const fresh = await fetchSecurityList(url, securitiesCfg.apiKey, today);
          if (Object.keys(fresh).length === 0) throw new Error(`${label}: liste boş`);
          const { prices, warnings } = mergeSecurityPrices(fresh, prev, today);
          if (warnings.length) errors.push(`${label}: büyük değişim, önceki fiyat korundu (${warnings.slice(0, 5).join('; ')})`);
          return prices;
        };
        return {
          funds: await list(securitiesCfg.fundsUrl, previous.securities?.funds, 'Fonlar'),
          stocks: await list(securitiesCfg.stocksUrl, previous.securities?.stocks, 'Hisseler'),
          source: securitiesCfg.source ?? 'Veri sağlayıcı',
        };
      },
      previous.securities,
    )
  : previous.securities;

// BIST 100 total-return index, month-end, from EVDS (TCMB republishes Borsa İstanbul's closes).
const bist100 = EVDS_KEY
  ? await section(
      'BIST 100',
      async () => {
        const from = `01-01-${Number(today.slice(0, 4)) - 6}`;
        const url = `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=TP.MK.G.BILESIK&startDate=${from}&endDate=${today.split('-').reverse().join('-')}&type=json&frequency=5&aggregationTypes=last`;
        const res = await fetch(url, { headers: { key: EVDS_KEY } });
        if (!res.ok) throw new Error(`EVDS → HTTP ${res.status}`);
        const { items } = (await res.json()) as { items: Record<string, unknown>[] };
        return { rows: parseEvdsMonthly(items, 'TP.MK.G.BILESIK'), source: 'Borsa İstanbul XU100 getiri endeksi, TCMB EVDS üzerinden' };
      },
      previous.bist100,
    )
  : previous.bist100;

// Public holidays this year and next (Nager.Date, keyless): a deposit maturing on one pays the next business day.
const holidays = await section(
  'Resmi tatiller',
  async () => {
    const year = Number(today.slice(0, 4));
    const lists = await Promise.all(
      [year, year + 1].map(async (y) => parseNagerHolidays(await (await get(`https://date.nager.at/api/v3/PublicHolidays/${y}/TR`)).json())),
    );
    return { dates: lists.flat(), source: 'Nager.Date' };
  },
  previous.holidays,
);

// Yearly CPI change around the world (World Bank, CC BY 4.0, keyless).
const worldInflation = await section(
  'Dünya enflasyonu',
  async () => {
    const url = `https://api.worldbank.org/v2/country/${WORLD_COUNTRIES.join(';')}/indicator/FP.CPI.TOTL.ZG?format=json&mrnev=1&per_page=100`;
    return { items: parseWorldBankInflation(await (await get(url)).json()), source: 'Dünya Bankası (FP.CPI.TOTL.ZG)' };
  },
  previous.worldInflation,
);

// US stocks, ETFs and crypto in USD: only when an API key is configured (GitHub secrets).
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_KEY = process.env.ALPHAVANTAGE_API_KEY;
const usQuotes =
  FINNHUB_KEY || ALPHA_KEY
    ? await section(
        'ABD fiyatları',
        async () => {
          const universe = JSON.parse(readFileSync(fileURLToPath(new URL('./us-universe.json', import.meta.url)), 'utf8')) as Universe;
          const { missing, ...book } = await buildUsQuotes(universe, previous.usQuotes, { finnhubKey: FINNHUB_KEY, alphaKey: ALPHA_KEY, today });
          if (Object.keys(book.stocks).length + Object.keys(book.crypto).length === 0) throw new Error('hiç fiyat alınamadı');
          if (missing.length) console.warn(`ABD fiyatı alınamayan semboller: ${missing.join(', ')}`);
          return book;
        },
        previous.usQuotes,
      )
    : previous.usQuotes;

const ENAG = fileURLToPath(new URL('./enag.json', import.meta.url));
const enagFile = existsSync(ENAG) ? (JSON.parse(readFileSync(ENAG, 'utf8')) as { month?: string | null; yoy?: number | null }) : undefined;
const enag =
  enagFile && typeof enagFile.month === 'string' && typeof enagFile.yoy === 'number' && enagFile.yoy > 0 && enagFile.yoy < 500
    ? { month: enagFile.month, yoy: enagFile.yoy }
    : undefined;

const OFFER = fileURLToPath(new URL('./offer.json', import.meta.url));
const offerFile = existsSync(OFFER) ? (JSON.parse(readFileSync(OFFER, 'utf8')) as { lifetimeSeatsLeft?: number | null }) : undefined;
const offer = offerFile && { lifetimeSeatsLeft: typeof offerFile.lifetimeSeatsLeft === 'number' ? offerFile.lifetimeSeatsLeft : null };

const withholding = JSON.parse(readFileSync(WITHHOLDING, 'utf8')) as Feed['withholding'];
const warning = withholdingWarning(withholding.validUntil, today);
if (warning) errors.push(`Stopaj: ${warning}`);

if (!cpi || !policyRate || !rateDecisions || !expectations) {
  console.error('İlk derlemede bir bölüm alınamadı; feed yazılmadı.\n' + errors.join('\n'));
  process.exit(1);
}

const feed: Feed = {
  version: FEED_VERSION,
  generatedAt: new Date().toISOString(),
  cpi,
  policyRate,
  rateDecisions,
  expectations,
  withholding,
  ...(markets && { markets }),
  ...(usCpi && { usCpi }),
  ...(depositRates && { depositRates }),
  ...(cpiGroups && { cpiGroups }),
  ...(securities && { securities }),
  ...(bist100 && { bist100 }),
  ...(offer && { offer }),
  ...(enag && { enag }),
  ...(usQuotes && { usQuotes }),
  ...(holidays && { holidays }),
  ...(worldInflation && { worldInflation }),
  errors,
};

// Only rewrite the file when the data changed, so the scheduled job commits nothing on quiet days.
const strip = (f: Partial<Feed>) => JSON.stringify({ ...f, generatedAt: undefined });
if (strip(previous) !== strip(feed)) {
  mkdirSync(fileURLToPath(new URL('./public/', import.meta.url)), { recursive: true });
  const text = JSON.stringify(feed, null, 1) + '\n';
  writeFileSync(OUT, text);
  writeFileSync(SNAPSHOT, text);
  console.log('feed.json güncellendi');
} else {
  console.log('Değişiklik yok');
}

const lastRate = policyRate.history[policyRate.history.length - 1];
console.log(
  `TÜFE ${cpi.rows.at(-1)!.month} · faiz %${lastRate.rate} (${lastRate.from}) · ` +
    `sonraki PPK ${rateDecisions.dates.find((d) => d >= today) ?? 'yok'} · beklenti ${expectations.month} %${expectations.next12m.market}`,
);
if (errors.length) {
  console.error('Hatalar:\n' + errors.join('\n'));
  process.exit(1);
}
