import { describe, expect, it } from 'vitest';

import feed from '../../data/feed-snapshot.json';
import { decryptBackup, encryptBackup, type BackupData } from '../backup';
import { compareAlternatives } from '../benchmark';
import { buildCpiIndex } from '../cpi';
import { goldPureGrams } from '../gold';
import { checkQuote, parseTcmbRates, toLivePrices } from '../prices';
import { analyzeHolding, holdingValue } from '../returns';
import { bugReportUrl } from '../support';
import type { Holding, Settings } from '../types';
import { plausibilityWarnings } from '../validate';

const snapshot = feed.cpi;

const index = buildCpiIndex(snapshot.rows);
const custom30: Settings = { inflationSource: 'custom', customAnnualRate: 30, notifyCpi: false };
const rand = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

function holding(over: Partial<Holding>): Holding {
  return { id: 'h', kind: 'other', name: 'x', buyDate: '2025-10-01', quantity: 1, unitCost: 100, ...over };
}

describe('plausibility warnings', () => {
  it('flags a 27-trillion style typo', () => {
    const w = plausibilityWarnings(holding({ quantity: 1_000_000, unitCost: 100_000 }), { prices: {} });
    expect(w.map((x) => x.field)).toContain('total');
  });

  it('flags a currency rate far from the reference rate', () => {
    const usd = holding({ kind: 'usd', quantity: 100, unitCost: 3.4 });
    expect(plausibilityWarnings(usd, { referenceRate: 34, prices: {} })[0].field).toBe('cost');
    expect(plausibilityWarnings({ ...usd, unitCost: 35 }, { referenceRate: 34, prices: {} })).toEqual([]);
  });

  it('flags monthly rates typed as annual and day/year mix-ups on deposits', () => {
    const d = holding({ kind: 'deposit', unitCost: 1000, grossRate: 400, termDays: 32 });
    expect(plausibilityWarnings(d, { prices: {} }).map((x) => x.field)).toEqual(['gross']);
    expect(plausibilityWarnings({ ...d, grossRate: 45, termDays: 5000 }, { prices: {} }).map((x) => x.field)).toEqual(['term']);
  });

  it('checks coin prices against fine gold, not grams', () => {
    const coin = holding({ kind: 'gold', goldType: 'ceyrek', unitCost: 11_000 });
    expect(plausibilityWarnings(coin, { prices: { gold: 6500 } })).toEqual([]);
    expect(plausibilityWarnings({ ...coin, unitCost: 110_000 }, { prices: { gold: 6500 } })[0].field).toBe('cost');
  });

  it('flags a current price off by a factor of ten', () => {
    expect(plausibilityWarnings(holding({ currentPrice: 2000 }), { prices: {} })[0].field).toBe('current');
  });
});

describe('gold coins', () => {
  it('prices coins by their fine gold content', () => {
    expect(goldPureGrams('gram')).toBe(1);
    expect(goldPureGrams('ceyrek')).toBeCloseTo(1.6077, 3);
    expect(goldPureGrams('cumhuriyet')).toBeCloseTo(6.6142, 3);
    const coins = holding({ kind: 'gold', goldType: 'tam', quantity: 2 });
    expect(holdingValue(coins, '2026-10-28', { gold: 6000 })).toBeCloseTo(2 * 7.016 * 0.9166 * 6000, 5);
  });

  it('treats gold saved before coins existed as grams', () => {
    expect(holdingValue(holding({ kind: 'gold', quantity: 10 }), '2026-10-28', { gold: 6000 })).toBe(60_000);
  });
});

describe('price layer', () => {
  it('parses TCMB mid rates and the bulletin date', () => {
    const xml = `<Tarih_Date Tarih="27.10.2026" Date="10/27/2026">
      <Currency Kod="USD"><ForexBuying>49.6997</ForexBuying><ForexSelling>49.7892</ForexSelling></Currency>
      <Currency Kod="EUR"><ForexBuying>55.0</ForexBuying><ForexSelling>55.2</ForexSelling></Currency>`;
    const r = parseTcmbRates(xml);
    expect(r.usd).toBeCloseTo(49.74445, 5);
    expect(r.eur).toBeCloseTo(55.1, 5);
    expect(r.asOf).toBe('2026-10-27');
  });

  it('rejects implausible values and sudden jumps', () => {
    const prev = { value: 49.8, source: 'ECB', fetchedAt: '2026-10-27T10:00:00Z' };
    expect(checkQuote('usd', 50.1, prev)).toBeUndefined();
    expect(checkQuote('usd', 0.5, prev)).toMatch(/makul/);
    expect(checkQuote('usd', 70, prev)).toMatch(/farklı/);
    expect(checkQuote('gold', 6500, undefined)).toBeUndefined();
  });

  it('exposes plain numbers for the calculators', () => {
    expect(toLivePrices({ usd: { value: 49.8, source: 'ECB', fetchedAt: '' } })).toEqual({ usd: 49.8, eur: undefined, gold: undefined });
  });
});

