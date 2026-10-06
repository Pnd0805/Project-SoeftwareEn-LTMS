import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ me: vi.fn(), logout: vi.fn() }))
vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), USE_MOCK: false }))
vi.mock('../api/user', () => ({ getMe: state.me }))
vi.mock('../api/auth', () => ({ logout: state.logout }))
import { ApiError, hasAccessToken, setAccessToken } from '../api/client'
import { useLogout, useMe } from './useAuth'
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}
afterEach(() => { setAccessToken(null); vi.clearAllMocks() })
it('resolves guest identity without sending an authenticated /me request', async () => {
  setAccessToken(null)
  const { wrapper } = setup()
  const hook = renderHook(useMe, { wrapper })
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
  expect(hook.result.current.data).toBeNull()
  expect(state.me).not.toHaveBeenCalled()
})
it('still verifies stored tokens with the server and clears all personal caches on logout', async () => {
  setAccessToken('existing-session')
  state.me.mockResolvedValue({ id: 9 })
  state.logout.mockResolvedValue(undefined)
  const { client, wrapper } = setup()
  const hook = renderHook(() => ({ me: useMe(), logout: useLogout() }), { wrapper })
  await waitFor(() => expect(hook.result.current.me.data?.id).toBe(9))
  client.setQueryData(['myJoinRequests'], { items: [{ id: 1 }] })
  client.setQueryData(['notificationPreferences'], { private: 'personal settings' })
  await act(() => hook.result.current.logout.mutateAsync())
  expect(client.getQueryData(['myJoinRequests'])).toBeUndefined()
  expect(client.getQueryData(['notificationPreferences'])).toBeUndefined()
})

it('treats a token-version 401 as an expired session rather than retaining the previous identity', async () => {
 setAccessToken('invalidated-session')
 state.me.mockRejectedValue(new ApiError(401, { code: 'TOKEN_EXPIRED', message: 'Expired' }))
 const { wrapper } = setup()
 const hook = renderHook(useMe, { wrapper })
 await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
 expect(hook.result.current.data).toBeNull()
 expect(hasAccessToken()).toBe(false)
})
