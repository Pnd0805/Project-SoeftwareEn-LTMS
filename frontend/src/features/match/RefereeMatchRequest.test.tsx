import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MatchDto, MatchListItemDto } from '../../types/match.dto'
import type { TournamentRefereeDto } from '../../types/admin.dto'

const state = vi.hoisted(() => ({
  transfer: vi.fn(), swap: vi.fn(), loading: false, readError: false, error: null as Error | null,
}))
const assignments = [
  [{ tournamentRefereeId: 34, referee: { id: 9002, fullName: 'Ref A' } }],
  [{ tournamentRefereeId: 35, referee: { id: 9003, fullName: 'Ref B' } }],
  [{ tournamentRefereeId: 36, referee: { id: 9004, fullName: 'Ref C' } }],
]
vi.mock('../../hooks/useMatch', () => ({
  useTournamentMatches: () => ({ data: { items: matches }, isPending: false, isError: false }),
  useTournamentMatchReferees: () => assignments.map(items => ({ data: { items }, isPending: state.loading, isError: state.readError })),
}))
vi.mock('../../hooks/useAdmin', () => ({
  useRequestRefereeTransfer: () => ({ mutate: state.transfer, reset: vi.fn(), isPending: false, error: state.error }),
  useRequestRefereeSwap: () => ({ mutate: state.swap, reset: vi.fn(), isPending: false, error: null }),
}))
import { RefereeMatchRequest, RefereeRequestForm } from './RefereeMatchRequest'
const matches = [1, 2, 3].map(id => ({ id, status: 'scheduled',
  scheduledTime: '2099-01-01T09:00:00Z', scheduledEndTime: '2099-01-01T10:00:00Z',
})) as MatchListItemDto[]
const mine = { ...matches[0], tournamentId: 10, viewer: { myUserId: 9002, roles: ['referee'] } } as unknown as MatchDto
const pick = (label: string, value: number | string) => fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } })
beforeEach(() => { vi.clearAllMocks(); state.loading = false; state.readError = false; state.error = null })

it('sends a transfer using the invitation ID rather than the receiving user ID', () => {
  render(<RefereeMatchRequest m={mine} />)
  pick('Receiving referee', 35)
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
  expect(state.transfer).toHaveBeenCalledWith({ myMatchId: 1, toTournamentRefereeId: 35 }, expect.any(Object))
  expect(screen.queryByRole('option', { name: 'Ref A' })).not.toBeInTheDocument()
})
it('offers only the selected referee assigned matches when swapping', () => {
  render(<RefereeMatchRequest m={mine} />)
  pick('Request type', 'swap'); pick('Receiving referee', 35)
  expect(screen.queryByRole('option', { name: 'Match #3' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled()
  pick('Second match', 2); fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
  expect(state.transfer).toHaveBeenCalledWith({ myMatchId: 1, toTournamentRefereeId: 35, theirMatchId: 2 }, expect.any(Object))
})
it('sends an organizer swap with two actual assignment IDs', () => {
  const pool = [34, 35].map(id => ({ id, isActive: true })) as TournamentRefereeDto[]
  render(<RefereeRequestForm tournamentId={10} matches={matches} pool={pool} />)
  pick('First match', 1); pick('First referee', 34); pick('Second match', 2); pick('Second referee', 35)
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
  expect(state.swap).toHaveBeenCalledWith({ matchAId: 1, refereeAId: 34, matchBId: 2, refereeBId: 35 }, expect.any(Object))
})
it('hides requests from spectators and after kick-off', () => {
  const view = render(<RefereeMatchRequest m={{ ...mine, viewer: { ...mine.viewer, roles: [] } }} />)
  expect(screen.queryByText('Request a transfer or swap')).not.toBeInTheDocument()
  view.rerender(<RefereeMatchRequest m={{ ...mine, scheduledTime: '2000-01-01T09:00:00Z' }} />)
  expect(screen.queryByText('Request a transfer or swap')).not.toBeInTheDocument()
})
it('blocks sending when assignment reads fail', () => {
  state.readError = true
  render(<RefereeMatchRequest m={mine} />)
  expect(screen.getByText(/Could not read referee assignments/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled()
})
it('reports conflicts without claiming any assignment changed', () => {
  state.error = new Error('Schedule conflict')
  render(<RefereeMatchRequest m={mine} />)
  expect(screen.getByText('Schedule conflict')).toBeInTheDocument()
  expect(screen.queryByText(/Assignments change only after/)).not.toBeInTheDocument()
})
it('shows an open request as awaiting consent and prevents a duplicate send', () => {
  state.transfer.mockImplementation((_input, options) => options.onSuccess({ id: 50, status: 'open' }))
  render(<RefereeMatchRequest m={mine} />)
  pick('Receiving referee', 35); fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
  expect(screen.getByText(/Request #50: open/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled()
})