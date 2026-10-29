import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { State } from '../../shared/types'
const { vote, mvp, state } = vi.hoisted(() => ({ vote: vi.fn(), mvp: vi.fn(), state: { signedIn: true, canVote: true, open: true, mock: false, fixture: null as State | null } }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), get USE_MOCK() { return state.mock } }))
vi.mock('../../shared/store', async original => ({ ...await original<typeof import('../../shared/store')>(), useLtms: () => state.fixture }))
vi.mock('../../hooks/useUser', () => ({ useMvpVotes: () => ({ data: { items: [{ playerId: 'u-play' }] }, cast: { mutate: vote } }) }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: state.signedIn ? { id: 7 } : null }) }))
vi.mock('../../hooks/useMatch', () => ({ useTournamentMatches: () => ({ data: { items: [
  { id: 13, status: 'completed', teamA: { id: 1, name: 'A' }, teamB: { id: 2, name: 'B' } },
  { id: 14, status: 'finished', teamA: { id: 3, name: 'C' }, teamB: { id: 4, name: 'D' } },
] }, isPending: false, isError: false }) }))
vi.mock('../../hooks/useLiveEngagement', () => ({ useMvpLive: mvp }))
import { MvpPage } from './MvpPage'
import { SEED } from '../../shared/seed'
beforeEach(() => {
  vi.clearAllMocks(); state.signedIn = true; state.canVote = true; state.open = true; state.mock = false; state.fixture = null
  mvp.mockImplementation(() => ({ query: { data: { window: { isOpen: state.open, opensAt: '2026-10-01T00:00:00Z', closesAt: '2026-10-02T00:00:00Z' },
    candidates: [{ userId: 9002, fullName: 'Candidate', teamId: 1, avatarUrl: null, stats: [{ statKey: 'goals', statLabelTh: 'Goals', value: 3 }], votes: 8 }], winners: [9002], mine: null, canVote: state.canVote }, isPending: false, isError: false }, vote: { mutate: vote, isPending: false, isError: false } }))
})

describe('mock match MVP preview', () => {
  const show = (requested?: string, noPlay = false) => {
    state.mock = true
    const fixture = SEED()
    fixture.session = 'u-play'
    fixture.matches = fixture.matches.filter(m => m.tour === 't-vlr' && m.a && m.b).slice(0, 2)
    fixture.matches.forEach((match, i) => {
      match.stats = { 'u-play': { team: match.a!, goals: i ? 99 : 3, assists: 1, x: {} } }
      match.note = noPlay ? 'bye' : ''
    })
    state.fixture = fixture
    page(`/mvp/t-vlr?match=${requested ?? fixture.matches[0].id}`)
    return fixture
  }
  it('shows selected-match facts without repurposing tournament votes or inventing a voting window', () => {
    const fixture = show()
    expect(screen.getByRole('heading', { name: 'Match MVP' })).toBeInTheDocument()
    expect(screen.getByText(/One vote per match/)).toBeInTheDocument()
    expect(screen.getByText(/Voting is unavailable in this preview/)).toBeInTheDocument()
    expect(screen.getByText('3 kills · 1 assists')).toBeInTheDocument()
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('MVP match'), { target: { value: fixture.matches[1].id } })
    expect(screen.getByText(/99.*1 assists/)).toBeInTheDocument()
    expect(screen.queryByText(/3.*1 assists/)).not.toBeInTheDocument()
    expect(vote).not.toHaveBeenCalled()
  })
  it('does not show candidates for a match decided without play', () => {
    show(undefined, true)
    expect(screen.getByText(/Matches decided without play are not eligible/)).toBeInTheDocument()
    expect(screen.queryByText(/3.*1 assists/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument()
  })
  it('does not fall back to another match when the requested match is outside this tournament', () => {
    show('unrelated')
    expect(screen.getByText('This match does not belong to this tournament')).toBeInTheDocument()
    expect(screen.queryByText(/3.*1 assists/)).not.toBeInTheDocument()
  })
})
function page(path = '/mvp/23?match=13') { render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/mvp/:id" element={<MvpPage />} /></Routes></MemoryRouter>) }
describe('match MVP', () => {
  it('loads the selected match, hides vote counts while open and posts the candidate ID', () => {
    page(); expect(mvp).toHaveBeenCalledWith(13)
    expect(screen.getByText('Goals: 3')).toBeInTheDocument()
    expect(screen.queryByText('8 votes')).not.toBeInTheDocument(); expect(screen.queryByText('Winner')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Vote' })); expect(vote).toHaveBeenCalledWith(9002)
    fireEvent.change(screen.getByLabelText('MVP match'), { target: { value: '14' } }); expect(mvp).toHaveBeenLastCalledWith(14)
  })
  it('shows announced counts after close and does not allow voting', () => {
    state.open = false; state.canVote = false; page()
    expect(screen.getByText('8 votes')).toBeInTheDocument(); expect(screen.getByText('Winner')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument()
  })
  it.each(['guest', 'ineligible'])('does not expose voting for %s', kind => {
    state.signedIn = kind !== 'guest'; state.canVote = false; page()
    expect(screen.queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument()
  })
  it('rejects a match from another tournament without loading MVP for it', () => {
    page('/mvp/23?match=999'); expect(screen.getByText('This match does not belong to this tournament')).toBeInTheDocument(); expect(mvp).not.toHaveBeenCalled()
  })
})

it('does not invent an MVP window for a completed legacy match', () => {
  mvp.mockImplementation(() => ({ query: { data: { window: { isOpen: false, opensAt: null, closesAt: null }, candidates: [], winners: [], mine: null, canVote: false }, isPending: false, isError: false }, vote: { mutate: vote, isPending: false } }))
  page('/mvp/23?match=13')
  expect(screen.getByText(/backend provides an eligible voting window/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
})
