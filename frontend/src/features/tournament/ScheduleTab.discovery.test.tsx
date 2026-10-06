import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

const { getMatches } = vi.hoisted(() => ({ getMatches: vi.fn() }))
vi.mock('../../api/match', async original => ({
  ...await original<typeof import('../../api/match')>(), getTournamentMatches: getMatches,
}))
import { ScheduleTab } from './ScheduleTab'

const team = (id: number, name: string) => ({ id, name, code: name.slice(0, 3), color: '#3AAE7C', logoUrl: null })
const match = (id: number, round: number, home: string, away: string, status: string) => ({
  id, roundNumber: round, tag: `R${round} M${id}`, stage: `Round ${round}`, status,
  scheduledTime: null, teamA: team(id * 2, home), teamB: team(id * 2 + 1, away),
  resultStatus: null, outcome: null, score: null, viewer: { can: { editFixture: false } },
})
function MatchDestination() {
  const { id } = useParams()
  return <h1>Match {id}</h1>
}
beforeEach(() => {
  getMatches.mockReset().mockResolvedValue({ items: [
    match(1, 1, 'Northside FC', 'Westside FC', 'in_progress'),
    match(2, 2, 'Northside FC', 'Eastside FC', 'scheduled'),
    match(3, 1, 'Southside FC', 'Westside FC', 'scheduled'),
  ] })
})
it('intersects local team, round and state filters, clears no matches and opens the selected match', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/schedule']}><Routes>
    <Route path="/schedule" element={<ScheduleTab tournamentId={42} />} />
    <Route path="/m/:id" element={<MatchDestination />} />
  </Routes></MemoryRouter></QueryClientProvider>)
  const table = await screen.findByRole('table')
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search schedule' }), { target: { value: 'northside' } })
  fireEvent.change(screen.getByLabelText('Round filter'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Match state filter'), { target: { value: 'scheduled' } })
  expect(within(table).getAllByRole('row')).toHaveLength(2)
  expect(within(table).getByText('Eastside FC')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Match state filter'), { target: { value: 'live' } })
  expect(screen.getByText('No matching matches')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.getByRole('searchbox', { name: 'Search schedule' })).toHaveValue('')
  expect(screen.getAllByRole('row')).toHaveLength(4)
  expect(getMatches).toHaveBeenCalledExactlyOnceWith(42)
  const row = screen.getByText('Eastside FC').closest('tr')!
  fireEvent.click(within(row).getByRole('button', { name: 'Open' }))
  expect(screen.getByRole('heading', { name: 'Match 2' })).toBeInTheDocument()
})
