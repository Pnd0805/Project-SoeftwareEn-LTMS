import { render } from '../../../test/renderWithQueryClient'
import { screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Tournament } from '../../../shared/types'
import { ApiError } from '../../../api/client'
const source = vi.hoisted(() => ({ error: null as Error | null, acceptedCount: 1 }))
vi.mock('../../../hooks/useAdmin', () => ({
  useRefereeCoverage: () => ({ data: undefined }),
  useTournamentReferees: () => ({ data: { acceptedCount: source.acceptedCount, awaitingAdminCount: 1, items: [
    { id: 1, user: { id: 7, fullName: 'Active Referee' }, isActive: true, invitationStatus: 'accepted' },
    { id: 2, user: { id: 8, fullName: 'Invited Referee' }, isActive: false, invitationStatus: 'pending' },
    { id: 3, user: { id: 9, fullName: 'External Referee' }, isActive: false, invitationStatus: 'accepted', isExternal: true, externalApprovalStatus: 'pending' },
  ] }, isPending: false, isError: !!source.error, error: source.error }),
  useRemoveReferee: () => ({ isPending: false, mutate: vi.fn() }),
}))
import { RefereePanel } from './RefereePanel'
it('distinguishes the accepted pool from the per-match requirement without claiming coverage', () => {
  source.acceptedCount = 6
  render(<RefereePanel t={{ id: '42', name: 'Campus Cup', channel: 'onsite', status: 'private' } as Tournament} onAppoint={vi.fn()} />)
  expect(screen.getByText('6 accepted')).toBeInTheDocument()
  expect(screen.getByText('2 required per match')).toBeInTheDocument()
  expect(screen.queryByText('6 of 2 accepted')).not.toBeInTheDocument()
  expect(screen.getByText(/match assignments are separate/)).toBeInTheDocument()
  source.acceptedCount = 1
})
it('separates active appointments from unanswered invitations and external approval', () => {
  render(<RefereePanel t={{ id: '42', name: 'Campus Cup', channel: 'onsite', status: 'private' } as Tournament} onAppoint={vi.fn()} />)
  const accepted = screen.getByRole('region', { name: 'Accepted appointments' })
  const invitations = screen.getByRole('region', { name: 'Invitations and responses' })
  expect(within(accepted).getByText('Active Referee')).toBeInTheDocument()
  expect(within(accepted).queryByText('External Referee')).not.toBeInTheDocument()
  expect(within(invitations).getByText('External Referee')).toBeInTheDocument()
  expect(within(invitations).getByText(/waiting for admin approval/)).toBeInTheDocument()
  expect(within(invitations).getByText('Invited Referee')).toBeInTheDocument()
})
it('removes cached referee names and controls when the source denies access', () => {
  source.error = new ApiError(403, { code: 'FORBIDDEN', message: 'Access denied' })
  render(<RefereePanel t={{ id: '42', name: 'Campus Cup', channel: 'onsite' } as Tournament} onAppoint={vi.fn()} />)
  expect(screen.getByText(/can't view this tournament's referees/)).toBeInTheDocument()
  expect(screen.queryByText('Active Referee')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Appoint a referee' })).not.toBeInTheDocument()
  source.error = null
})
