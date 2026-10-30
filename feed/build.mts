// Builds feed/public/feed.json from official TCMB sources.
// Usage: node feed/build.mts
// Each section is fetched and validated on its own; a failing section keeps its previous
// value and is listed in `errors`, and the process exits 1 so the scheduled job reports it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { extractText, getDocumentProxy } from 'unpdf';
import * as XLSX from 'xlsx';

import { parseTcmbCpiHtml, TCMB_CPI_URL } from '../src/lib/cpi-parse.ts';
import { FEED_VERSION, type Feed } from '../src/lib/feed-types.ts';
import { findPinkSheetUrl, findSebReportUrl, monthEnds, parsePinkSheetGold, parsePolicyRates, parsePpkYear, parseSebText } from './parse.ts';
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
    const pinkUrl = findPinkSheetUrl(await (await get('https://www.worldbank.org/en/research/commodity-markets')).text());
    const wb = XLSX.read(new Uint8Array(await (await get(pinkUrl)).arrayBuffer()));
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Monthly Prices'], { header: 1 });
    const goldUsdOz = parsePinkSheetGold(rows).filter((g) => g.month >= from.slice(0, 7));
    if (usdTry.length < 24) throw new Error('Dolar kuru serisi kısa');
    return {
      usdTry,
      goldUsdOz,
      source: 'Avrupa Merkez Bankası (Frankfurter) · Dünya Bankası Pink Sheet (CC BY 4.0)',
    };
  },
  previous.markets,
);

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
