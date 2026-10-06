import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import type { Tournament } from '../../shared/types'

const { getMatches } = vi.hoisted(() => ({ getMatches: vi.fn() }))
vi.mock('../../api/match', async original => ({
  ...await original<typeof import('../../api/match')>(), getTournamentMatches: getMatches,
}))
vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(), USE_MOCK: false,
}))
import { BracketTab } from './BracketTab'

const tournament: Tournament = {
  id: '42', name: 'Street cup', sport: 'Football', format: 'single', channel: 'onsite',
  status: 'public', date: '', venue: '', pin: null, cap: 8, organizer: '7',
  referees: [], rules: { gender: 'any', ageMin: 'any', ageMax: 'any', faculty: 'any', major: 'any', year: 'any' }, drawn: true, rounds: 2, champion: null,
}
const team = (id: number, name: string) => ({ id, name, code: name.slice(0, 3), color: '#3AAE7C', logoUrl: null })
function Destination() {
  return <h1>Match {useParams().id}</h1>
}
function TeamDestination() {
  return <h1>Team {useParams().id}</h1>
}
it.each(['match', 'team'])('highlights locally, keeps matches available and opens the %s destination', async destination => {
  getMatches.mockReset().mockResolvedValue({ items: [
    { id: 1, roundNumber: 1, tag: 'Semi-final', status: 'scheduled', teamA: team(10, 'Northside'), teamB: team(20, 'Westside'), score: null, outcome: null },
    { id: 2, roundNumber: 2, tag: 'Final', status: 'scheduled', teamA: team(30, 'Eastside'), teamB: null, score: null, outcome: null },
  ] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/bracket']}><Routes>
    <Route path="/bracket" element={<BracketTab t={tournament} />} />
    <Route path="/m/:id" element={<Destination />} />
    <Route path="/team/:id" element={<TeamDestination />} />
  </Routes></MemoryRouter></QueryClientProvider>)
  const highlight = await screen.findByLabelText('Highlight team')
  fireEvent.change(highlight, { target: { value: '10' } })
  const region = screen.getByRole('region', { name: 'Bracket matches' })
  expect(region).toHaveAttribute('tabindex', '0')
  expect(within(region).getByRole('button', { name: /Final.*Eastside/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous rounds' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next rounds' })).toBeInTheDocument()
  expect(getMatches).toHaveBeenCalledExactlyOnceWith(42)
  fireEvent.click(destination === 'match'
    ? within(region).getByRole('button', { name: /Highlighted team: Northside/ })
    : within(region).getByRole('link', { name: 'Northside' }))
  expect(screen.getByRole('heading', { name: destination === 'match' ? 'Match 1' : 'Team 10' })).toBeInTheDocument()
})
