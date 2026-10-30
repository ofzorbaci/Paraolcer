import { describe, expect, it } from 'vitest';

import { basketRate, defaultBasket } from '../basket';
import { canAddHolding, NO_PREMIUM, renewCheckAllowed, yearlySavings } from '../entitlements';
import { shouldAskForReview } from '../review';
import { freeTrialDays, statusFromCustomerInfo } from '../subscription-map';

describe('free tier', () => {
  it('never limits holdings', () => {
    expect(canAddHolding(0, false)).toBe(true);
    expect(canAddHolding(250, false)).toBe(true);
  });

  it('gives free users one "Yenilesem mi?" result a month', () => {
    expect(renewCheckAllowed(false, undefined, 0, '2026-11')).toBe(true);
    expect(renewCheckAllowed(false, '2026-11', 1, '2026-11')).toBe(false);
    // A new month resets the counter.
    expect(renewCheckAllowed(false, '2026-10', 1, '2026-11')).toBe(true);
    expect(renewCheckAllowed(true, '2026-11', 9, '2026-11')).toBe(true);
  });

  it('expresses the yearly plan per month and as a saving', () => {
    const s = yearlySavings(99.99, 799.99);
    expect(s.perMonth).toBeCloseTo(66.67, 2);
    expect(s.savingPct).toBe(33);
    expect(yearlySavings(0, 100).savingPct).toBe(0);
    expect(yearlySavings(10, 200).savingPct).toBe(0);
  });
});

describe('store status', () => {
  const entitlement = (over: object) => ({
    isActive: true,
    willRenew: true,
    periodType: 'NORMAL',
    expirationDate: '2027-10-29T10:00:00Z',
    productIdentifier: 'paraolcer_yearly',
    ...over,
  });
  const info = (active: Record<string, unknown>) => ({
    entitlements: { active },
    managementURL: 'https://apps.apple.com/account/subscriptions',
  }) as Parameters<typeof statusFromCustomerInfo>[0];

  it('reads an active paid subscription', () => {
    expect(statusFromCustomerInfo(info({ premium: entitlement({}) }), 'premium')).toEqual({
      active: true,
      trial: false,
      expiresAt: '2027-10-29T10:00:00Z',
      willRenew: true,
      productId: 'paraolcer_yearly',
      source: 'store',
      managementUrl: 'https://apps.apple.com/account/subscriptions',
    });
  });

  it('marks the free trial and a cancelled renewal', () => {
    const s = statusFromCustomerInfo(info({ premium: entitlement({ periodType: 'TRIAL', willRenew: false }) }), 'premium');
    expect(s.trial).toBe(true);
    expect(s.willRenew).toBe(false);
    expect(s.active).toBe(true);
  });

  it('is free when the entitlement is missing or inactive', () => {
    expect(statusFromCustomerInfo(info({}), 'premium').active).toBe(false);
    expect(statusFromCustomerInfo(info({ premium: entitlement({ isActive: false }) }), 'premium').active).toBe(false);
    expect(statusFromCustomerInfo(info({ premium: entitlement({ isActive: false }) }), 'premium')).toEqual({
      ...NO_PREMIUM,
      managementUrl: 'https://apps.apple.com/account/subscriptions',
    });
  });

  it('accepts a single entitlement named differently in the dashboard', () => {
    expect(statusFromCustomerInfo(info({ pro: entitlement({}) }), 'premium').active).toBe(true);
  });

  it('turns store intro offers into trial days', () => {
    expect(freeTrialDays({ price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7, cycles: 1 })).toBe(7);
    expect(freeTrialDays({ price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 })).toBe(7);
    expect(freeTrialDays({ price: 9.99, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 1 })).toBeUndefined();
    expect(freeTrialDays(null)).toBeUndefined();
  });
});

describe('personal basket', () => {
  it('weights each group by its share of spending', () => {
    const b = defaultBasket(30);
    expect(basketRate(b)).toBeCloseTo(30, 10);
    b.rates.housing = 80;
    // 20% of spending rising 80% instead of 30% adds 10 points.
    expect(basketRate(b)).toBeCloseTo(40, 10);
  });

  it('ignores negative weights and needs at least one', () => {
    const b = defaultBasket(30);
    for (const k of Object.keys(b.weights) as (keyof typeof b.weights)[]) b.weights[k] = 0;
    expect(basketRate(b)).toBeUndefined();
    b.weights.food = -5;
    expect(basketRate(b)).toBeUndefined();
  });
});

describe('review prompt', () => {
  const now = new Date('2026-11-10T10:00:00Z');
  it('waits for a good moment and the third open', () => {
    expect(shouldAskForReview(2, undefined, now, true)).toBe(false);
    expect(shouldAskForReview(3, undefined, now, false)).toBe(false);
    expect(shouldAskForReview(3, undefined, now, true)).toBe(true);
  });
  it('asks at most once every four months', () => {
    expect(shouldAskForReview(9, '2026-09-01T00:00:00Z', now, true)).toBe(false);
    expect(shouldAskForReview(9, '2026-06-01T00:00:00Z', now, true)).toBe(true);
  });
});
