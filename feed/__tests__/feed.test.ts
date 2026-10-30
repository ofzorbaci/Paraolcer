import { describe, expect, it } from 'vitest';

import { findSebReportUrl, parseCpiGroups, parsePolicyRates, parsePpkYear, parseSebText } from '../parse';
import { checkCpi, checkDecisions, checkExpectations, checkPolicyRates, withholdingWarning } from '../validate';

const ppkHtml = `
<table><tr><td>Para Politikası Kurulu Toplantı Kararı</td><td>Para Politikası Kurulu Toplantı Özeti</td></tr>
<tr><td><p>21 Ocak&nbsp;2027</p></td><td>28 Ocak&nbsp;2027</td></tr>
<tr><td>18 Mart 2027</td><td>25 Mart 2027</td></tr>
<tr><td>22 Nisan 2027</td><td>29 Nisan 2027</td></tr></table>`;

describe('PPK calendar page', () => {
  it('reads the decision column, not the summary column', () => {
    expect(parsePpkYear(ppkHtml, 2027)).toEqual(['2027-01-21', '2027-03-18', '2027-04-22']);
  });

  it('fails loudly when the table changes shape', () => {
    expect(() => parsePpkYear('<table><tr><td>Tarih</td></tr></table>', 2027)).toThrow(/karar tablosu/);
    expect(() => parsePpkYear(ppkHtml.replace('18 Mart 2027', '18 March 2027'), 2027)).toThrow(/ay adı/);
    expect(() => parsePpkYear(ppkHtml, 2026)).toThrow(/beklenmedik/);
  });
});

describe('policy rate table', () => {
  const rows = (pairs: [string, string][]) =>
    `<table><tr><td>Tarih</td><td>Borç Alma</td><td>Borç Verme</td></tr>${pairs
      .map(([d, r]) => `<tr><td>${d}</td><td>-</td><td>${r}</td></tr>`)
      .join('')}</table>`;
  const html = rows([
    ['20.05.2010', '7.00'],
    ['17.12.2010', '6.50'],
    ['12.12.2025', '38.00'],
    ['23.01.2026', '37.00'],
    ['23.10.2026', '36.00'],
  ]);

  it('reads dates and lending rates oldest first', () => {
    expect(parsePolicyRates(html).slice(-2)).toEqual([
      { from: '2026-01-23', rate: 37 },
      { from: '2026-10-23', rate: 36 },
    ]);
  });

  it('rejects a table out of date order', () => {
    expect(() => parsePolicyRates(html.replace('23.10.2026', '23.10.2020'))).toThrow(/sırasında/);
  });

  it('rejects implausible values and jumps', () => {
    expect(() => checkPolicyRates([{ from: '2026-10-23', rate: 360 }])).toThrow(/makul/);
    expect(() => checkPolicyRates([{ from: '2026-10-23', rate: 50 }], [{ rate: 36 }])).toThrow(/sıçradı/);
    expect(() => checkPolicyRates([{ from: '2026-12-11', rate: 34.5 }], [{ rate: 36 }])).not.toThrow();
  });
});

describe('sectoral expectations report', () => {
  const sentence =
    '2026 yılı Ekim ayında 12 ay sonrası yıllık enflasyon beklentileri bir önceki aya göre, piyasa katılımcıları ' +
    'için 0,19 puan artarak yüzde 23,89 seviyesine yükselirken, reel sektör için 0,70 puan azalarak yüzde 31,80 ' +
    'seviyesine, hanehalkı için 1,85 puan azalarak yüzde 43,75 seviyesine gerilemiştir.';

  it('reads all three expectations and the survey month', () => {
    expect(parseSebText(`başlık ${sentence} devamı`)).toEqual({
      month: '2026-10',
      market: 23.89,
      realSector: 31.8,
      household: 43.75,
    });
  });

  it('copes with line breaks inside the sentence', () => {
    expect(parseSebText(sentence.replace(/ /g, '\n')).household).toBe(43.75);
  });

  it('fails when the sentence is reworded', () => {
    expect(() => parseSebText('Beklentiler açıklandı.')).toThrow(/bulunamadı/);
  });

  it('finds the report PDF link', () => {
    const html =
      '<a href="/wps/wcm/connect/a5df108d-d109-4dc0-9ea6-76a78b196b4d/Pop-up-A4-TR.pdf?MOD=AJPERES">x</a>' +
      '<a href="/wps/wcm/connect/6325af8e-24a6-446d-abc8-49bb8e9f3b6b/SEB-Rapor.pdf?MOD=AJPERES&amp;CACHEID=1">PDF</a>';
    expect(findSebReportUrl(html)).toBe(
      'https://www.tcmb.gov.tr/wps/wcm/connect/6325af8e-24a6-446d-abc8-49bb8e9f3b6b/SEB-Rapor.pdf?MOD=AJPERES&CACHEID=1',
    );
  });
});

describe('build checks', () => {
  it('flags a stale CPI series or survey', () => {
    expect(() => checkCpi([{ month: '2026-06', yoy: 30, mom: 2 }], undefined, '2026-10-28')).toThrow(/eski/);
    expect(() => checkCpi([{ month: '2026-09', yoy: 30, mom: 2 }], undefined, '2026-10-28')).not.toThrow();
    const e = { month: '2026-06', next12m: { market: 24, realSector: 31, household: 44 }, source: '' };
    expect(() => checkExpectations(e, '2026-10-28')).toThrow(/eski/);
  });

  it('rejects weekend or unsorted decision dates', () => {
    expect(() => checkDecisions(['2026-12-10', '2027-01-21'])).not.toThrow();
    expect(() => checkDecisions(['2027-01-21', '2026-12-10'])).toThrow(/sırasız/);
    expect(() => checkDecisions(['2026-12-12'])).toThrow(/hafta sonu/);
  });

  it('warns a month before withholding rates expire, and after', () => {
    expect(withholdingWarning('2026-12-31', '2026-10-28')).toBeUndefined();
    expect(withholdingWarning('2026-12-31', '2026-12-10')).toMatch(/21 gün/);
    expect(withholdingWarning('2026-12-31', '2027-01-02')).toMatch(/doldu/);
  });
});

describe('CPI groups from EVDS', () => {
  it('derives "other" so the groups add up to the headline rate', () => {
    const codes = ['GENEL', '01', '04', '06', '07', '10'];
    const item = (t: string, lvl: number) => Object.fromEntries([['Tarih', t], ...codes.map((c) => [`TP_TUKFIY2025_${c}`, String(lvl)])]);
    const items = Array.from({ length: 13 }, (_, i) => item(`2026-${i}`, 100 + i * 2.5));
    const weights = [{ Tarih: 2026, TP_TUKFIYAGRLK_01: '25', TP_TUKFIYAGRLK_04: '15', TP_TUKFIYAGRLK_06: '3', TP_TUKFIYAGRLK_07: '17', TP_TUKFIYAGRLK_10: '2' }];
    const g = parseCpiGroups(items, weights);
    expect(g.general).toBeCloseTo(30, 6);
    expect(g.weights.other).toBeCloseTo(38, 6);
    const sum = Object.keys(g.yoy).reduce((a, k) => a + g.yoy[k] * g.weights[k], 0) / 100;
    expect(sum).toBeCloseTo(g.general, 6);
  });
});
