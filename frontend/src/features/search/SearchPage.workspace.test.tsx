import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SearchPage } from './SearchPage'

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
let client: QueryClient, failTeams: boolean, failPlayers: boolean, pendingTeams: boolean, empty: boolean
beforeEach(() => {
  failTeams = failPlayers = pendingTeams = empty = false
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = new URL(url, 'http://localhost').pathname.replace('/api/v1', '')
    if (path === '/teams' && pendingTeams) return new Promise<Response>(() => {})
    if (path === '/teams' && failTeams) return new Response(JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Teams unavailable' } }), { status: 501 })
    if (path === '/users/search' && failPlayers) return new Response(JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Players unavailable' } }), { status: 501 })
    const data = path === '/me' ? { id: 7, fullName: 'Player', userType: 'student' }
      : path === '/users/search' ? { items: empty ? [] : [{ id: 8, fullName: 'Campus Player', avatarUrl: null }] }
      : path === '/teams' ? { items: empty ? [] : [{ id: 9, name: 'Campus Team', sportTypeId: 1, readinessStatus: 'Ready', memberCount: 4, logoUrl: null }] }
      : path === '/tournaments' ? { items: empty ? [] : [{ id: 42, name: 'Campus Cup', sportTypeId: 999, bracketFormat: 'single_elimination', status: 'public', eventStartDate: '2099-10-01', maxTeams: 8 }] }
      : { items: [] }
    return new Response(JSON.stringify(data))
  }))
})
afterEach(() => { client.clear(); vi.unstubAllGlobals() })
const draw = () => render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/search/Campus']}><Routes>
  <Route path="/search/:q" element={<SearchPage />} /><Route path="/team/9" element={<div>Team destination</div>} />
  <Route path="/player/8" element={<div>Player destination</div>} />
</Routes></MemoryRouter></QueryClientProvider>)

it('filters by counted categories and restores all results without changing the query', async () => {
  draw()
  const players = await screen.findByRole('button', { name: 'Players 1' })
  expect(screen.getByRole('button', { name: 'All 3' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(players)
  expect(players).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Campus Player')).toBeInTheDocument()
  expect(screen.queryByText('Campus Cup')).not.toBeInTheDocument()
  expect(screen.queryByText('Campus Team')).not.toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Search terms' })).toHaveValue('Campus')
  fireEvent.click(screen.getByRole('button', { name: 'Teams 1' }))
  expect(screen.getByText('Campus Team')).toBeInTheDocument()
  expect(screen.queryByText('Campus Player')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'All 3' }))
  expect(screen.getByText('Campus Cup')).toBeInTheDocument()
  expect(screen.getByText('Campus Player')).toBeInTheDocument()
})

it('keeps tournaments reachable when players fail and retries that source in its selected category', async () => {
  failPlayers = true; draw()
  const retry = await screen.findByRole('button', { name: 'Retry players' })
  expect(screen.getByText('Campus Cup')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Players 0' }))
  expect(screen.queryByText(/Nothing matched|No players found/)).not.toBeInTheDocument()
  expect(retry).toBeEnabled()
  failPlayers = false; fireEvent.click(retry)
  await screen.findByText('Campus Player')
  expect(screen.getByRole('button', { name: 'Players 1' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Tournaments 1' }))
  expect(screen.getByText('Campus Cup')).toBeInTheDocument()
})

it('describes unresolved sports without presenting technical IDs as names', async () => {
  draw(); await screen.findByText('Campus Team')
  expect(screen.getAllByText(/Sport unavailable/)).toHaveLength(2)
  expect(screen.queryByText(/Sport #1|Sport 999/)).not.toBeInTheDocument()
})

it('keeps available players and the query when a team source fails, then recovers', async () => {
  failTeams = true; draw()
  await screen.findByRole('button', { name: 'Retry teams' })
  expect(await screen.findByText('Campus Player')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Search terms' })).toHaveValue('Campus')
  expect(screen.queryByText(/Nothing matched/)).not.toBeInTheDocument()
  failTeams = false; fireEvent.click(screen.getByRole('button', { name: 'Retry teams' }))
  await screen.findByText('Campus Team')
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry teams' })).not.toBeInTheDocument())
})

it('does not show an empty result while a public source is still loading', async () => {
  empty = pendingTeams = true; draw()
  await screen.findByText('Searching teams…')
  expect(screen.queryByText(/Nothing matched/)).not.toBeInTheDocument()
})

it('shows no matches only after every applicable source succeeds', async () => {
  empty = true; draw()
  expect(await screen.findByText('Nothing matched “Campus”')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each([['Open team: Campus Team', 'Team destination'], ['Open player: Campus Player', 'Player destination']])('preserves the existing destination for %s', async (name, destination) => {
  draw(); fireEvent.click(await screen.findByRole('button', { name }))
  expect(screen.getByText(destination)).toBeInTheDocument()
})
