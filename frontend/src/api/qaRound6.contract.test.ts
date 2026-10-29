import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: false }))
import { inviteMember, answerBackendInvitation } from './team'
import { requestToJoin } from './qaFeatures'
import { submitRefereeIdentityDocs } from './admin'
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())

const operations = [
  { path: '/teams/42/invitations', call: () => inviteMember(42, { userId: 99 }) },
  { path: '/invitations/51/accept', call: () => answerBackendInvitation(51, true) },
  { path: '/teams/42/join-requests', call: () => requestToJoin(42, 'Please admit me') },
]
describe.each(operations)('Round 6 $path', ({ path, call }) => {
  it.each(['pending', 'accepted', 'organizer'])('preserves flat %s role metadata from the API error envelope', async status => {
    const metadata = { tournamentId: 7, role: status === 'organizer' ? 'organizer' : 'referee', invitationStatus: status === 'organizer' ? null : status, expiresAt: status === 'pending' ? '2026-10-15T09:00:00Z' : null }
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'TEAM_CONFLICT_OF_INTEREST', message: 'Unrelated text', ...metadata } }), { status: 409 }))
    await expect(call()).rejects.toMatchObject({ code: 'TEAM_CONFLICT_OF_INTEREST', status: 409, extra: metadata })
    expect(fetchMock.mock.calls[0][0]).toContain(path)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })
})
it('submits the API-returned identity key unchanged and preserves the rejected objectKeys metadata', async () => {
  const key = 'referee_identity/9053/00000000-0000-4000-8000-000000009053.jpg'
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'REFEREE_IDENTITY_KEY_INVALID', message: 'Invalid key', objectKeys: [key] } }), { status: 422 }))
  await expect(submitRefereeIdentityDocs([key])).rejects.toMatchObject({ code: 'REFEREE_IDENTITY_KEY_INVALID', status: 422, extra: { objectKeys: [key] } })
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ docs: [key] })
})
