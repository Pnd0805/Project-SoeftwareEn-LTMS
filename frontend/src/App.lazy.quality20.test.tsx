import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { lazy, Suspense, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  signedIn: true, guest: false, authLoading: false, admin: true,
  gate: Promise.resolve(), release: () => {}, failure: null as Error | null,
  loads: vi.fn(), renderFailure: false,
}))
vi.mock('react', async original => {
  const react = await original<typeof import('react')>()
  return { ...react, lazy: (load: () => Promise<{ default: React.ComponentType }>) => react.lazy(() => {
    const { gate, failure } = state
    state.loads()
    return gate.then(() => { if (failure) throw failure; return load() })
  }) }
})
vi.mock('./shared/store', () => ({ useLtms: () => ({}) }))
vi.mock('./shared/selectors', () => ({ isGuest: () => state.guest }))
vi.mock('./hooks/useAuth', () => ({ useMe: () => ({ data: state.signedIn ? { id: 9 } : null, isLoading: state.authLoading }) }))
vi.mock('./components/layout/Shell', () => ({ Shell: ({ children }: { children: React.ReactNode }) => <>
  <nav aria-label="Shell"><Link to="/">Home</Link><Link to="/request">Request</Link><Link to="/m/13">Match</Link></nav>
  <main>{children}</main>
</> }))
vi.mock('./components/kit/Toasts', () => ({ Toasts: () => null }))
vi.mock('./features/home/HomePage', () => ({ HomePage: () => {
  const [filter, setFilter] = useState('')
  return <><h1>Home fixture</h1><input aria-label="Home filter" value={filter} onChange={event => setFilter(event.target.value)} />
    <Link to="/home/all">All category fixture</Link></>
} }))
vi.mock('./features/auth/LoginPage', () => ({ LoginPage: () => <h1>Login fixture</h1> }))
vi.mock('./features/auth/RegisterPage', () => ({ RegisterPage: () => <h1>Register fixture</h1> }))
vi.mock('./features/admin/AdminPage', () => ({ AdminPage: () => <h1>{state.admin ? 'Admin fixture' : 'Access denied'}</h1> }))
vi.mock('./features/request/RequestPage', () => ({ RequestPage: () => <h1>Request fixture</h1> }))
vi.mock('./features/match/MatchPage', () => ({ MatchPage: () => {
  const [draft, setDraft] = useState('')
  return <><h1>Match fixture</h1><input aria-label="Result draft" value={draft} onChange={event => setDraft(event.target.value)} />
    <Link to="/m/13/progress">Progress fixture</Link></>
} }))
vi.mock('./features/match/FixturePage', () => ({ FixturePage: () => <h1>Fixture fixture</h1> }))
vi.mock('./features/tournament/TournamentPage', () => ({ TournamentPage: () => <h1>Tournament fixture</h1> }))
vi.mock('./features/checkin/CheckinPage', () => ({ CheckinPage: () => <h1>Checkin fixture</h1> }))
vi.mock('./features/mvp/MvpPage', () => ({ MvpPage: () => <h1>MVP fixture</h1> }))
vi.mock('./features/team/TeamPage', () => ({ TeamPage: () => {
  if (state.renderFailure) throw new Error('Fixture render failure')
  return <h1>Team fixture</h1>
} }))
vi.mock('./features/player/PlayerPage', () => ({ PlayerPage: () => <h1>Player fixture</h1> }))
vi.mock('./features/watch/WatchPage', () => ({ WatchPage: () => <h1>Watch fixture</h1> }))
vi.mock('./features/team/TeamsPage', () => ({ TeamsPage: () => <h1>Teams fixture</h1> }))
vi.mock('./features/matches/MatchesPage', () => ({ MatchesPage: () => <h1>Matches fixture</h1> }))
vi.mock('./features/inbox/InboxPage', () => ({ InboxPage: () => <h1>Inbox fixture</h1> }))
vi.mock('./features/profile/ProfilePage', () => ({ ProfilePage: () => <h1>Profile fixture</h1> }))
vi.mock('./features/search/SearchPage', () => ({ SearchPage: () => <h1>Search fixture</h1> }))

