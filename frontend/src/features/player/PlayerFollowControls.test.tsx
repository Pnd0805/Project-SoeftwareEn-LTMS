import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
import { PlayerFollowControls } from './PlayerFollowControls'

let following: boolean
let enabled: boolean
let legacy: boolean
let failure: 'offline' | 'missing' | null
let hold: boolean
let release: (() => void) | undefined
let calls: Array<{ path: string; method: string; body?: unknown }>
const clients: QueryClient[] = []
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function show(playerId = '42', viewerId = 9) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } })
  clients.push(client)
  return render(<QueryClientProvider client={client}><MemoryRouter><PlayerFollowControls key={`${viewerId}:${playerId}`} viewerId={viewerId} playerId={playerId} /></MemoryRouter></QueryClientProvider>)
}
beforeEach(() => {
  following = false; enabled = false; legacy = false; failure = null; hold = false; release = undefined; calls = []
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const path = new URL(String(input), 'http://localhost').pathname.replace('/api/v1', '')
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ path, method, ...(body ? { body } : {}) })
    if (path === '/me/following') return json({ items: following ? [{ id: 42, fullName: 'Player', avatarUrl: null, ...(legacy ? {} : { notifyEnabled: enabled }) }] : [] })
    if (path === '/users/42/follow' && method === 'POST') { following = true; enabled = false; return json({ userId: 42, isFollowing: true, ...(legacy ? {} : { notifyEnabled: false }) }) }
    if (path === '/users/42/follow' && method === 'DELETE') { following = false; enabled = false; return json({ userId: 42, isFollowing: false }) }
    if (path === '/users/42/follow' && method === 'PATCH') {
      if (hold) await new Promise<void>(resolve => { release = resolve })
      if (failure === 'offline') throw new TypeError('Connection lost')
      if (failure === 'missing') { following = false; return json({ error: { code: 'NOT_FOLLOWING', message: 'Follow this player again.' } }, 404) }
      enabled = body.notifyEnabled; return json({ userId: 42, isFollowing: true, notifyEnabled: enabled })
    }
    throw new Error(`Unexpected request: ${method} ${path}`)
  }))
})
afterEach(() => { clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals() })

it('follows with the bell off, explains opt-in, and toggles the server preference both ways', async () => {
  show()
  const follow = await screen.findByRole('button', { name: 'Follow player' })
  await waitFor(() => expect(follow).toBeEnabled())
  expect(screen.queryByRole('button', { name: 'Player notifications' })).not.toBeInTheDocument()
  fireEvent.click(follow)
  const bell = await screen.findByRole('button', { name: 'Player notifications' })
  expect(bell).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('status')).toHaveTextContent('turn on the bell')
  expect(calls.filter(call => call.path === '/me/following')).toHaveLength(1)
  fireEvent.click(bell)
  await waitFor(() => expect(bell).toHaveAttribute('aria-pressed', 'true'))
  expect(screen.getByRole('link', { name: 'notification settings' })).toHaveAttribute('href', '/me')
  fireEvent.click(bell)
  await waitFor(() => expect(bell).toHaveAttribute('aria-pressed', 'false'))
  expect(calls.filter(call => call.method === 'PATCH')).toEqual([
    { path: '/users/42/follow', method: 'PATCH', body: { notifyEnabled: true } },
    { path: '/users/42/follow', method: 'PATCH', body: { notifyEnabled: false } },
  ])
})
it('restores a saved bell and removes it after unfollowing', async () => {
  following = true; enabled = true
  show()
  const bell = await screen.findByRole('button', { name: 'Player notifications' })
  expect(bell).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Following' }))
  await screen.findByRole('button', { name: 'Follow player' })
  expect(screen.queryByRole('button', { name: 'Player notifications' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Follow player' }))
  expect(await screen.findByRole('button', { name: 'Player notifications' })).toHaveAttribute('aria-pressed', 'false')
})
it('disables the unavailable bell without probing an undelivered PATCH route', async () => {
  following = true; legacy = true
  show()
  const bell = await screen.findByRole('button', { name: 'Player notifications' })
  expect(bell).toBeDisabled()
  expect(bell).toHaveTextContent('Notifications unavailable')
  expect(bell).not.toHaveAttribute('aria-pressed')
  expect(screen.getByRole('status')).toHaveTextContent('not available on this server yet')
  fireEvent.click(bell)
  expect(calls.some(call => call.method === 'PATCH')).toBe(false)
})
it('retains the previous preference after failure and allows retry', async () => {
  following = true; failure = 'offline'
  show()
  const bell = await screen.findByRole('button', { name: 'Player notifications' })
  fireEvent.click(bell)
  await screen.findByRole('alert')
  expect(bell).toHaveAttribute('aria-pressed', 'false')
  failure = null
  fireEvent.click(bell)
  await waitFor(() => expect(bell).toHaveAttribute('aria-pressed', 'true'))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('sends only one preference write while pending and locks follow changes too', async () => {
  following = true; hold = true
  show()
  const bell = await screen.findByRole('button', { name: 'Player notifications' })
  fireEvent.click(bell); fireEvent.click(bell)
  await waitFor(() => expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(1))
  expect(screen.getByRole('button', { name: 'Following' })).toBeDisabled()
  await act(async () => { release?.() })
  await waitFor(() => expect(bell).toHaveAttribute('aria-pressed', 'true'))
})
it('recovers from a follow removed elsewhere instead of keeping a stale enabled bell', async () => {
  following = true; failure = 'missing'
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Player notifications' }))
  await screen.findByRole('alert')
  await screen.findByRole('button', { name: 'Follow player' })
  expect(screen.queryByRole('button', { name: 'Player notifications' })).not.toBeInTheDocument()
})
