import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', async importOriginal => ({
  ...(await importOriginal<typeof import('./client')>()),
  USE_MOCK: false,
}))

import { getNotifications, markNotificationRead, markNotificationsRead } from './notification'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('notification API in real mode', () => {
  it('reads the C1 page and updates only this account through C1 routes', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [], unreadCount: 0, pagination: { page: 2, pageSize: 20, totalItems: 0, totalPages: 0 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 4, isRead: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ updated: 1, unreadCount: 0 }), { status: 200 }))
    expect((await getNotifications(7, 2, true)).pagination?.page).toBe(2)
    await markNotificationRead(7, 4)
    await markNotificationsRead(7)
    expect(fetchMock.mock.calls.map(call => [String(call[0]), (call[1] as RequestInit).method])).toEqual([
      ['/api/v1/me/notifications?page=2&pageSize=20&unread=true', undefined],
      ['/api/v1/me/notifications/4/read', 'PATCH'],
      ['/api/v1/me/notifications/read-all', 'POST'],
    ])
  })
})
