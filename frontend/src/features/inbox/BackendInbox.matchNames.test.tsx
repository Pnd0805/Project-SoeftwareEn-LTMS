import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { render } from '../../test/renderWithQueryClient'
import type { BackendRefereeRequestDto } from '../../types/admin.dto'

const fixture = vi.hoisted(() => ({ incoming: [] as BackendRefereeRequestDto[], outgoing: [] as BackendRefereeRequestDto[], getMatch: vi.fn(), getTournament: vi.fn() }))
const idle = vi.hoisted(() => ({ isPending: false, isError: false, isSuccess: true, error: null, mutate: vi.fn() }))
vi.mock('../../api/notification', () => ({ getNotificationMatch: fixture.getMatch }))
vi.mock('../../api/tournament', () => ({ getTournament: fixture.getTournament }))
vi.mock('../../hooks/useTeam', () => ({ useBackendMyInvitations: () => ({ ...idle, data: { items: [] } }), useAnswerBackendInvitation: () => idle }))
vi.mock('../../hooks/useTournament', () => ({ useMyTournamentApplications: () => ({ ...idle, data: { items: [] } }) }))
vi.mock('../../hooks/useAdmin', () => ({
  useCancelRefereeRequest: () => idle, useAcceptRefereeInvitation: () => idle, useDeclineRefereeInvitation: () => idle,
  useMyRefereeInvitations: () => ({ ...idle, data: { items: [] } }),
  useMyRefereeRequests: () => ({ ...idle, data: { incoming: fixture.incoming, outgoing: fixture.outgoing } }),
  useAcceptRefereeRequest: () => idle, useDeclineRefereeRequest: () => idle,
}))
import { BackendInbox } from './BackendInbox'

const request: BackendRefereeRequestDto = {
  id: 101, tournamentId: 23, type: 'org_add_match', requestedBy: 7,
  refereeA: { tournamentRefereeId: 34, user: { id: 9, fullName: 'Referee', avatarUrl: null }, status: 'pending' }, refereeB: null,
  matchA: { id: 30, roundNumber: 1, scheduledTime: null, scheduledEndTime: null }, matchB: null,
  status: 'cancelled', createdAt: '2026-10-31T00:00:00Z', resolvedAt: null,
}
const show = () => render(<MemoryRouter initialEntries={['/inbox']}><Routes>
  <Route path="/inbox" element={<BackendInbox userId={7} />} /><Route path="/m/:id" element={<p>Match destination</p>} />
</Routes></MemoryRouter>)
beforeEach(() => {
  fixture.incoming = []; fixture.outgoing = [{ ...request }]
  fixture.getMatch.mockReset().mockImplementation(async (id: number) => ({ id, tournamentId: 23, teamA: `Team A${id}`, teamB: `Team B${id}`, round: 1 }))
  fixture.getTournament.mockReset().mockResolvedValue({ id: 23, name: 'KU Cup' })
})

it('names repeated outgoing match assignments and shares context reads while preserving the destination', async () => {
  fixture.outgoing = [101, 102, 103, 104].map(id => ({ ...request, id }))
  show()
  expect(await screen.findAllByText('Match “Team A30 vs Team B30 · KU Cup · รอบ 1”')).toHaveLength(4)
  expect(fixture.getMatch).toHaveBeenCalledExactlyOnceWith(30)
  expect(fixture.getTournament).toHaveBeenCalledExactlyOnceWith(23)
  expect(screen.getAllByText('cancelled')).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: 'Open match #30 for request #101' }))
  expect(screen.getByText('Match destination')).toBeInTheDocument()
})

it('names both matches in incoming swap requests without changing the second-match link', async () => {
  fixture.outgoing = []
  fixture.incoming = [{ ...request, status: 'open', type: 'org_swap', matchB: { ...request.matchA!, id: 31 } }]
  show()
  expect(await screen.findByText('Match “Team A30 vs Team B30 · KU Cup · รอบ 1”')).toBeInTheDocument()
  expect(await screen.findByText('Match “Team A31 vs Team B31 · KU Cup · รอบ 1”')).toBeInTheDocument()
  expect(fixture.getTournament).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Open second match #31' }))
  expect(screen.getByText('Match destination')).toBeInTheDocument()
})

it('retains readable request history and numeric navigation when access to match names is denied', async () => {
  fixture.getMatch.mockRejectedValue({ status: 403 })
  show(); await waitFor(() => expect(fixture.getMatch).toHaveBeenCalledTimes(1))
  expect(screen.getByText('Match #30')).toBeInTheDocument()
  expect(screen.getByText('cancelled')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Open match #30 for request #101' })).toBeEnabled()
  expect(fixture.getTournament).not.toHaveBeenCalled()
})
