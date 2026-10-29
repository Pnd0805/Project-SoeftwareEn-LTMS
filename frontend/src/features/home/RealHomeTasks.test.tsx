import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchAdminRequests, state } = vi.hoisted(() => ({
  fetchAdminRequests: vi.fn(),
  state: {
    currentUser: { id: 7, adminScope: { scopeType: 'university_wide' } } as { id: number; adminScope?: { scopeType: string } } | undefined,
    invitations: { data: { items: [{
      id: 3,
      team: { id: 8, name: 'Northside FC', sportTypeId: 1 },
      invitedBy: { id: 4, fullName: 'Lee Captain', avatarUrl: null },
      expiresAt: '2026-12-01T00:00:00.000Z',
    }] }, isPending: false, isError: false, refetch: vi.fn() },
    teams: { data: { items: [{
      id: 7, name: 'Team 7', sportTypeId: 1, readinessStatus: 'Forming',
      officialStatus: 'Unofficial', memberCount: 2, role: 'leader',
    }] }, isPending: false, isError: false, refetch: vi.fn() },
    refereeInvitations: { data: { items: [{
      id: 12,
      tournament: { id: 9, name: 'Campus Cup', sportTypeId: 1, eventStartDate: '2026-10-12' },
      isExternal: false,
      createdAt: '2026-10-01T00:00:00.000Z',
    }] }, isPending: false, isError: false, refetch: vi.fn() },
    refereeRequests: { data: { incoming: [{
      id: 41,
      tournamentId: 9,
      type: 'org_add_match',
      requestedBy: 84,
      refereeA: { tournamentRefereeId: 11, user: { id: 22, fullName: 'Referee A', avatarUrl: null }, status: 'active' },
      refereeB: null,
      matchA: { id: 45, roundNumber: 2, scheduledTime: null, scheduledEndTime: null },
      matchB: null,
      status: 'open',
      createdAt: '2026-10-01T00:00:00.000Z',
      resolvedAt: null,
    }], outgoing: [] }, isPending: false, isError: false, refetch: vi.fn() },
    matches: { data: { items: [{
      id: 52,
      tournament: { id: 9, name: 'Campus Cup' },
      viewer: { can: { openCheckin: true, submitResult: false } },
    }] }, isPending: false, isError: false, refetch: vi.fn() },
    tournaments: { data: { items: [{ id: 6, name: 'Private Cup', status: 'private', deletedAt: null }] }, isPending: false, isError: false, refetch: vi.fn() },
    adminAccess: { data: false as boolean | undefined, isPending: false, isError: false, refetch: vi.fn() },
  },
}))

vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../api/admin', async original => ({
  ...await original<typeof import('../../api/admin')>(),
  getPendingTournamentRequests: fetchAdminRequests,
}))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: state.currentUser }) }))
vi.mock('../../shared/store', async original => ({
  ...await original<typeof import('../../shared/store')>(),
  useLtms: () => ({}),
}))
vi.mock('../../hooks/useTeam', () => ({
  useBackendMyInvitations: () => state.invitations,
  useBackendMyTeams: () => state.teams,
}))
vi.mock('../../hooks/useAdmin', async original => ({
  ...await original<typeof import('../../hooks/useAdmin')>(),
  useAdminAccess: () => state.adminAccess,
  useMyRefereeInvitations: () => state.refereeInvitations,
  useMyRefereeRequests: () => state.refereeRequests,
}))
vi.mock('../../hooks/useMatch', () => ({ useMyMatches: () => state.matches }))
vi.mock('../../hooks/useTournament', () => ({
  useTournaments: () => ({ data: { items: [] }, isPending: false, isError: false }),
  useMyTournaments: () => state.tournaments,
  useMyTournamentApplications: () => ({ data: { items: [] } }),
}))
vi.mock('../../hooks/useReference', () => ({ useSportTypes: () => ({ data: { items: [] } }) }))

import { HomePage } from './HomePage'

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(<QueryClientProvider client={client}><MemoryRouter><HomePage /></MemoryRouter></QueryClientProvider>)
  return { ...view, client }
}

