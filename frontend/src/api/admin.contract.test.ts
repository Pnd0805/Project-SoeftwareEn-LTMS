import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: false }))
import { getAdminScopes, getUsersForAdmin, getAuditLogs, getAmendmentImpact } from './admin'
import { deleteTournament } from './tournament'
const request = vi.fn<typeof fetch>()
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 })
beforeEach(() => { request.mockReset(); vi.stubGlobal('fetch', request) })
afterEach(() => vi.unstubAllGlobals())
it('reads the request-specific impact and propagates a forbidden response', async () => {
  const impact = { requestId: 7, tournamentId: 22, status: 'approved', canApprove: false, alreadyDecided: true, blockers: [] }
  request.mockResolvedValueOnce(json(impact))
  expect(await getAmendmentImpact(7)).toEqual(impact)
  expect(request.mock.calls[0][0]).toBe('/api/v1/admin/amendment-requests/7/impact')
  request.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'INSUFFICIENT_ADMIN_SCOPE', message: 'Wrong faculty' } }), { status: 403 }))
  await expect(getAmendmentImpact(7)).rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' })
})
it('keeps all server pages before searching users locally', async () => {
 const row = { id: 1, fullName: 'Player', email: 'p@test', userType: 'student', facultyId: 1, isSuspended: false, suspendedReason: null, suspendedUntil: null, suspendedCategoryLabel: null, adminScope: null }
 request.mockResolvedValueOnce(json({ items: [row], pagination: { totalPages: 2 } })).mockResolvedValueOnce(json({ items: [{ ...row, id: 2 }], pagination: { totalPages: 2 } }))
 expect((await getUsersForAdmin()).items.map(x => x.user.id)).toEqual([1, 2])
 expect(String(request.mock.calls[1][0])).toContain('page=2')
})
it('maps Root scopes without inventing faculty or creator names', async () => {
 request.mockResolvedValueOnce(json({ items: [{ id: 2, user: { id: 9099, fullName: 'Root', avatarUrl: null }, scopeType: 'root', facultyId: null, createdAt: '2026-10-01' }], pagination: { totalPages: 1 } }))
 expect((await getAdminScopes()).items[0]).toMatchObject({ scopeType: 'root', facultyName: null, createdBy: null })
})
it('maps audit actors and respects the requested display limit', async () => {
 request.mockResolvedValueOnce(json({ items: [{ id: 1, actor: { id: 9, fullName: 'Admin' }, actionType: 'user_suspended', entityType: 'user', entityId: 7, details: { category: 'spam' }, createdAt: '2026-10-01' }], pagination: { totalPages: 2 } }))
 expect((await getAuditLogs({ userId: 9, limit: 1 })).items[0].user).toEqual({ id: 9, fullName: 'Admin', avatarUrl: null })
 expect(request).toHaveBeenCalledTimes(1)
 expect(String(request.mock.calls[0][0])).toContain('userId=9')
})
it('uses the delivered delete route and surfaces activity conflicts', async () => {
 request.mockResolvedValueOnce(new Response(null, { status: 204 }))
 await deleteTournament(23)
 expect(request.mock.calls[0]).toEqual(['/api/v1/tournaments/23', expect.objectContaining({ method: 'DELETE' })])
 request.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'TOURNAMENT_HAS_ACTIVITY', message: 'Applications exist' } }), { status: 409 }))
 await expect(deleteTournament(23)).rejects.toMatchObject({ status: 409, code: 'TOURNAMENT_HAS_ACTIVITY' })
})

it('reads exactly the requested audit page so history beyond the latest 100 remains accessible', async () => {
  const pagination = { page: 6, pageSize: 20, totalItems: 145, totalPages: 8 }
  request.mockResolvedValueOnce(json({ items: [{ id: 102, actor: { id: 9, fullName: 'Admin' }, actionType: 'user_suspended', entityType: 'user', entityId: 7, details: null, createdAt: '2026-10-01' }], pagination }))
  expect(await getAuditLogs({ page: 6 })).toMatchObject({ items: [{ id: 102, user: { id: 9, fullName: 'Admin' } }], pagination })
  expect(request).toHaveBeenCalledTimes(1)
  expect(String(request.mock.calls[0][0])).toContain('page=6&pageSize=20')
})
