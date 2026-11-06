import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { AmendmentImpactDto, BackendAmendmentRequestDto } from '../../types/tournament.dto'

const state = vi.hoisted(() => ({ query: vi.fn(), refetch: vi.fn(), mutate: vi.fn() }))
vi.mock('../../hooks/useAdmin', () => ({ useAmendmentImpact: state.query }))
vi.mock('./TournamentReviewDetails', () => ({ TournamentReviewDetails: ({ changes }: { changes: Record<string, unknown> }) => <div>Current changes: {JSON.stringify(changes)}</div> }))
import { AmendmentApprovalDialog } from './AmendmentApprovalDialog'
const request: BackendAmendmentRequestDto = { id: 7, tournamentId: 22, tournamentName: 'Queued name', requestedChanges: { maxTeams: 4 }, requestedBy: { id: 9, fullName: 'Reviewer', avatarUrl: null }, status: 'pending', requestedAt: '2026-10-08T00:00:00Z' }
const impact: AmendmentImpactDto = { requestId: 7, tournamentId: 22, tournamentName: 'Current name', requestedChanges: { maxTeams: 8 }, reason: 'Expand capacity', status: 'pending', selfRequested: true, canApprove: true, alreadyDecided: false, blockers: [] }
const query = (overrides = {}) => ({ data: impact, isSuccess: true, isFetching: false, isPending: false, isError: false, error: null, refetch: state.refetch, ...overrides })
const approval = { isPending: false, isError: false, error: null, mutate: state.mutate }
const show = () => render(<AmendmentApprovalDialog request={request} approval={approval as unknown as Parameters<typeof AmendmentApprovalDialog>[0]['approval']} onClose={vi.fn()} />)
beforeEach(() => { vi.clearAllMocks(); state.query.mockReturnValue(query()) })
it('uses current changes and self-request flag, and posts only after explicit confirmation', () => {
  show()
  expect(state.query).toHaveBeenCalledWith(7)
  expect(screen.getByText('Current changes: {"maxTeams":8}')).toBeInTheDocument()
  expect(screen.getByText(/You submitted this request/)).toBeInTheDocument()
  expect(screen.getByText('Reason: Expand capacity')).toBeInTheDocument()
  expect(state.mutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm amendment approval' }))
  expect(state.mutate).toHaveBeenCalledWith(7, expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }))
  state.mutate.mock.calls[0][1].onError(new ApiError(409, { code: 'ALREADY_DECIDED', message: 'Decided' }))
  expect(state.refetch).toHaveBeenCalledOnce()
})
it.each([
  { isSuccess: false, isPending: true, data: undefined },
  { isFetching: true },
  { isSuccess: false, isError: true, error: new ApiError(403, { code: 'INSUFFICIENT_ADMIN_SCOPE', message: 'Wrong faculty' }) },
  { isSuccess: false, isError: true, error: new ApiError(404, { code: 'AMENDMENT_NOT_FOUND', message: 'Removed' }) },
  { data: { ...impact, alreadyDecided: true, status: 'approved' } },
  { data: { ...impact, canApprove: false } },
  { data: { ...impact, requestId: 8 } },
  { data: { ...impact, tournamentId: 23 } },
])('blocks confirmation for unavailable or stale impact %j', overrides => {
  state.query.mockReturnValue(query(overrides)); show()
  expect(screen.getByRole('button', { name: 'Confirm amendment approval' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm amendment approval' }))
  expect(state.mutate).not.toHaveBeenCalled()
})
it('shows delivered affected teams and players and blocks even an inconsistent canApprove=true', () => {
  state.query.mockReturnValue(query({ data: { ...impact, blockers: [{ code: 'AMENDMENT_BREAKS_APPROVED_TEAMS', message: 'Existing entries would fail', details: { affectedTeamCount: 1, affectedTeams: [{ teamId: 10, teamName: 'Engineering A', players: [{ userId: 9, fullName: 'Player Nine', reason: 'Gender mismatch' }] }] } }] } }))
  show()
  expect(screen.getByText('Affected approved teams: 1')).toBeInTheDocument()
  expect(screen.getByText('Engineering A')).toBeInTheDocument()
  expect(screen.getByText('Player Nine · Gender mismatch')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirm amendment approval' })).toBeDisabled()
})
it('offers retry after an impact error without reusing a previous successful preview', () => {
  state.query.mockReturnValue(query({ isError: true, error: new Error('Unavailable') })); show()
  expect(screen.queryByText(/Current changes/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh amendment impact' }))
  expect(state.refetch).toHaveBeenCalledOnce()
})
