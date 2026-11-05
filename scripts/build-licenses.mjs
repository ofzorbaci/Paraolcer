// Writes feed/public/lisanslar.html: the open-source packages the app ships with, their licence
// and copyright line. Run after changing dependencies: `npm run licenses`.
// Walks the production dependency tree from package.json through node_modules; development-only
// packages are left out.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'feed', 'public', 'lisanslar.html');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Node's lookup: the package next to the requiring one first, then each parent node_modules. */
function resolve(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function copyrightOf(pkgDir) {
  const file = readdirSync(pkgDir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  if (!file) return undefined;
  const text = readFileSync(join(pkgDir, file), 'utf8');
  return text.split(/\r?\n/).find((l) => /copyright\s*(\(c\)|©|\d{4})/i.test(l))?.trim();
}

function licenseOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  return 'Belirtilmemiş';
}

const root = readJson(join(ROOT, 'package.json'));
const seen = new Map();
const queue = Object.keys(root.dependencies ?? {}).map((name) => [name, ROOT]);
while (queue.length) {
  const [name, from] = queue.shift();
  const file = resolve(name, from);
  if (!file) continue;
  const pkgDir = dirname(file);
  if (seen.has(pkgDir)) continue;
  const pkg = readJson(file);
  seen.set(pkgDir, {
    name: pkg.name ?? name,
    version: pkg.version ?? '',
    license: licenseOf(pkg),
    copyright: copyrightOf(pkgDir),
    url: typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url,
  });
  for (const dep of Object.keys(pkg.dependencies ?? {})) queue.push([dep, pkgDir]);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const repoUrl = (u) =>
  u
    ? u.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '').replace(/^github:/, 'https://github.com/')
    : undefined;

// One row per package name and version (the same package can sit in several folders).
const rows = [...new Map([...seen.values()].map((p) => [`${p.name}@${p.version}`, p])).values()].sort((a, b) =>
  a.name.localeCompare(b.name),
);
const counts = rows.reduce((m, r) => m.set(r.license, (m.get(r.license) ?? 0) + 1), new Map());
const summary = [...counts].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${esc(l)} (${n})`).join(', ');

const style = readFileSync(join(ROOT, 'feed', 'public', 'gizlilik.html'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0];

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Açık kaynak lisansları · Paraölçer</title>
<meta name="robots" content="noindex">
${style}
</head>
<body>
<header>
  <div class="wrap">
    <h1>Açık kaynak lisansları</h1>
    <p>Paraölçer · ${rows.length} paket</p>
  </div>
</header>
<main class="wrap">
  <section>
    <p>Paraölçer aşağıdaki açık kaynak yazılımlarla yapıldı. Her paket kendi lisansıyla dağıtılır; telif hakları sahiplerine aittir. Lisansların tam metni her paketin kaynak deposunda ve <a href="https://opensource.org/licenses" rel="noopener">opensource.org</a> adresinde yer alır.</p>
    <p class="muted">Lisanslar: ${summary}</p>
    <p class="muted">Yazı tipleri: Inter ve Sora, SIL Open Font License 1.1 ile.</p>
  </section>
  <section>
    <div class="table-scroll">
    <table>
      <tr><th>Paket</th><th>Lisans</th><th>Telif</th></tr>
${rows
  .map((r) => {
    const url = repoUrl(r.url);
    const name = url && /^https:\/\//.test(url) ? `<a href="${esc(url)}" rel="noopener">${esc(r.name)}</a>` : esc(r.name);
    return `      <tr><td>${name} ${esc(r.version)}</td><td>${esc(r.license)}</td><td>${esc(r.copyright ?? '')}</td></tr>`;
  })
  .join('\n')}
    </table>
    </div>
  </section>
  <section>
    <h2>MIT Lisansı</h2>
    <p class="muted">Paketlerin çoğunun lisansı. Yukarıdaki her MIT paketi için, kendi telif satırıyla birlikte geçerlidir:</p>
    <p class="muted">Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.</p>
  </section>
  <p class="muted" style="text-align:center"><a href="kosullar.html">Kullanım koşulları</a> · <a href="gizlilik.html">Gizlilik politikası</a></p>
</main>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`lisanslar.html: ${rows.length} paket · ${summary}`);
