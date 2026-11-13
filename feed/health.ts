// When a broken source should fail the job (and e-mail the owner).
//
// Official sites go down for minutes at a time (TCMB EVDS answered 503 on 2026-11-13). A section that
// fails keeps its previous value, so a short outage costs nothing; failing the job for it only sends
// a false alarm. A section is reported only once it has kept failing for `graceHours`.

/** "Mevduat faizi: EVDS → HTTP 503" → "Mevduat faizi" */
export function errorKey(message: string): string {
  const i = message.indexOf(':');
  return (i > 0 ? message.slice(0, i) : message).trim();
}

export function persistentErrors(
  errors: string[],
  previousSince: Record<string, string> | undefined,
  now: string,
  graceHours = 24,
): { since: Record<string, string>; persistent: string[] } {
  const since: Record<string, string> = {};
  const persistent: string[] = [];
  for (const message of errors) {
    const key = errorKey(message);
    const first = previousSince?.[key] ?? now;
    since[key] = first;
    if (Date.parse(now) - Date.parse(first) >= graceHours * 3_600_000) persistent.push(message);
  }
  return { since, persistent };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with two retries on network errors, 5xx and 429 (5 s, then 15 s apart). */
export async function fetchRetry(url: string, init?: RequestInit, waits = [5_000, 15_000]): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt <= waits.length; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 && res.status !== 429) return res;
      last = new Error(`HTTP ${res.status}`);
      if (attempt === waits.length) return res;
    } catch (e) {
      last = e;
      if (attempt === waits.length) throw e;
    }
    await sleep(waits[attempt]);
  }
  throw last;
}
