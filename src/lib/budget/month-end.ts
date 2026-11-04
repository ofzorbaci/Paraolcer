// Net worth and the month-end report card: what the user owns in today's lira and in dollars,
// and what their salary buys now against the first salary they recorded.

import { inflationFor, type CpiIndex } from '../cpi';
import type { Settings } from '../types';
import { totalBalance, toTry, type Rates } from './calc';
import type { Account, Transaction } from './types';

export type NetWorth = { savings: number; accounts: number; total: number; usd?: number; missing: string[] };

/** Investments (already in TRY) plus every budget account converted at today's rate. */
export function netWorth(savingsTry: number, accounts: Account[], txs: Transaction[], rates: Rates): NetWorth {
  const { total: cash, missing } = totalBalance(accounts, txs, rates);
  const total = savingsTry + cash;
  return { savings: savingsTry, accounts: cash, total, usd: rates.usd ? total / rates.usd : undefined, missing: missing.map((a) => a.name) };
}

export type SalaryPower = {
  baseMonth: string;
  base: number;
  latestMonth: string;
  latest: number;
  /** the latest salary in base-month prices */
  latestInBasePrices: number;
  /** change in purchasing power, ratio */
  real: number;
};

/** Monthly salary totals (TRY) from income transactions in the "Maaş" category. */
export function salaryByMonth(txs: Transaction[], accounts: Account[], rates: Rates): Map<string, number> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const out = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== 'income' || t.categoryId !== 'salary') continue;
    const a = byId.get(t.accountId);
    const v = a && toTry(t.amount, a.currency, rates);
    if (v === undefined || v === null) continue;
    const m = t.date.slice(0, 7);
    out.set(m, (out.get(m) ?? 0) + v);
  }
  return out;
}

/**
 * The latest salary month against the same month a year earlier when recorded, else against the
 * first recorded salary month. Undefined until two different months exist.
 */
export function salaryPower(txs: Transaction[], accounts: Account[], rates: Rates, settings: Settings, index: CpiIndex): SalaryPower | undefined {
  const months = [...salaryByMonth(txs, accounts, rates)].sort(([a], [b]) => a.localeCompare(b));
  if (months.length < 2) return undefined;
  const [latestMonth, latest] = months[months.length - 1];
  const [y, m] = latestMonth.split('-').map(Number);
  const yearAgo = `${y - 1}-${String(m).padStart(2, '0')}`;
  const [baseMonth, base] = months.find(([mm]) => mm === yearAgo) ?? months[0];
  if (baseMonth === latestMonth || base <= 0) return undefined;
  const factor = inflationFor(settings, index, `${baseMonth}-15`, `${latestMonth}-15`).factor;
  const latestInBasePrices = latest / factor;
  return { baseMonth, base, latestMonth, latest, latestInBasePrices, real: latestInBasePrices / base - 1 };
}
