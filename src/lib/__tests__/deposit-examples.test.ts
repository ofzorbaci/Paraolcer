import { describe, expect, it } from 'vitest';

import data from '../../data/deposit-examples.json';
import { termInterest } from '../deposit';

describe('worked deposit examples', () => {
  it('computes a term like a bank statement', () => {
    expect(termInterest(100_000, 40, 32, 17.5)).toEqual({ gross: 3506.85, tax: 613.7, net: 2893.15 });
  });

  it('matches every statement-verified example to the kuruş', () => {
    for (const e of data.examples) {
      if (e.statementNet === null) continue;
      expect(termInterest(e.principal, e.grossRate, e.termDays, e.withholding).net).toBe(e.statementNet);
    }
  });
});
