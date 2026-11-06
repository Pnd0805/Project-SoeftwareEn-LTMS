import { setAccessToken } from '../../api/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SearchPage } from './SearchPage'

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
let client: QueryClient, failTeams: boolean, failPlayers: boolean, pendingTeams: boolean, empty: boolean
beforeEach(() => {
  setAccessToken("test-token")
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
      : path === '/sport-types' ? { items: [{ id: 3, name: 'Badminton' }] }
      : path === '/faculties' ? { items: [{ id: 9, name: 'Engineering' }] }
      : { items: [] }
    return new Response(JSON.stringify(data))
  }))
})
afterEach(() => { client.clear(); vi.unstubAllGlobals() })
const draw = (initial = '/search/Campus') => render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[initial]}><Routes>
  <Route path="/search/:q" element={<SearchPage />} /><Route path="/team/9" element={<div>Team destination</div>} />
  <Route path="/search" element={<SearchPage />} />
  <Route path="/player/8" element={<div>Player destination</div>} />
</Routes></MemoryRouter></QueryClientProvider>)

const tournamentRequests = () => vi.mocked(fetch).mock.calls.map(([url]) => new URL(String(url), 'http://localhost'))
  .filter(url => url.pathname.endsWith('/tournaments'))

it('searches tournaments using filters without requiring a keyword', async () => {
  draw('/search?registration=open')
  expect(await screen.findByText('Campus Cup')).toBeInTheDocument()
  expect(tournamentRequests().at(-1)?.searchParams.get('registration')).toBe('open')
  expect(tournamentRequests().at(-1)?.searchParams.has('q')).toBe(false)
  expect(screen.queryByText('Campus Team')).not.toBeInTheDocument()
})

it('sends the search term to the server and renders its results without filtering the returned page again', async () => {
  draw('/search/ServerQuery')
  await screen.findByText('Campus Cup')
  expect(tournamentRequests().at(-1)?.searchParams.get('q')).toBe('ServerQuery')
})

it('debounces typing and keeps the agreed filter names in server requests', async () => {
  draw(); await screen.findByText('Campus Cup')
  const input = screen.getByRole('searchbox', { name: 'Search terms' })
  fireEvent.change(input, { target: { value: 'New' } })
  fireEvent.change(input, { target: { value: 'New Cup' } })
  expect(tournamentRequests().map(url => url.searchParams.get('q'))).toEqual(['Campus'])
  await waitFor(() => expect(tournamentRequests().at(-1)?.searchParams.get('q')).toBe('New Cup'))
  expect(tournamentRequests().some(url => url.searchParams.get('q') === 'New')).toBe(false)
  fireEvent.change(screen.getByLabelText('Sport'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Organizing faculty'), { target: { value: '9' } })
  fireEvent.change(screen.getByLabelText('Registration'), { target: { value: 'open' } })
  fireEvent.change(screen.getByLabelText('Starts on or after'), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText('Starts on or before'), { target: { value: '2026-11-30' } })
  await waitFor(() => expect(Object.fromEntries(tournamentRequests().at(-1)!.searchParams)).toEqual({
    q: 'New Cup', status: 'public', sportTypeId: '3', facultyId: '9', registration: 'open', startFrom: '2026-11-01', startTo: '2026-11-30',
  }))
})

it('restores filters from the URL and shows date validation beside the invalid field', async () => {
  const original = vi.mocked(fetch).getMockImplementation()!
  vi.mocked(fetch).mockImplementation((...args) => String(args[0]).includes('/tournaments?')
    ? Promise.resolve(new Response(JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: 'Invalid dates', fields: { startFrom: 'Must not be after end date' } } }), { status: 400 }))
    : original(...args))
  draw('/search/Campus?registration=closed&startFrom=2026-11-30&startTo=2026-11-01')
  const message = await screen.findByRole('alert')
  expect(message).toHaveTextContent('Must not be after end date')
  expect(screen.getByLabelText('Starts on or after')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('Starts on or after')).toHaveAccessibleDescription('Must not be after end date')
  expect(screen.getByLabelText('Registration')).toHaveValue('closed')
  expect(screen.queryByText('Unable to load tournaments. Try again.')).not.toBeInTheDocument()
  expect(await screen.findByText('Campus Team')).toBeInTheDocument()
})

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
