// Real return in dollars: what the holding is worth in USD today against what it cost in USD,
// deflated by US inflation. A dollar kept under the mattress loses here too.

import { monthOf } from './cpi';
import type { Feed } from './feed-types';
import { valueAt } from './renew';
import type { HoldingAnalysis } from './returns';
import type { Holding, LivePrices } from './types';

export function usdReal(
  h: Holding,
  a: Pick<HoldingAnalysis, 'cost' | 'value'>,
  prices: LivePrices,
  feed: Pick<Feed, 'markets' | 'usCpi'>,
): number | undefined {
  const usdNow = prices.usd;
  const cpi = feed.usCpi?.rows;
  if (a.value === undefined || !usdNow || !cpi?.length || a.cost <= 0) return undefined;
  const buyMonth = monthOf(h.buyDate);
  // A dollar holding's cost in dollars is exact; anything else is converted at the buy month's rate.
  const usdThen = h.kind === 'usd' ? undefined : feed.markets && valueAt(feed.markets.usdTry, buyMonth);
  const costUsd = h.kind === 'usd' ? h.quantity : usdThen ? a.cost / usdThen : undefined;
  if (!costUsd) return undefined;
  const cpiThen = valueAt(cpi, buyMonth) ?? cpi[0].value;
  const cpiNow = cpi[cpi.length - 1].value;
  return a.value / usdNow / costUsd / (cpiNow / cpiThen) - 1;
}
