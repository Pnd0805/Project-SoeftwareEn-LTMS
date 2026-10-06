import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { MatchDto, MatchListItemDto } from '../../types/match.dto'
import type { TournamentRefereeDto } from '../../types/admin.dto'

const state = vi.hoisted(() => ({
  transfer: vi.fn(), swap: vi.fn(), loading: false, readError: false, error: null as Error | null, alone: false,
}))
const assignments = [
  [{ tournamentRefereeId: 34, referee: { id: 9002, fullName: 'Ref A' } }],
  [{ tournamentRefereeId: 35, referee: { id: 9003, fullName: 'Ref B' } }],
  [{ tournamentRefereeId: 36, referee: { id: 9004, fullName: 'Ref C' } }],
]
vi.mock('../../hooks/useMatch', () => ({
  useTournamentMatches: () => ({ data: { items: matches }, isPending: false, isError: false }),
  useTournamentMatchReferees: () => assignments.map((items, i) => ({ data: { items: state.alone && i > 0 ? [] : items }, isPending: state.loading, isError: state.readError })),
}))
vi.mock('../../hooks/useAdmin', () => ({
  useRequestRefereeWithdrawal: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false }),
  useRequestRefereeTransfer: () => ({ mutate: state.transfer, reset: vi.fn(), isPending: false, error: state.error }),
  useRequestRefereeSwap: () => ({ mutate: state.swap, reset: vi.fn(), isPending: false, error: null }),
  /* F02b — กรรมการที่ใช้งานได้ทุกคน รวม 9005 ที่ยังไม่มีแมตช์ (ผู้เรียกเองไม่อยู่ในลิสต์) */
  useAssignableReferees: () => ({ isPending: false, isError: false, data: { items: state.alone ? [] : [
    { id: 37, user: { id: 9005, fullName: 'Ref Free' }, upcomingMatchCount: 0 },
    { id: 35, user: { id: 9003, fullName: 'Ref B' }, upcomingMatchCount: 1 },
    { id: 36, user: { id: 9004, fullName: 'Ref C' }, upcomingMatchCount: 1 },
  ] } }),
}))
import { RefereeMatchRequest, RefereeRequestForm } from './RefereeMatchRequest'
const matches = [1, 2, 3].map(id => ({ id, status: 'scheduled',
  scheduledTime: '2099-01-01T09:00:00Z', scheduledEndTime: '2099-01-01T10:00:00Z',
})) as MatchListItemDto[]
const mine = { ...matches[0], tournamentId: 10, viewer: { myUserId: 9002, roles: ['referee'] } } as unknown as MatchDto
const pick = (label: string, value: number | string) => fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } })
beforeEach(() => { vi.clearAllMocks(); state.loading = false; state.readError = false; state.error = null; state.alone = false })

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
/* OD-59 — เดิมปลายทางรวบจากกรรมการของแมตช์อื่น คนที่ยังไม่มีแมตช์ (ว่างที่สุด) จึงไม่โผล่ */
it('offers a referee with no match yet as a transfer destination, but not as a swap partner', () => {
  render(<RefereeMatchRequest m={mine} />)
  expect(screen.getByRole('option', { name: 'Ref Free · 0 upcoming matches' })).toBeInTheDocument()
  pick('Receiving referee', 37)
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
  expect(state.transfer).toHaveBeenCalledWith({ myMatchId: 1, toTournamentRefereeId: 37 }, expect.any(Object))
  pick('Request type', 'swap')
  expect(screen.queryByRole('option', { name: /Ref Free/ })).not.toBeInTheDocument()
})
/* t23 จริง — กรรมการสองคนคุมแมตช์เดียวกัน ไม่มีใครรับโอนหรือแลก · dropdown ว่างเฉยๆ ดูเหมือนหน้าเสีย */
it('says why nobody is listed and what to do about it', () => {
  state.alone = true
  render(<RefereeMatchRequest m={mine} />)
  expect(screen.getByText(/No other active referee in this tournament can take this match/)).toBeInTheDocument()
  pick('Request type', 'swap')
  expect(screen.getByText(/nothing to swap with/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled()
})
