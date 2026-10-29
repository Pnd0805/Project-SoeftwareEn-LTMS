import { afterEach, expect, it, vi } from 'vitest'
vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: false }))
import { getUserMatchHistory } from './user'
afterEach(() => vi.unstubAllGlobals())
it('reads the delivered RW05 route without dropping withdrawn results', async () => {
  const row = { matchId: 8, withdrawn: true, result: 'win', scoreData: { '3': 2, '4': 1 } };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [row], statsHidden: false }), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(getUserMatchHistory(9)).resolves.toEqual({ items: [row], statsHidden: false });
  expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/users\/9\/match-history$/);
});
