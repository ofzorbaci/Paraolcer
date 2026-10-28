// Exchange rates from Frankfurter (European Central Bank reference rates, no key needed).
// Weekends and holidays resolve to the previous business day.

const BASE = 'https://api.frankfurter.dev/v1';

export type Currency = 'usd' | 'eur';

const cache = new Map<string, number>();

/** TRY per 1 unit of `currency` on `date` ('YYYY-MM-DD' or 'latest'). */
export async function fetchTryRate(currency: Currency, date: string): Promise<number> {
  const key = `${currency}:${date}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const res = await fetch(`${BASE}/${date}?base=${currency.toUpperCase()}&symbols=TRY`);
  if (!res.ok) throw new Error(`Kur alınamadı (${res.status})`);
  const body = (await res.json()) as { rates?: { TRY?: number } };
  const rate = body.rates?.TRY;
  if (typeof rate !== 'number' || !(rate > 0)) throw new Error('Kur yanıtı geçersiz');

  cache.set(key, rate);
  return rate;
}

/** What `amountTry` invested on `fromDate` in `currency` would be worth today, in TRY. */
export async function currencyBenchmark(currency: Currency, amountTry: number, fromDate: string): Promise<number> {
  const [then, now] = await Promise.all([fetchTryRate(currency, fromDate), fetchTryRate(currency, 'latest')]);
  return (amountTry / then) * now;
}
