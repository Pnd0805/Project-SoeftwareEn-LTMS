import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ error: null as { status: number } | null, empty: false, decide: vi.fn() }))
const referee = { id: 14, referee: { id: 33, fullName: 'Alex External', avatarUrl: null }, tournament: { id: 42, name: 'Campus Cup' }, invitedBy: { fullName: 'Organizer' } }
const transfer = { id: 15, status: 'pending', team: { id: 11, name: 'Northside' }, currentLeader: { id: 34, fullName: 'Morgan' }, proposedLeader: { id: 35, fullName: 'Riley' } }
const query = (row: unknown) => ({ data: { items: state.empty ? [] : [row] }, isError: !!state.error, error: state.error, isSuccess: !state.error, isPending: false, refetch: vi.fn() })
vi.mock('../../hooks/useAdmin', () => ({
  useExternalRefereeRequests: () => query(referee), useLeaderTransfers: () => query(transfer),
  useReviewExternalReferee: () => ({ mutate: state.decide, reset: vi.fn(), isPending: false }),
  useReviewLeaderTransfer: () => ({ mutate: state.decide, reset: vi.fn(), isPending: false }),
}))
import { AdminRefereesTab } from './AdminRefereesTab'
import { LeaderTransfersTab } from './LeaderTransfersTab'
beforeEach(() => { state.error = null; state.empty = false; state.decide.mockReset() })

it('hides a cached external referee and rejection dialog after source denial', () => {
  const view = render(<MemoryRouter><AdminRefereesTab /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
  state.error = { status: 403 }; view.rerender(<MemoryRouter><AdminRefereesTab /></MemoryRouter>)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('Alex External')).not.toBeInTheDocument()
})
it('keeps the named transfer outcome after the approved item leaves the queue', () => {
  state.decide.mockImplementation((_vars, opts) => { state.empty = true; opts.onSuccess?.() })
  render(<MemoryRouter><LeaderTransfersTab /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }))
  expect(state.decide).toHaveBeenCalledWith({ id: 15, approve: true, reason: '' }, expect.anything())
  expect(screen.getByRole('status')).toHaveTextContent('Northside')
  expect(screen.getByRole('status')).toHaveTextContent('Riley')
})
it('hides a cached transfer and its confirmation after source denial', () => {
  const view = render(<MemoryRouter><LeaderTransfersTab /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  state.error = { status: 403 }; view.rerender(<MemoryRouter><LeaderTransfersTab /></MemoryRouter>)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('Northside')).not.toBeInTheDocument()
})
