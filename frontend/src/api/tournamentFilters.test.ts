import { afterEach, expect, it, vi } from 'vitest'
vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: false }))
import { getTournaments } from './tournament'
import { tournamentKeys } from '../hooks/useTournament'

afterEach(() => vi.unstubAllGlobals())
it('uses one cache key for absent, whitespace and cleared search/date filters', () => {
  expect(tournamentKeys.list({ q: '  ', startFrom: '', startTo: undefined })).toEqual(tournamentKeys.list())
  expect(tournamentKeys.list({ q: ' Cup ' })).toEqual(tournamentKeys.list({ q: 'Cup' }))
  expect(tournamentKeys.list({ facultyId: 9 })).not.toEqual(tournamentKeys.list({ facultyId: 8 }))
})
it('sends all supported filters, trims search text, and omits empty values', async () => {
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] })))
  vi.stubGlobal('fetch', request)
  await getTournaments({ q: ' Cup ', status: 'public', sportTypeId: 3, facultyId: 9, registration: 'closed', startFrom: '2026-11-01', startTo: '' })
  const url = new URL(request.mock.calls[0][0], 'http://localhost')
  expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'Cup', status: 'public', sportTypeId: '3', facultyId: '9', registration: 'closed', startFrom: '2026-11-01' })
})
