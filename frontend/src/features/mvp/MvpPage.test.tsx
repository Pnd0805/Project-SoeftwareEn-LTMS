import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const { vote, mvp, state } = vi.hoisted(() => ({ vote: vi.fn(), mvp: vi.fn(), state: { signedIn: true, canVote: true, open: true } }))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: state.signedIn ? { id: 7 } : null }) }))
vi.mock('../../hooks/useMatch', () => ({ useTournamentMatches: () => ({ data: { items: [
  { id: 13, status: 'completed', teamA: { id: 1, name: 'A' }, teamB: { id: 2, name: 'B' } },
  { id: 14, status: 'finished', teamA: { id: 3, name: 'C' }, teamB: { id: 4, name: 'D' } },
] }, isPending: false, isError: false }) }))
vi.mock('../../hooks/useLiveEngagement', () => ({ useMvpLive: mvp }))
import { MvpPage } from './MvpPage'
beforeEach(() => {
  vi.clearAllMocks(); state.signedIn = true; state.canVote = true; state.open = true
  mvp.mockImplementation(() => ({ query: { data: { window: { isOpen: state.open, opensAt: '2026-10-01T00:00:00Z', closesAt: '2026-10-02T00:00:00Z' },
    candidates: [{ userId: 9002, fullName: 'Candidate', teamId: 1, avatarUrl: null, stats: [{ statKey: 'goals', statLabelTh: 'Goals', value: 3 }], votes: 8 }], winners: [9002], mine: null, canVote: state.canVote }, isPending: false, isError: false }, vote: { mutate: vote, isPending: false, isError: false } }))
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
