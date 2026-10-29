import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ status: 'open' }))
const idle = vi.hoisted(() => ({ isPending: false, isError: false, isSuccess: true, error: null, mutate: vi.fn() }))
vi.mock('../../hooks/useTeam', () => ({ useBackendMyInvitations: () => ({ ...idle, data: { items: [] } }), useAnswerBackendInvitation: () => idle }))
vi.mock('../../hooks/useTournament', () => ({ useMyTournamentApplications: () => ({ ...idle, data: { items: [] } }) }))
vi.mock('../../hooks/useAdmin', () => ({
 useCancelRefereeRequest: () => idle,
 useAcceptRefereeInvitation: () => idle,
 useDeclineRefereeInvitation: () => idle,
 useMyRefereeInvitations: () => ({ ...idle, data: { items: [] } }),
 useMyRefereeRequests: () => ({ ...idle, data: { incoming: [], outgoing: [{ id: 901, tournamentId: 14, type: 'ref_withdraw', withdrawScope: 'tournament', reason: 'Unavailable', requestedBy: 9054, refereeA: { tournamentRefereeId: 19, user: { id: 9054, fullName: 'Referee', avatarUrl: null }, status: 'accepted' }, refereeB: null, matchA: null, matchB: null, status: fixture.status, createdAt: '2026-10-08T00:00:00.000Z', resolvedAt: null }] } }),
 useAcceptRefereeRequest: () => idle,
 useDeclineRefereeRequest: () => idle,
}))
import { BackendInbox } from './BackendInbox'
describe('BE tournament withdrawal history in NEW UX inbox', () => {
 for (const status of ['open', 'applied', 'declined', 'cancelled']) {
  it(`renders outgoing ${status} tournament withdrawal without a match`, () => {
   fixture.status = status
   render(<MemoryRouter initialEntries={['/inbox']}><Routes><Route path='/inbox' element={<BackendInbox />} /><Route path='/t/:id' element={<p>Tournament destination</p>} /></Routes></MemoryRouter>)
   expect(screen.getByText(/Tournament withdrawal/)).toBeInTheDocument()
   expect(screen.getByText(/Unavailable/)).toBeInTheDocument()
   expect(screen.queryByRole('button', { name: /Open match.*901/ })).not.toBeInTheDocument()
   expect(screen.queryByRole('button', { name: 'Withdraw request #901' }) !== null).toBe(status === 'open')
   fireEvent.click(screen.getByRole('button', { name: 'Open tournament #14 for request #901' }))
   expect(screen.getByText('Tournament destination')).toBeInTheDocument()
  })
 }
})
