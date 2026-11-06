import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { getMyTeams, getMyInvitations, answerInvitation } = vi.hoisted(() => ({
  getMyTeams: vi.fn(),
  getMyInvitations: vi.fn(),
  answerInvitation: vi.fn(),
}))

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../api/team', () => ({
  getBackendMyTeams: getMyTeams,
  getBackendMyInvitations: getMyInvitations,
  answerBackendInvitation: answerInvitation,
}))
vi.mock('../../hooks/useTournament', () => ({
  useCancelMyApplication: () => ({ isError: false }),
  useMyTournamentApplications: () => ({ data: { items: [] }, isPending: false, isError: false, isSuccess: true }),
  useWithdrawMyApplication: () => ({ isError: false, mutateAsync: vi.fn() }),
}))
vi.mock('../../hooks/useReference', () => ({ useSportTypes: () => ({ data: { items: [] } }) }))
vi.mock('../../hooks/useLiveEngagement', () => ({ useReviews: () => ({ query: { isPending: false, isError: false } }) }))
vi.mock('../tournament/EnterTournamentButton', () => ({ EnterTournamentButton: () => null }))

import { TeamsPage } from './TeamsPage'

afterEach(() => {
  getMyTeams.mockReset()
  getMyInvitations.mockReset()
  answerInvitation.mockReset()
})

describe('TeamsPage invitation errors', () => {
  it.each([403, 409])('keeps the server error visible and refreshes invitations after HTTP %i', async status => {
    const invitation = {
      id: 12,
      team: { id: 8, name: 'Northside FC', sportTypeId: 1 },
      invitedBy: { id: 4, fullName: 'Lee Captain', avatarUrl: null },
      expiresAt: '2026-12-01T00:00:00.000Z',
    }
    getMyTeams.mockResolvedValue({ items: [] })
    getMyInvitations.mockResolvedValueOnce({ items: [invitation] }).mockResolvedValue({ items: [] })
    answerInvitation.mockRejectedValue(Object.assign(new Error('Invitation expired'), { status }))

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><TeamsPage /></MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Accept invitation' }))
    expect(await screen.findByText('Invitation expired')).toBeInTheDocument()
    await waitFor(() => expect(getMyInvitations).toHaveBeenCalledTimes(2))

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['teams', 'backend', 'invitations'] })
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument()
    expect(screen.getByText('Invitation expired')).toBeInTheDocument()
    client.clear()
  })

  it.each([
    { accept: true, button: 'Accept invitation', notice: 'You joined Northside FC.' },
    { accept: false, button: 'Decline', notice: 'Declined the invitation from Northside FC.' },
  ])('keeps the $button confirmation after the invitation disappears', async ({ accept, button, notice }) => {
    getMyTeams.mockResolvedValue({ items: [] })
    getMyInvitations.mockResolvedValueOnce({ items: [{
      id: 12,
      team: { id: 8, name: 'Northside FC', sportTypeId: 1 },
      invitedBy: { id: 4, fullName: 'Lee Captain', avatarUrl: null },
      expiresAt: '2026-12-01T00:00:00.000Z',
    }] }).mockResolvedValue({ items: [] })
    answerInvitation.mockResolvedValue(undefined)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><TeamsPage /></MemoryRouter></QueryClientProvider>)

    fireEvent.click(await screen.findByRole('button', { name: button }))
    await waitFor(() => expect(screen.queryByRole('button', { name: button })).not.toBeInTheDocument())
    expect(answerInvitation).toHaveBeenCalledExactlyOnceWith(12, accept)
    expect(screen.getByRole('status')).toHaveTextContent(notice)
    expect(screen.getByText('No invitations right now.')).toBeInTheDocument()
    client.clear()
  })
})