import App from './App'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
function page(route: string) { return render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>) }
async function loaded() { await act(async () => state.release()) }
beforeEach(() => {
  state.signedIn = true; state.guest = false; state.authLoading = false; state.admin = true
  state.failure = null; state.renderFailure = false; state.loads.mockClear()
  state.gate = new Promise<void>(resolve => { state.release = resolve })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('route loading with existing permission boundaries', () => {
  it.each(['/admin', '/admin/users', '/request', '/teams', '/matches', '/inbox', '/me'])('redirects anonymous visitors from %s before loading route code', route => {
    state.signedIn = false; page(route)
    expect(screen.getByRole('heading', { name: 'Login fixture' })).toBeInTheDocument()
    expect(state.loads).not.toHaveBeenCalled()
  })
  it('keeps guest continuation from bypassing the private route check', () => {
    state.signedIn = false; state.guest = true; page('/admin')
    expect(screen.getByRole('heading', { name: 'Login fixture' })).toBeInTheDocument()
    expect(state.loads).not.toHaveBeenCalled()
  })
  it('does not load a route while the signed-in identity is unresolved', () => {
    state.authLoading = true; page('/request')
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
    expect(state.loads).not.toHaveBeenCalled()
  })
  it.each([
    ['/admin', 'Loading admin', 'Admin fixture'],
    ['/request', 'Loading tournament request', 'Request fixture'],
    ['/m/13', 'Loading match', 'Match fixture'],
  ])('announces %s loading inside the shell before showing its current heading', async (route, label, heading) => {
    page(route)
    expect(within(screen.getByRole('main')).getByRole('status')).toHaveTextContent(label)
    expect(screen.getByRole('navigation', { name: 'Shell' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument()
    await loaded()
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('preserves navigation and named loading when entering an organizer route from Home', async () => {
    page('/')
    fireEvent.click(screen.getByRole('link', { name: 'Request' }))
    await loaded()
    expect(await screen.findByRole('heading', { name: 'Request fixture' })).toBeInTheDocument()
  })
  it('retains the current match draft when its existing route tabs change', async () => {
    page('/m/13'); await loaded()
    fireEvent.change(await screen.findByLabelText('Result draft'), { target: { value: 'Retain this result' } })
    fireEvent.click(screen.getByRole('link', { name: 'Progress fixture' }))
    expect(await screen.findByLabelText('Result draft')).toHaveValue('Retain this result')
  })
  it('retains Home filters when navigating from root into a Home category', async () => {
    page('/')
    fireEvent.change(screen.getByLabelText('Home filter'), { target: { value: 'Faculty cup' } })
    fireEvent.click(screen.getByRole('link', { name: 'All category fixture' }))
    expect(await screen.findByLabelText('Home filter')).toHaveValue('Faculty cup')
  })
})

describe('cached chunk rejection recovery', () => {
  it('offers document reload for a rejected lazy module instead of repeating its cached rejection', async () => {
    const load = vi.fn().mockRejectedValue(new TypeError('Failed to fetch dynamically imported module: /assets/missing.js'))
    const FailedChunk = lazy(load)
    render(<ErrorBoundary label="This page"><Suspense fallback={<p>Pending chunk</p>}><FailedChunk /></Suspense></ErrorBoundary>)
    await loaded()
    const retry = screen.queryByRole('button', { name: 'Try again' })
    if (retry) fireEvent.click(retry)
    expect(load).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: 'Reload page' })).toBeInTheDocument()
  })
  it.each([
    ['/watch/23', 'Failed to fetch dynamically imported module: /assets/WatchPage.js'],
    ['/player/9', 'Importing a module script failed.'],
    ['/mvp/23', 'error loading dynamically imported module: /assets/MvpPage.js'],
  ])('offers a document reload and working navigation after %s fails', async (route, message) => {
    state.failure = new TypeError(message)
    page(route); await loaded()
    expect(await screen.findByText('This page could not load.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to tournaments' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: 'Home fixture' })).toBeInTheDocument()
  })
  it('retains ordinary render-error retry for a failure unrelated to loading', async () => {
    state.renderFailure = true; page('/team/8'); await loaded()
    expect(await screen.findByText('This page could not be drawn.')).toBeInTheDocument()
    state.renderFailure = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Team fixture' })).toBeInTheDocument()
  })
  it('clears a page render error when shell navigation opens another route', async () => {
    state.renderFailure = true; page('/team/8'); await loaded()
    expect(await screen.findByText('This page could not be drawn.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Home' }))
    expect(await screen.findByRole('heading', { name: 'Home fixture' })).toBeInTheDocument()
  })
})

it.each([
  ['/', 'Home fixture'], ['/home/all', 'Home fixture'], ['/login', 'Login fixture'], ['/register', 'Register fixture'],
  ['/t/23', 'Tournament fixture'], ['/t/23/bracket', 'Tournament fixture'], ['/t/23/manage/setup', 'Tournament fixture'],
  ['/m/13/fixture', 'Fixture fixture'], ['/m/13/progress', 'Match fixture'], ['/checkin/13', 'Checkin fixture'],
  ['/teams', 'Teams fixture'], ['/matches', 'Matches fixture'], ['/inbox', 'Inbox fixture'], ['/me', 'Profile fixture'],
  ['/search', 'Search fixture'], ['/search/cup', 'Search fixture'], ['/admin/users', 'Admin fixture'], ['/unknown', 'Home fixture'],
])('retains route %s and its heading', async (route, heading) => {
  page(route); await loaded()
  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
})
