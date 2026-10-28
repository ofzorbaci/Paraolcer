// Refreshes the bundled TÜİK CPI snapshot from TCMB.
// Usage: node scripts/update-cpi.mts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parseTcmbCpiHtml, TCMB_CPI_URL } from '../src/lib/cpi-parse.ts';

const res = await fetch(TCMB_CPI_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!res.ok) throw new Error(`TCMB yanıtı: ${res.status}`);
const rows = parseTcmbCpiHtml(await res.text());

const out = fileURLToPath(new URL('../src/data/cpi-tuik.json', import.meta.url));
const snapshot = { source: TCMB_CPI_URL, fetchedAt: new Date().toISOString(), rows };
writeFileSync(out, JSON.stringify(snapshot, null, 1) + '\n');

const first = rows[0];
const last = rows[rows.length - 1];
console.log(`${rows.length} ay yazıldı: ${first.month} → ${last.month} (son yıllık %${last.yoy})`);
