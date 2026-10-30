// Premium alarms and goals. Pure functions: the store decides when to check, this decides
// what changed. A notification fires only when a condition flips, never on every check.

import { inflationFor, type CpiIndex } from './cpi';
import { formatTL } from './format';
import type { Goal, Settings } from './types';

export type AlertState = { realNegative?: boolean; goalReached?: boolean };

export type AlertMessage = { title: string; body: string; url: string };

/** The goal in today's lira: what the amount set on `goal.setAt` needs to be now to buy the same. */
export function goalTarget(goal: Goal, today: string, settings: Settings, index: CpiIndex): number {
  return goal.amount * inflationFor(settings, index, goal.setAt, today).factor;
}

export function goalProgress(value: number, target: number): number {
  return target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
}

export function checkAlerts(
  prev: AlertState,
  now: { real?: number; value?: number; target?: number },
  enabled: { realBelowZero: boolean; goal: boolean },
): { state: AlertState; fire: AlertMessage[] } {
  const fire: AlertMessage[] = [];
  const state: AlertState = { ...prev };

  if (enabled.realBelowZero && now.real !== undefined) {
    const negative = now.real < 0;
    if (negative && !prev.realNegative) {
      fire.push({
        title: 'Reel getirin eksiye döndü',
        body: 'Birikimin artık enflasyonun gerisinde. Hangi varlığın erittiğine bak.',
        url: '/holdings',
      });
    }
    state.realNegative = negative;
  } else {
    state.realNegative = undefined;
  }

  if (enabled.goal && now.value !== undefined && now.target !== undefined) {
    const reached = now.value >= now.target;
    if (reached && !prev.goalReached) {
      fire.push({
        title: 'Hedefine ulaştın',
        body: `Birikimin bugünün lirasıyla ${formatTL(now.target)} hedefini geçti.`,
        url: '/',
      });
    }
    state.goalReached = reached;
  } else {
    state.goalReached = undefined;
  }

  return { state, fire };
}
