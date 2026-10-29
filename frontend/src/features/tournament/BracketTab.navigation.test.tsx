import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Tournament } from '../../shared/types'
import type { BackendBracketDto, BackendBracketNodeDto, MatchListItemDto } from '../../types/match.dto'
import { ApiError } from '../../api/client'

const { getMatches, getStructure } = vi.hoisted(() => ({ getMatches: vi.fn(), getStructure: vi.fn() }))
vi.mock('../../api/match', async original => ({
  ...await original<typeof import('../../api/match')>(), getTournamentMatches: getMatches, getBracket: getStructure,
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

function show(t = tournament) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/bracket']}><Routes>
    <Route path="/bracket" element={<BracketTab t={t} />} />
    <Route path="/m/:id" element={<Destination />} />
    <Route path="/team/:id" element={<TeamDestination />} />
  </Routes></MemoryRouter></QueryClientProvider>)
  return client
}

beforeEach(() => { getStructure.mockReset().mockResolvedValue({ nodes: [] }) })

it.each(['match', 'team'])('highlights locally, keeps matches available and opens the %s destination', async destination => {
  getMatches.mockReset().mockResolvedValue({ items: [
    { id: 1, roundNumber: 1, tag: 'Semi-final', status: 'scheduled', teamA: team(10, 'Northside'), teamB: team(20, 'Westside'), score: null, outcome: null },
    { id: 2, roundNumber: 2, tag: 'Final', status: 'scheduled', teamA: team(30, 'Eastside'), teamB: null, score: null, outcome: null },
  ] })
  show()
  const highlight = await screen.findByLabelText('Highlight team')
  fireEvent.change(highlight, { target: { value: '10' } })
  const region = screen.getByRole('region', { name: 'Bracket matches' })
  expect(region).toHaveAttribute('tabindex', '0')
  expect(within(region).getByRole('button', { name: /Final.*Eastside/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous rounds' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next rounds' })).toBeInTheDocument()
  expect(getMatches).toHaveBeenCalledExactlyOnceWith(42)
  expect(getStructure).not.toHaveBeenCalled()
  fireEvent.click(destination === 'match'
    ? within(region).getByRole('button', { name: /Highlighted team: Northside/ })
    : within(region).getByRole('link', { name: 'Northside' }))
  expect(screen.getByRole('heading', { name: destination === 'match' ? 'Match 1' : 'Team 10' })).toBeInTheDocument()
})

const doubleMatches = () => [
  { id: 1, roundNumber: 1, nextMatchId: 3, teamA: team(10, 'Northside'), teamB: team(20, 'Westside') },
  { id: 2, roundNumber: 1, nextMatchId: 3, teamA: team(30, 'Eastside'), teamB: team(40, 'Southside') },
  { id: 3, roundNumber: 2, nextMatchId: 6, teamA: team(20, 'Westside'), teamB: null },
  { id: 4, roundNumber: 1, nextMatchId: 5, teamA: team(10, 'Northside'), teamB: team(30, 'Eastside') },
  { id: 5, roundNumber: 2, nextMatchId: 6, teamA: null, teamB: null },
  { id: 6, roundNumber: null, nextMatchId: null, teamA: null, teamB: null },
].map(m => ({ tag: `Match ${m.id}`, status: 'scheduled', score: null, outcome: null, ...m }))

function doubleStructure(): BackendBracketDto {
  const node = (matchId: number, bracketType: BackendBracketNodeDto['bracketType'], round: number | null, matchNumber = 1): BackendBracketNodeDto => ({
    nodeId: matchId, matchId, bracketType, round, matchNumber, teamA: null, teamB: null, matchStatus: 'scheduled', advancesToNodeId: null,
  })
  return { bracketFormat: 'double_elimination', nodes: [
    node(1, 'winners', 1), node(2, 'winners', 1, 2), node(3, 'winners', 2),
    node(4, 'losers', 1), node(5, 'losers', 2), node(6, 'grand_final', null),
  ] }
}

it('separates upper/lower matches and the grand final using layout metadata and current match teams', async () => {
  getMatches.mockReset().mockResolvedValue({ items: doubleMatches() })
  const structure = doubleStructure()
  structure.nodes[0].teamA = { id: 999, name: 'Stale team', sportTypeId: 1 }
  getStructure.mockResolvedValue(structure)
  show({ ...tournament, format: 'double' })
  const upper = await screen.findByRole('region', { name: 'Winners bracket' })
  const lower = screen.getByRole('region', { name: 'Losers bracket' })
  expect(within(upper).getByRole('heading', { name: 'Upper semi-finals' })).toBeInTheDocument()
  expect(within(upper).getByRole('heading', { name: 'Grand final' })).toBeInTheDocument()
  expect(within(upper).getAllByRole('button')).toHaveLength(4)
  expect(within(lower).getAllByRole('button')).toHaveLength(2)
  expect(within(upper).getByRole('link', { name: 'Northside' })).toBeInTheDocument()
  expect(screen.queryByText('Stale team')).not.toBeInTheDocument()
  expect(screen.queryByText('Round 0')).not.toBeInTheDocument()
  expect(getStructure).toHaveBeenCalledExactlyOnceWith(42)
  await waitFor(() => expect(screen.getByRole('region', { name: 'Bracket matches' }).querySelectorAll('svg.bconn path')).toHaveLength(5))
})

it('keeps matches visible when section metadata fails, and recovers after retry', async () => {
  getMatches.mockReset().mockResolvedValue({ items: doubleMatches() })
  getStructure.mockRejectedValue(new ApiError(403, { code: 'FORBIDDEN', message: 'No layout access' }))
  show({ ...tournament, format: 'double' })
  const retry = await screen.findByRole('button', { name: 'Retry bracket sections' })
  const region = screen.getByRole('region', { name: 'Bracket matches' })
  expect(within(region).getAllByRole('button', { name: /^Match \d/ })).toHaveLength(6)
  expect(screen.getByRole('heading', { name: 'Round not assigned' })).toBeInTheDocument()
  getStructure.mockResolvedValue(doubleStructure())
  fireEvent.click(retry)
  await screen.findByRole('region', { name: 'Winners bracket' })
  expect(screen.queryByRole('button', { name: 'Retry bracket sections' })).not.toBeInTheDocument()
})

it('keeps an unmatched current match when metadata is older than the match list', async () => {
  getMatches.mockReset().mockResolvedValue({ items: [...doubleMatches(), {
    id: 99, roundNumber: null, status: 'scheduled', teamA: team(90, 'New team'), teamB: null,
  }] })
  getStructure.mockResolvedValue(doubleStructure())
  show({ ...tournament, format: 'double' })
  const other = await screen.findByRole('region', { name: 'Other matches' })
  expect(within(other).getByRole('link', { name: 'New team' })).toBeInTheDocument()
})

it('keeps score cells, official winner, BYE and Bangkok schedule readable', async () => {
  getMatches.mockReset().mockResolvedValue({ items: [{
    id: 1, roundNumber: 1, status: 'completed', resultStatus: 'verified',
    teamA: team(10, 'Northside'), teamB: null, score: { a: 2, b: 0 },
    outcome: { kind: 'bye', winnerTeamId: 10 }, scheduledTime: '2026-10-30T06:00:00Z',
  }] })
  show()
  const region = await screen.findByRole('region', { name: 'Bracket matches' })
  expect(within(region).getByText('BYE')).toBeInTheDocument()
  expect(within(region).getByRole('link', { name: 'Northside' }).closest('.brow')).toHaveClass('win')
  expect(within(region).getByText('2')).toBeInTheDocument()
  expect(within(region).getByText('0')).toBeInTheDocument()
  expect(within(region).getByText(/30 Oct.*13:00/)).toHaveAttribute('datetime', '2026-10-30T06:00:00Z')
})

it('redraws progression after a same-size match refresh removes a link', async () => {
  const matches = doubleMatches().slice(0, 3) as unknown as MatchListItemDto[]
  getMatches.mockReset().mockResolvedValue({ items: matches })
  const client = show()
  const region = await screen.findByRole('region', { name: 'Bracket matches' })
  await waitFor(() => expect(region.querySelectorAll('svg.bconn path')).toHaveLength(2))
  getMatches.mockResolvedValue({ items: matches.map(match => ({ ...match, nextMatchId: null })) })
  await act(async () => { await client.invalidateQueries({ queryKey: ['matches'] }) })
  await waitFor(() => expect(region.querySelector('svg.bconn')).not.toBeInTheDocument())
})

it('does not draw advancement paths for round robin even when a next ID exists', async () => {
  getMatches.mockReset().mockResolvedValue({ items: doubleMatches().slice(0, 3) })
  show({ ...tournament, format: 'roundrobin' })
  const region = await screen.findByRole('region', { name: 'Bracket matches' })
  expect(within(region).getByRole('heading', { name: 'Matchday 1' })).toBeInTheDocument()
  expect(region.querySelector('svg.bconn')).not.toBeInTheDocument()
  expect(getStructure).not.toHaveBeenCalled()
})
