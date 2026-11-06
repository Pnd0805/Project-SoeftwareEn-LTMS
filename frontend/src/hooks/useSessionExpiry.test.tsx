import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../api/client', async original => ({ ...await original<typeof import('../api/client')>(), USE_MOCK: false }))
import { apiFetch, hasAccessToken, setAccessToken } from '../api/client'
import { useMe } from './useAuth'
import { useSessionExpiry } from './useSessionExpiry'

afterEach(() => { setAccessToken(null); vi.unstubAllGlobals() })
it('clears private cache and sends a protected view to login after a non-me request receives 401', async () => {
  setAccessToken('revoked-on-another-device')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['me'], { id: 7, fullName: 'Previous account' })
  client.setQueryData(['notifications', 7], { items: ['private content'] })
  function Session() {
    useSessionExpiry()
    const me = useMe()
    return <Routes><Route path="/private" element={me.data ? <p>Private view</p> : <Navigate to="/login" replace />} /><Route path="/login" element={<p>Sign in again</p>} /></Routes>
  }
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/private']}><Session /></MemoryRouter></QueryClientProvider>)
  expect(screen.getByText('Private view')).toBeInTheDocument()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: 'Expired' } }), { status: 401 })))
  await act(async () => { await expect(apiFetch('/notifications')).rejects.toMatchObject({ status: 401 }) })
  expect(await screen.findByText('Sign in again')).toBeInTheDocument()
  expect(hasAccessToken()).toBe(false)
  expect(client.getQueryData(['notifications', 7])).toBeUndefined()
  client.clear()
})
