// Subscriptions through App Store / Google Play, via RevenueCat. Apple and Google take the
// payment; RevenueCat validates receipts and tells us whether the "premium" entitlement is
// active (trial, renewal, cancellation and refunds included).
//
// Keys live in app.json → expo.extra.revenuecat. Without a key (or in Expo Go and on the web,
// where the SDK runs in preview mode) real purchases are unavailable.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { NO_PREMIUM, type PremiumStatus } from './entitlements';
import { freeTrialDays, statusFromCustomerInfo } from './subscription-map';

type Config = { iosApiKey?: string; androidApiKey?: string; entitlement?: string };

const config: Config = (Constants.expoConfig?.extra?.revenuecat as Config | undefined) ?? {};
const ENTITLEMENT = config.entitlement ?? 'premium';
const apiKey = Platform.select({ ios: config.iosApiKey, android: config.androidApiKey });

export type Plan = {
  id: string;
  period: 'monthly' | 'yearly';
  /** full renewal price as the store formats it, e.g. "₺999,99" */
  priceString: string;
  price: number;
  currencyCode: string;
  /** free trial length in days, if the store offers one to this user */
  trialDays?: number;
  /** the store package; opaque outside this module */
  ref: unknown;
};

let configured = false;

/** True when real purchases can be made on this device. */
export function purchasesAvailable(): boolean {
  return configured;
}

export function toStatus(info: CustomerInfo): PremiumStatus {
  return statusFromCustomerInfo(info, ENTITLEMENT);
}

function toPlan(pkg: PurchasesPackage, period: Plan['period']): Plan {
  const p = pkg.product;
  return {
    id: p.identifier,
    period,
    priceString: p.priceString,
    price: p.price,
    currencyCode: p.currencyCode,
    trialDays: freeTrialDays(p.introPrice),
    ref: pkg,
  };
}

/** Configures the SDK once and reports entitlement changes (renewals, expiries, refunds). */
export async function initPurchases(onChange: (status: PremiumStatus) => void): Promise<PremiumStatus | undefined> {
  if (configured || !apiKey) return undefined;
  try {
    Purchases.configure({ apiKey });
    configured = true;
    Purchases.addCustomerInfoUpdateListener((info) => onChange(toStatus(info)));
    return toStatus(await Purchases.getCustomerInfo());
  } catch {
    configured = false;
    return undefined;
  }
}

/** Monthly and yearly plans from the current RevenueCat offering, yearly first. */
export async function loadPlans(): Promise<Plan[]> {
  if (!configured) return [];
  const offering = (await Purchases.getOfferings()).current;
  if (!offering) return [];
  const plans: Plan[] = [];
  if (offering.annual) plans.push(toPlan(offering.annual, 'yearly'));
  if (offering.monthly) plans.push(toPlan(offering.monthly, 'monthly'));
  return plans;
}

/** Starts the store purchase sheet; undefined when the user cancels. */
export async function buy(plan: Plan): Promise<PremiumStatus | undefined> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.ref as PurchasesPackage);
    return toStatus(customerInfo);
  } catch (e) {
    if ((e as { userCancelled?: boolean | null }).userCancelled) return undefined;
    throw new Error('Satın alma tamamlanamadı. Ödeme alınmadı; tekrar deneyebilirsin.');
  }
}

/** Restores a subscription bought on another device or before a reinstall. */
export async function restore(): Promise<PremiumStatus> {
  if (!configured) return NO_PREMIUM;
  return toStatus(await Purchases.restorePurchases());
}

export async function refreshStatus(): Promise<PremiumStatus | undefined> {
  if (!configured) return undefined;
  return toStatus(await Purchases.getCustomerInfo());
}

/** Store page for cancelling or changing the plan. */
export function manageSubscriptionsUrl(status: PremiumStatus): string {
  if (status.managementUrl) return status.managementUrl;
  return Platform.OS === 'android'
    ? 'https://play.google.com/store/account/subscriptions'
    : 'https://apps.apple.com/account/subscriptions';
}
