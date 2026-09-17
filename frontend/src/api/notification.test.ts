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
  it('fails locally instead of calling speculative notification routes', async () => {
    await expect(getNotifications(7)).rejects.toMatchObject({ status: 501, code: 'ENDPOINT_UNAVAILABLE' })
    await expect(markNotificationRead(7, 4)).rejects.toMatchObject({ status: 501, code: 'ENDPOINT_UNAVAILABLE' })
    await expect(markNotificationsRead(7)).rejects.toMatchObject({ status: 501, code: 'ENDPOINT_UNAVAILABLE' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
