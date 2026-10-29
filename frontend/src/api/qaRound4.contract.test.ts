import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: false }))
import { previewAmendment } from './tournament'
import { getRemovedFeedback } from './liveEngagement'
import { getTournamentReferees } from './admin'
import { getStandings } from './match'
const fetchMock = vi.fn()
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())

it('previews the exact amendment schema through the delivered read-only POST route', async () => {
  const reply = { canSubmit: false, blockers: [{ code: 'BLOCKED', message: 'Blocked', details: null }], pendingAmendmentId: 51 }
  fetchMock.mockResolvedValue(json(reply))
  expect(await previewAmendment(23, { changes: { minAge: 18 }, reason: '  Eligibility change  ' })).toEqual(reply)
  expect(fetchMock.mock.calls[0][0]).toContain('/tournaments/23/amendment-requests/preview')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ requestedChanges: { minAge: 18 }, reason: 'Eligibility change' })
  expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  expect(fetchMock).toHaveBeenCalledOnce()
})
it('reads removed feedback with server pagination and restoration capability', async () => {
  const reply = { items: [{ id: 42, canRestore: false, removalReason: 'Spam', removedByRole: 'organizer' }], pagination: { page: 2, pageSize: 20, totalPages: 3, totalItems: 51 } }
  fetchMock.mockResolvedValue(json(reply))
  expect(await getRemovedFeedback(2)).toEqual(reply)
  expect(fetchMock.mock.calls[0][0]).toContain('/admin/feedback/removed?page=2&pageSize=20')
})
it('preserves computed expired status while stored invitationStatus remains pending', async () => {
  fetchMock.mockResolvedValue(json({ items: [{ id: 31, user: { id: 3, fullName: 'Referee', avatarUrl: null }, invitationStatus: 'pending', status: 'expired', isExternal: false, externalApprovalStatus: 'not_required' }], acceptedCount: 0, awaitingAdminCount: 0 }))
  const reply = await getTournamentReferees(23)
  expect(reply.items[0]).toMatchObject({ status: 'expired', invitationStatus: 'pending', isActive: false })
  expect(reply.acceptedCount).toBe(0)
})
it('keeps delivered elimination labels and nulls without altering shared ranks or order', async () => {
  const teamRow = (id: number, outLabel: string | null) => ({ team: { id, name: `Team ${id}`, sportTypeId: 1 }, rank: 5, played: 2, wins: 1, losses: 1, points: 3, goalsFor: 2, goalsAgainst: 2, goalDiff: 0, outLabel })
  fetchMock.mockResolvedValueOnce(json({ items: [teamRow(8, 'ตกรอบ 8 ทีมสุดท้าย'), teamRow(3, null)] })).mockResolvedValueOnce(json({ bracketFormat: 'single_elimination' }))
  const reply = await getStandings(23)
  expect(reply?.rows.map(row => ({ id: row.team.id, rank: row.rank, label: row.outLabel }))).toEqual([{ id: 8, rank: 5, label: 'ตกรอบ 8 ทีมสุดท้าย' }, { id: 3, rank: 5, label: null }])
})
