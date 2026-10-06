import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ mutate: vi.fn(), hook: vi.fn(), pending: false, own: false }))
vi.mock('../../hooks/useQaFeatures', () => ({ useJoinRequests: (...args: unknown[]) => {
  state.hook(...args)
  return { team: { isSuccess: true, data: { items: [{ id: 7, user: { id: 12, fullName: 'New player' }, message: 'Please admit me', status: 'pending' }] } },
    mine: { isPending: state.pending, data: { items: state.own ? [{ id: 8, team: { id: 42 }, status: 'pending' }] : [] } },
    action: { mutate: state.mutate, reset: vi.fn() } }
} }))
import { JoinRequestsPanel } from './JoinRequestsPanel'
const page = (override: Partial<Parameters<typeof JoinRequestsPanel>[0]> = {}) => render(<MemoryRouter><JoinRequestsPanel teamId={42} visibility="public" leader={false} member={false} signedIn membershipPending={false} {...override} /></MemoryRouter>)
beforeEach(() => { vi.clearAllMocks(); state.pending = false; state.own = false })
it('keeps private reads disabled for guests and offers sign-in instead of admission', () => {
  page({ signedIn: false })
  expect(state.hook).toHaveBeenCalledWith(42, false, false)
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument()
})
it('prevents a duplicate request while checking personal status and offers cancellation for an existing request', () => {
  state.pending = true
  const view = page()
  expect(screen.getByRole('button', { name: 'Request to join' })).toBeDisabled()
  view.unmount(); state.pending = false; state.own = true; page()
  expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel join request' }))
  expect(state.mutate).toHaveBeenCalledWith({ kind: 'cancel', id: 8 }, expect.anything())
})
it('requires leader confirmation, preserves the request identity and permits cancellation without admission', () => {
  page({ leader: true, member: true })
  fireEvent.click(screen.getByRole('button', { name: 'Review admission' }))
  expect(state.mutate).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  expect(state.mutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Review admission' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }))
  expect(state.mutate).toHaveBeenCalledWith({ kind: 'review', id: 7, approve: true, reason: '' }, expect.anything())
})
