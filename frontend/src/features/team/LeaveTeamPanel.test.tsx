import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ mutate: vi.fn(), navigate: vi.fn(), error: null as Error | null }))
vi.mock('react-router-dom', () => ({ useNavigate: () => state.navigate }))
vi.mock('../../hooks/useTeam', () => ({ useLeaveTeam: () => ({ mutate: state.mutate, reset: vi.fn(), isPending: false, isError: !!state.error, error: state.error }) }))
import { LeaveTeamPanel } from './LeaveTeamPanel'
beforeEach(() => { vi.clearAllMocks(); state.error = null })
it('never offers the captain a leave action', () => {
  render(<LeaveTeamPanel teamId={42} name="A" leader />)
  expect(screen.queryByRole('button', { name: 'Leave team' })).not.toBeInTheDocument()
  expect(screen.getByText(/captain cannot leave/)).toBeInTheDocument()
})
it('requires confirmation and cancel performs no write', () => {
  render(<LeaveTeamPanel teamId={42} name="A" leader={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'Leave team' }))
  expect(state.mutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(state.mutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Leave team' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm leave' }))
  expect(state.mutate).toHaveBeenCalledWith(undefined, expect.any(Object))
  state.mutate.mock.calls[0][1].onSuccess()
  expect(state.navigate).toHaveBeenCalledWith('/teams')
})
it('keeps a locked membership error visible in the dialog', () => {
  state.error = new Error('Membership locked by an approved tournament')
  render(<LeaveTeamPanel teamId={42} name="A" leader={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'Leave team' }))
  expect(screen.getByText('Membership locked by an approved tournament')).toBeInTheDocument()
  expect(state.navigate).not.toHaveBeenCalled()
})
