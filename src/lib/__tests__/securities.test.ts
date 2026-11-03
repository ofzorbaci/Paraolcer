import { afterEach, describe, expect, it } from 'vitest';

import { holdingValue } from '../returns';
import { feedQuote, setSecurityPrices } from '../securities';
import { staleHoldings } from '../stale';
import type { Holding } from '../types';

const securities = {
  funds: { TTE: { price: 2.5, date: '2026-10-31' } },
  stocks: { THYAO: { price: 310, date: '2026-10-31' } },
  source: 'Sağlayıcı',
};

function holding(over: Partial<Holding>): Holding {
  return { id: 'h', kind: 'fund', name: 'TTE', buyDate: '2026-01-01', quantity: 1000, unitCost: 2, ...over };
}

afterEach(() => setSecurityPrices(undefined));

describe('feed prices for funds and stocks', () => {
  it('matches a holding by its code and kind', () => {
    expect(feedQuote(holding({}), securities)).toEqual({ price: 2.5, date: '2026-10-31', source: 'Sağlayıcı' });
    expect(feedQuote(holding({ kind: 'stock', name: 'thyao' }), securities)?.price).toBe(310);
    // A stock ticker is not looked up among funds, and other kinds never are.
    expect(feedQuote(holding({ name: 'THYAO' }), securities)).toBeUndefined();
    expect(feedQuote(holding({ kind: 'other', name: 'TTE' }), securities)).toBeUndefined();
    expect(feedQuote(holding({ name: 'Emeklilik fonum' }), securities)).toBeUndefined();
  });

  it('prices from the feed first, the hand-entered price otherwise', () => {
    setSecurityPrices(securities);
    expect(holdingValue(holding({ currentPrice: 9 }), '2026-11-03', {})).toBe(2500);
    expect(holdingValue(holding({ name: 'XYZ', currentPrice: 3 }), '2026-11-03', {})).toBe(3000);
    expect(holdingValue(holding({ name: 'XYZ' }), '2026-11-03', {})).toBeUndefined();
  });

  it('never asks to update a price the feed provides', () => {
    setSecurityPrices(securities);
    const old = '2026-09-01T10:00:00Z';
    const list = [holding({ priceUpdatedAt: old }), holding({ id: 'x', name: 'XYZ', priceUpdatedAt: old })];
    expect(staleHoldings(list, new Date('2026-11-03')).map((h) => h.id)).toEqual(['x']);
  });
});
