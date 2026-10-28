import { inflationFor, type CpiIndex, type InflationResult } from './cpi';
import type { Settings } from './types';

export type SalaryErosion = {
  inflation: InflationResult;
  /** today's salary in the prices of the raise month */
  realValue: number;
  /** purchasing power lost per month, in raise-month TRY */
  monthlyLoss: number;
  /** salary needed today to buy what the salary bought at the raise */
  needed: number;
  /** raise needed today to get back to the raise-month level, ratio */
  raiseNeeded: number;
};

/** How much a salary unchanged since `raiseDate` has eroded. */
export function salaryErosion(
  salary: number,
  raiseDate: string,
  today: string,
  settings: Settings,
  index: CpiIndex,
): SalaryErosion {
  const inflation = inflationFor(settings, index, raiseDate, today);
  const realValue = salary / inflation.factor;
  return {
    inflation,
    realValue,
    monthlyLoss: salary - realValue,
    needed: salary * inflation.factor,
    raiseNeeded: inflation.factor - 1,
  };
}
