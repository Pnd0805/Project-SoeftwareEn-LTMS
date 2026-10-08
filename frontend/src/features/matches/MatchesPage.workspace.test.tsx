import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MatchListItemDto } from '../../types/match.dto'

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
let query: Record<string, unknown>
const refetch = vi.fn()
vi.mock('../../hooks/useMatch', () => ({ useMyMatches: () => query }))
vi.mock('../../hooks/useAdmin', () => ({ useMyRefereeInvitations: () => ({ data: { items: [] } }) }))
import { MatchesPage } from './MatchesPage'

const item = (id: number, name: string, role: 'player' | 'organizer' | 'referee', status: 'scheduled' | 'in_progress' | 'finished') => ({
  id, tournamentId: id, tournament: { id, name }, stage: 'Round 1', roundNumber: 1, tag: 'R1', status,
  teamA: { id: 101, name: 'Engineering', code: 'ENG', color: null },
  teamB: { id: 102, name: 'Science', code: 'SCI', color: null },
  viewer: { roles: [role] }, mode: 'onsite', resultStatus: null, score: null, scheduledTime: null,
}) as MatchListItemDto
beforeEach(() => {
  query = { data: { items: [item(1, 'Campus Cup', 'player', 'scheduled'), item(2, 'Autumn Cup', 'organizer', 'in_progress')] }, isPending: false, isError: false, refetch }
})
function mount() {
  const router = createMemoryRouter([
    { path: '/matches', element: <MatchesPage /> },
    { path: '/m/:id', element: <div>Match detail</div> },
  ], { initialEntries: ['/matches?keep=yes'] })
  render(<RouterProvider router={router} />)
  return router
}
it('intersects local search and state filters without merging role queues', () => {
  mount()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search matches' }), { target: { value: 'Autumn' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Match status' }), { target: { value: 'live' } })
  expect(screen.getByRole('heading', { name: /You organize/ })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Your team/ })).not.toBeInTheDocument()
  expect(screen.getByText('1 of 2 matches')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.getByRole('searchbox', { name: 'Search matches' })).toHaveValue('')
  expect(screen.getByText('2 of 2 matches')).toBeInTheDocument()
})
it('keeps filters and unrelated query parameters after visiting a match and going back', async () => {
  const router = mount()
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(240)
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search matches' }), { target: { value: 'Campus' } })
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  expect(screen.getByText('Match detail')).toBeInTheDocument()
  await act(async () => { await router.navigate(-1) })
  expect(screen.getByRole('searchbox', { name: 'Search matches' })).toHaveValue('Campus')
  expect(router.state.location.search).toContain('keep=yes')
  expect(router.state.location.state?.matchListScroll).toBe(240)
  vi.restoreAllMocks()
})
it('keeps cached matches through a recoverable refresh failure, but hides them on denied access', () => {
  query = { ...query, isError: true, error: { status: 503, message: 'Retry later' } }
  const router = mount()
  expect(screen.getByText('2 of 2 matches')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  query = { ...query, error: { status: 403, message: 'Denied' } }
  act(() => { void router.navigate('/matches?keep=yes&again=1') })
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.queryByText('Campus Cup')).not.toBeInTheDocument()
})

it('gives the populated referee category all 30 tasks and lets empty categories be selected', () => {
  query = { data: { items: Array.from({ length: 30 }, (_, i) => item(i + 1, `Cup ${i + 1}`, 'referee', 'finished')) } }
  mount()
  expect(screen.getByRole('button', { name: 'Scores 30' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(screen.getByRole('region', { name: 'Needs your score' })).getAllByRole('button', { name: 'Record result' })).toHaveLength(30)
  expect(screen.queryByRole('region', { name: 'Needs a room' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Rooms 0' }))
  expect(screen.getByRole('region', { name: 'Needs a room' })).toHaveTextContent('No room setup tasks in this view.')
  expect(screen.queryByRole('region', { name: 'Needs your score' })).not.toBeInTheDocument()
})

it('restores the selected category and queue position after opening its direct action', async () => {
  query = { data: { items: [item(1, 'Campus Cup', 'referee', 'finished'), { ...item(2, 'Autumn Cup', 'referee', 'finished'), mode: 'online', resultStatus: 'submitted' }] } }
  const router = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmation 1' }))
  const queue = screen.getByRole('region', { name: 'Needs your confirmation' })
  queue.scrollTop = 180
  fireEvent.click(within(queue).getByRole('button', { name: 'Confirm result' }))
  expect(router.state.location.pathname).toBe('/m/2')
  await act(async () => { await router.navigate(-1) })
  expect(screen.getByRole('button', { name: 'Confirmation 1' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('region', { name: 'Needs your confirmation' }).scrollTop).toBe(180)
})

it('opens scheduled referee matches without claiming that a result can already be recorded', () => {
  query = { data: { items: [item(1, 'Campus Cup', 'referee', 'scheduled')] } }
  const router = mount()
  const queue = screen.getByRole('region', { name: 'Needs your score' })
  expect(within(queue).queryByRole('button', { name: 'Record result' })).not.toBeInTheDocument()
  fireEvent.click(within(queue).getByRole('button', { name: 'Open match' }))
  expect(router.state.location.pathname).toBe('/m/1')
})

it('identifies each task and its actions by teams, tournament and round', () => {
  query = { data: { items: [item(1, 'Campus Cup', 'referee', 'finished'), {
    ...item(2, 'Autumn Cup', 'referee', 'finished'), teamB: { id: 103, name: 'Medicine', code: 'MED', color: null },
  }] } }
  mount()
  const task = screen.getByRole('article', { name: 'Engineering vs Medicine Autumn Cup R1' })
  expect(within(task).getByRole('button', { name: 'Record result' })).toHaveAccessibleDescription('Engineering vs Medicine Autumn Cup R1')
  fireEvent.click(within(task).getByRole('button', { name: 'Match details' }))
  const preview = screen.getByRole('dialog', { name: 'Match preview' })
  expect(within(preview).getByText('Medicine')).toBeInTheDocument()
  expect(within(preview).getByRole('button', { name: /Check-in console/ })).toBeInTheDocument()
})