describe('alternatives', () => {
  it('compares the portfolio with dollars and a deposit under the same inflation', () => {
    const items = [holding({ unitCost: 100_000, currentPrice: 140_000, buyDate: '2025-10-01' })].map((h) => ({
      holding: h,
      analysis: analyzeHolding(h, '2026-10-01', {}, custom30, index),
    }));
    const terms = { grossRate: 40, termDays: 365, withholding: 15, fromPortfolio: false };
    const [mine, usd, dep] = compareAlternatives(items, 117_000, terms, '2026-10-01');
    expect(mine.real).toBeCloseTo(140 / 130 - 1, 5);
    expect(usd.real).toBeCloseTo(117 / 130 - 1, 5);
    expect(dep.value).toBeCloseTo(134_000, 0);
    expect(dep.real).toBeCloseTo(134 / 130 - 1, 4);
  });

  it('skips the dollar line when its history is not loaded', () => {
    const items = [holding({ currentPrice: 120 })].map((h) => ({
      holding: h,
      analysis: analyzeHolding(h, '2026-10-01', {}, custom30, index),
    }));
    const keys = compareAlternatives(items, undefined, { grossRate: 40, termDays: 32, withholding: 17.5, fromPortfolio: false }, '2026-10-01').map((a) => a.key);
    expect(keys).toEqual(['portfolio', 'deposit']);
  });
});

describe('encrypted backup', () => {
  const data: BackupData = {
    holdings: [holding({ name: 'THYAO', kind: 'stock' })],
    settings: custom30,
    exportedAt: '2026-10-28T12:00:00Z',
  };

  it('round-trips with the right password', async () => {
    const file = await encryptBackup(data, 'güçlü-şifre-1', rand);
    expect(file).not.toContain('THYAO');
    expect(await decryptBackup(file, 'güçlü-şifre-1')).toEqual(data);
  });

  it('refuses a wrong password or a tampered file', async () => {
    const file = await encryptBackup(data, 'doğru-şifre', rand);
    await expect(decryptBackup(file, 'yanlış-şifre')).rejects.toThrow(/Şifre yanlış/);
    const parsed = JSON.parse(file);
    parsed.data = (parsed.data[0] === 'a' ? 'b' : 'a') + parsed.data.slice(1);
    await expect(decryptBackup(JSON.stringify(parsed), 'doğru-şifre')).rejects.toThrow(/Şifre yanlış/);
  });

  it('rejects short passwords and foreign files', async () => {
    await expect(encryptBackup(data, 'kısa', rand)).rejects.toThrow(/en az 8/);
    await expect(decryptBackup('{"app":"başka"}', 'x')).rejects.toThrow(/yedeği değil/);
    await expect(decryptBackup('merhaba', 'x')).rejects.toThrow(/yedek dosyası değil/);
  });
});

describe('bug report', () => {
  it('describes the app state without any amounts', () => {
    const url = bugReportUrl({
      appVersion: '1.0.0',
      platform: 'ios 19',
      settings: custom30,
      cpiLast: '2026-09',
      cpiLive: true,
      priceBook: { usd: { value: 49.8, source: 'ECB', fetchedAt: '2026-10-28T11:00:00Z' } },
      holdings: [holding({ kind: 'deposit', unitCost: 123_456 }), holding({ kind: 'deposit' })],
    });
    expect(url.startsWith('mailto:ofzorbaci@gmail.com?subject=')).toBe(true);
    const body = decodeURIComponent(url.split('&body=')[1]);
    expect(body).toContain('TL mevduat: 2');
    expect(body).toContain('usd ECB');
    expect(body).not.toContain('123');
    expect(body).not.toContain('49.8');
  });
});
