import { describe, expect, it } from 'vitest';

import { canAddHolding, FREE_HOLDING_LIMIT, NO_PREMIUM, yearlySavings } from '../entitlements';
import { freeTrialDays, statusFromCustomerInfo } from '../subscription-map';

describe('free tier', () => {
  it('limits adding, never keeping', () => {
    expect(canAddHolding(FREE_HOLDING_LIMIT - 1, false)).toBe(true);
    expect(canAddHolding(FREE_HOLDING_LIMIT, false)).toBe(false);
    // A lapsed subscriber with more holdings keeps them but cannot add.
    expect(canAddHolding(12, false)).toBe(false);
    expect(canAddHolding(12, true)).toBe(true);
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
    expect(statusFromCustomerInfo(info({ other: entitlement({}) }), 'premium')).toEqual({
      ...NO_PREMIUM,
      managementUrl: 'https://apps.apple.com/account/subscriptions',
    });
  });

  it('turns store intro offers into trial days', () => {
    expect(freeTrialDays({ price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7, cycles: 1 })).toBe(7);
    expect(freeTrialDays({ price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 })).toBe(7);
    expect(freeTrialDays({ price: 9.99, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 1 })).toBeUndefined();
    expect(freeTrialDays(null)).toBeUndefined();
  });
});
