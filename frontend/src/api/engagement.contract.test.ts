import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: false }))
import { follow, unfollow, getFollows, setFollowNotifications } from './engagement'
import { getUserCareer } from './user'
import { getLeaderTransfers, reviewLeaderTransfer } from './admin'
const request = vi.fn<typeof fetch>(); const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
beforeEach(() => { request.mockReset(); vi.stubGlobal('fetch', request) }); afterEach(() => vi.unstubAllGlobals())
it('reads player IDs from the authenticated following list', async () => {
 request.mockResolvedValueOnce(json({ items: [{ id: 42, fullName: 'Player', avatarUrl: null }], count: 1 }))
 expect(await getFollows(9)).toMatchObject({ targets: ['player:42'] })
 expect(request.mock.calls[0][0]).toBe('/api/v1/me/following')
})
it('preserves delivered notification preferences and sends the exact PATCH contract', async () => {
 request.mockResolvedValueOnce(json({ items: [{ id: 42, fullName: 'Player', avatarUrl: null, notifyEnabled: false }] }))
 const current = await getFollows(9)
 expect(current.notifications).toEqual({ 'player:42': false })
 request.mockResolvedValueOnce(json({ userId: 42, isFollowing: true, notifyEnabled: true }))
 await expect(setFollowNotifications(9, 'player:42', true, current)).resolves.toMatchObject({ notifyEnabled: true })
 expect(request.mock.calls[1]).toEqual(['/api/v1/users/42/follow', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ notifyEnabled: true }) })])
})
it('does not send a PATCH for an unfollowed player or a server without notification fields', async () => {
 await expect(setFollowNotifications(9, 'player:42', true, { targets: [] })).rejects.toMatchObject({ code: 'NOT_FOLLOWING' })
 await expect(setFollowNotifications(9, 'player:42', true, { targets: ['player:42'] })).rejects.toMatchObject({ status: 501, code: 'ENDPOINT_UNAVAILABLE' })
 expect(request).not.toHaveBeenCalled()
})
it('does not confirm an incomplete or unrelated successful PATCH response', async () => {
 const current = { targets: ['player:42'], notifications: { 'player:42': false } }
 request.mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({ userId: 99, isFollowing: true, notifyEnabled: true }))
 await expect(setFollowNotifications(9, 'player:42', true, current)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
 await expect(setFollowNotifications(9, 'player:42', true, current)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('follows and unfollows real numeric users then refreshes the list', async () => {
 request.mockImplementation(async url => json(String(url).includes('/me/following') ? { items: [] } : {}))
 await follow(9, 'player:42'); await unfollow(9, 'player:42')
 expect(request.mock.calls[0]).toEqual(['/api/v1/users/42/follow', expect.objectContaining({ method: 'POST' })])
 expect(request.mock.calls[2]).toEqual(['/api/v1/users/42/follow', expect.objectContaining({ method: 'DELETE' })])
 request.mockClear(); await expect(follow(9, 'team:3')).rejects.toMatchObject({ status: 501 }); expect(request).not.toHaveBeenCalled()
})
it('reads delivered tournament career data', async () => {
 request.mockResolvedValueOnce(json({ items: [] })); await getUserCareer(42)
 expect(request.mock.calls[0][0]).toBe('/api/v1/users/42/career')
})
it('uses the separate transfer queue and decisions with rejection reasons', async () => {
 request.mockResolvedValueOnce(json({ items: [], pagination: { totalPages: 0 } })).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({}))
 await getLeaderTransfers(); await reviewLeaderTransfer(88, true); await reviewLeaderTransfer(89, false, 'Not eligible')
 expect(request.mock.calls[1]).toEqual(['/api/v1/admin/team-requests/88/approve-transfer', expect.objectContaining({ method: 'POST' })])
 expect(request.mock.calls[2]).toEqual(['/api/v1/admin/team-requests/89/reject-transfer', expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'Not eligible' }) })])
})
