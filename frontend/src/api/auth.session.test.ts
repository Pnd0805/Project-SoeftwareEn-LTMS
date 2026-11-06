import { afterEach, expect, it, vi } from 'vitest'
vi.mock('./client', async original => ({ ...await original<typeof import('./client')>(), USE_MOCK: false }))
import { hasAccessToken, setAccessToken } from './client'
import { logout } from './auth'
afterEach(() => { setAccessToken(null); vi.unstubAllGlobals() })
it('finishes local logout when the server has already invalidated the session', async () => {
  setAccessToken('invalidated-token')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: 'Expired' } }), { status: 401 })))
  await expect(logout()).resolves.toBeUndefined()
  expect(hasAccessToken()).toBe(false)
})
it('does not hide an unrelated server failure as a successful logout', async () => {
  setAccessToken('existing-token')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } }), { status: 500 })))
  await expect(logout()).rejects.toMatchObject({ status: 500 })
  expect(hasAccessToken()).toBe(true)
})
