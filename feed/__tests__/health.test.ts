import { describe, expect, it, vi } from 'vitest';

import { errorKey, fetchRetry, persistentErrors } from '../health';

describe('which source errors fail the job', () => {
  it('ignores a short outage and reports one that lasts a day', () => {
    const errors = ['Mevduat faizi: EVDS → HTTP 503', 'Stopaj: tablo 30 gün içinde geçersiz olacak'];
    const first = persistentErrors(errors, undefined, '2026-11-13T22:30:00Z');
    expect(first.persistent).toEqual([]);
    expect(first.since).toEqual({ 'Mevduat faizi': '2026-11-13T22:30:00Z', Stopaj: '2026-11-13T22:30:00Z' });

    // Next morning EVDS is back; the withholding warning is still there 24 h later.
    const later = persistentErrors(['Stopaj: tablo 30 gün içinde geçersiz olacak'], first.since, '2026-11-14T22:30:00Z');
    expect(later.persistent).toEqual(['Stopaj: tablo 30 gün içinde geçersiz olacak']);
    expect(Object.keys(later.since)).toEqual(['Stopaj']);
  });

  it('starts the clock again once a section recovers', () => {
    const since = persistentErrors(['BIST 100: EVDS → HTTP 503'], { 'BIST 100': '2026-11-01T00:00:00Z' }, '2026-11-14T00:00:00Z').since;
    expect(since['BIST 100']).toBe('2026-11-01T00:00:00Z');
    expect(persistentErrors([], since, '2026-11-14T06:00:00Z').since).toEqual({});
    expect(errorKey('TÜFE grupları: EVDS → HTTP 503')).toBe('TÜFE grupları');
  });
});

describe('retrying a flaky source', () => {
  it('retries 503 and returns the first good answer', async () => {
    const responses = [new Response('', { status: 503 }), new Response('ok', { status: 200 })];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => responses.shift()!);
    const res = await fetchRetry('https://example.test', undefined, [0, 0]);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('does not retry a 404', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 404 }));
    const res = await fetchRetry('https://example.test', undefined, [0, 0]);
    expect(res.status).toBe(404);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