describe('real Home tasks', () => {
  beforeEach(() => {
    state.currentUser = { id: 7, adminScope: { scopeType: 'university_wide' } }
    state.invitations.isPending = false
    state.invitations.isError = false
    state.invitations.refetch.mockReset()
    state.invitations.data = { items: [{
      id: 3,
      team: { id: 8, name: 'Northside FC', sportTypeId: 1 },
      invitedBy: { id: 4, fullName: 'Lee Captain', avatarUrl: null },
      expiresAt: '2026-12-01T00:00:00.000Z',
    }] }
    state.teams.isPending = false
    state.teams.isError = false
    state.teams.refetch.mockReset()
    state.teams.data = { items: [{
      id: 7, name: 'Team 7', sportTypeId: 1, readinessStatus: 'Forming',
      officialStatus: 'Unofficial', memberCount: 2, role: 'leader',
    }] }
    state.refereeInvitations.isPending = false
    state.refereeInvitations.isError = false
    state.refereeInvitations.refetch.mockReset()
    state.refereeRequests.isPending = false
    state.refereeRequests.isError = false
    state.refereeRequests.refetch.mockReset()
    state.matches.isPending = false
    state.matches.isError = false
    state.matches.refetch.mockReset()
    state.tournaments.isPending = false
    state.tournaments.isError = false
    state.tournaments.refetch.mockReset()
    state.adminAccess = { data: false, isPending: false, isError: false, refetch: vi.fn() }
    fetchAdminRequests.mockReset()
  })

  it('shows invitation and team tasks for a signed-in viewer in real mode', () => {
    renderHome()

    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Accept.*Northside FC/ })).toHaveAttribute('href', '/teams')
    expect(screen.getByRole('link', { name: /Complete team.*Team 7/ })).toHaveAttribute('href', '/team/7')
  })

  it('does not mount the personal task list for a guest', () => {
    state.currentUser = undefined
    renderHome()

    expect(screen.queryByRole('heading', { name: 'Needs you' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tournaments' })).toBeInTheDocument()
  })

  it('renders referee, match, and organizer work from their independent domain feeds', () => {
    renderHome()

    expect(screen.getByRole('link', { name: /Accept.*Campus Cup/ })).toHaveAttribute('href', '/matches')
    expect(screen.getByRole('link', { name: /Review.*Tournament 9 · Match 45/ })).toHaveAttribute('href', '/inbox')
    expect(screen.getByRole('link', { name: /Open check-in.*Campus Cup · Match 52/ })).toHaveAttribute('href', '/checkin/52')
    expect(screen.getByRole('link', { name: /Continue setup.*Private Cup/ })).toHaveAttribute('href', '/t/6/manage/progress')
  })

  it('keeps Admin requests disabled until access is confirmed, then loads the Admin feed', async () => {
    fetchAdminRequests.mockResolvedValue({ items: [{
      id: 77,
      name: 'Pending Cup',
      requestedBy: { id: 99, fullName: 'Organizer', avatarUrl: null },
      sportTypeId: 1,
      eventStartDate: '2026-12-01',
      createdAt: '2026-10-01T00:00:00.000Z',
    }] })
    state.adminAccess = { data: undefined, isPending: true, isError: false, refetch: vi.fn() }
    const view = renderHome()

    expect(fetchAdminRequests).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: /Review.*Pending Cup/ })).not.toBeInTheDocument()

    state.adminAccess = { data: true, isPending: false, isError: false, refetch: vi.fn() }
    view.rerender(<QueryClientProvider client={view.client}><MemoryRouter><HomePage /></MemoryRouter></QueryClientProvider>)

    expect(await screen.findByRole('link', { name: /Review.*Pending Cup/ })).toHaveAttribute('href', '/admin/requests')
    expect(fetchAdminRequests).toHaveBeenCalledOnce()
    view.client.clear()
  })

  it('does not fetch or show Admin requests after access is denied, while keeping organizer work', () => {
    state.adminAccess = { data: undefined, isPending: false, isError: true, refetch: vi.fn() }

    renderHome()

    expect(fetchAdminRequests).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: /Review.*Pending Cup/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Continue setup.*Private Cup/ })).toBeInTheDocument()
  })

  it('does not fetch Admin requests after access is confirmed false, while keeping organizer work', () => {
    fetchAdminRequests.mockResolvedValue({ items: [{
      id: 77,
      name: 'Pending Cup',
      requestedBy: { id: 99, fullName: 'Organizer', avatarUrl: null },
      sportTypeId: 1,
      eventStartDate: '2026-12-01',
      createdAt: '2026-10-01T00:00:00.000Z',
    }] })
    state.adminAccess = { data: false, isPending: false, isError: false, refetch: vi.fn() }

    renderHome()

    expect(fetchAdminRequests).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: /Review.*Pending Cup/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Continue setup.*Private Cup/ })).toBeInTheDocument()
  })

  it('retries only a failed referee feed while keeping successful team work visible', () => {
    const refetches = {
      invitations: vi.fn(),
      teams: vi.fn(),
      refereeInvitations: vi.fn(),
      refereeRequests: vi.fn(),
      matches: vi.fn(),
      tournaments: vi.fn(),
    }
    state.invitations.refetch = refetches.invitations
    state.teams.refetch = refetches.teams
    state.refereeInvitations.isError = true
    state.refereeInvitations.refetch = refetches.refereeInvitations
    state.refereeRequests.refetch = refetches.refereeRequests
    state.matches.refetch = refetches.matches
    state.tournaments.refetch = refetches.tournaments

    renderHome()

    expect(screen.getByRole('alert')).toHaveTextContent('Some work could not load')
    expect(screen.getByRole('button', { name: 'Retry Referee invitations' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Complete team.*Team 7/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry Referee invitations' }))

    expect(refetches.refereeInvitations).toHaveBeenCalledOnce()
    expect(Object.values(refetches).filter(refetch => refetch.mock.calls.length > 0)).toEqual([refetches.refereeInvitations])
    expect(fetchAdminRequests).not.toHaveBeenCalled()
  })

  it('identifies simultaneous Team and Referee failures by the work that failed', () => {
    const failedFeeds = [state.invitations, state.teams, state.refereeInvitations, state.refereeRequests]
    failedFeeds.forEach(feed => { feed.isError = true })

    renderHome()

    for (const label of ['Team invitations', 'Team readiness', 'Referee invitations', 'Referee requests']) {
      expect(screen.getByText(label)).toBeVisible()
      expect(screen.getByRole('button', { name: `Retry ${label}` })).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Retry Team readiness' }))
    expect(state.teams.refetch).toHaveBeenCalledOnce()
    expect(state.invitations.refetch).not.toHaveBeenCalled()
    expect(state.refereeInvitations.refetch).not.toHaveBeenCalled()
    expect(state.refereeRequests.refetch).not.toHaveBeenCalled()
  })
})
