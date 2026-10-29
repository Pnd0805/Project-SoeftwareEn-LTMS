vi.mock('./JoinRequestsPanel', () => ({ JoinRequestsPanel: () => null }))
vi.mock('./LeaveTeamPanel', () => ({ LeaveTeamPanel: () => null }))
import { render } from '../../test/renderWithQueryClient'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { membersHook, myTeamsHook, applicationsHook, invitationsHook, kick, transfer, invite, cancel } = vi.hoisted(() => ({
  membersHook: vi.fn(), myTeamsHook: vi.fn(), applicationsHook: vi.fn(),
  invitationsHook: vi.fn(), kick: vi.fn(), transfer: vi.fn(), invite: vi.fn(), cancel: vi.fn(),
}))
vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(), USE_MOCK: false,
}))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 7 } }) }))
vi.mock('../../shared/store', () => ({ useLtms: () => ({}), getState: () => ({}) }))
vi.mock('../../hooks/useReference', () => ({
  useSportTypes: () => ({ data: { items: [{ id: 1, name: 'Football', minMembers: 2 }] } }),
}))
vi.mock('../../hooks/useUser', () => ({
  useFollow: () => ({ isFollowing: false, toggle: { mutate: vi.fn(), isPending: false } }),
  useSearchUsers: () => ({ isSuccess: true, data: { items: [
    { id: 13, fullName: 'Dena Player' }, { id: 14, fullName: 'Evan Player' },
  ] } }),
}))
vi.mock('../../hooks/useTournament', () => ({ useMyTournamentApplications: applicationsHook }))
vi.mock('./TeamManage', () => ({ TeamManage: () => <div>Team management</div> }))
vi.mock('../tournament/EnterTournamentButton', () => ({ EnterTournamentButton: () => <button>Enter tournament</button> }))
vi.mock('../../hooks/useTeam', () => ({
  useBackendTeam: () => ({ isSuccess: true, data: {
    id: 42, name: 'Campus FC', sportTypeId: 1, readinessStatus: 'Ready', officialStatus: 'Official',
    memberCount: 3, maxMembers: 12, leader: { id: 7, fullName: 'Captain Campus' },
  } }),
  useBackendTeamMembers: membersHook, useBackendMyTeams: myTeamsHook,
  useKickMember: () => ({ isError: false, isPending: false, reset: vi.fn(), mutate: kick }),
  useTransferLeader: () => ({ isError: false, isPending: false, reset: vi.fn(), mutate: transfer }),
  useInviteMember: () => ({ isError: false, isPending: false, reset: vi.fn(), mutate: invite }),
  useCancelTeamInvitation: () => ({ isError: false, mutate: cancel }),
  useTeamInvitations: invitationsHook,
}))
import { TeamPage } from './TeamPage'

const rows = [
  { userId: 7, fullName: 'Captain Campus', joinedAt: '2026-09-01' },
  { userId: 11, fullName: 'Bob Member', joinedAt: '2026-09-01' },
  { userId: 12, fullName: 'Cara Member', joinedAt: '2026-09-01' },
]
beforeEach(() => {
  vi.clearAllMocks()
  membersHook.mockReturnValue({ isSuccess: true, data: { items: rows } })
  myTeamsHook.mockReturnValue({ data: { items: [{ id: 42, role: 'leader' }] } })
  applicationsHook.mockReturnValue({ data: { items: [] } })
  invitationsHook.mockReturnValue({ isSuccess: true, data: { items: [] } })
})
function TeamRoutes() {
  return (
    <MemoryRouter initialEntries={['/team/42']}>
      <Routes>
        <Route path="/team/:id" element={<TeamPage />} />
        <Route path="/teams" element={<h1>Personal Teams</h1>} />
        <Route path="/player/:id" element={<h1>Public player profile</h1>} />
      </Routes>
    </MemoryRouter>
  )
}
function show() {
  return render(<TeamRoutes />)
}

describe('TeamPage identity and contextual actions', () => {
  it('defaults to Members and shows one named workspace panel at a time', () => {
    show()
    expect(screen.getByRole('tab', { name: 'Members' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel', { name: 'Members' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Invite Dena Player' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Manage' }))
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel', { name: 'Manage' })).toHaveTextContent('Team management')
    expect(screen.queryByRole('button', { name: 'Remove Bob Member' })).not.toBeInTheDocument()
  })

  it('keeps the invitation draft when switching away and returning', () => {
    show()
    fireEvent.click(screen.getByRole('tab', { name: 'Invites' }))
    fireEvent.change(screen.getByLabelText('Search users to invite'), { target: { value: 'Dena' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Manage' }))
    expect(screen.getByLabelText('Search users to invite')).not.toBeVisible()
    expect(screen.queryByRole('button', { name: 'Invite Dena Player' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Invites' }))
    expect(screen.getByLabelText('Search users to invite')).toBeVisible()
    expect(screen.getByLabelText('Search users to invite')).toHaveValue('Dena')
  })

  it('activates tabs with arrow keys and skips hidden controls on Tab', async () => {
    const user = userEvent.setup()
    show()
    await user.click(screen.getByRole('tab', { name: 'Members' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Invites' })).toHaveFocus()
    expect(screen.getByRole('tabpanel', { name: 'Invites' })).toBeVisible()
    await user.keyboard('{ArrowRight}{Tab}')
    expect(screen.getByRole('tabpanel', { name: 'Manage' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Remove Bob Member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invite Dena Player' })).not.toBeInTheDocument()
  })

  it('removes an active private panel and its draft when leader permission is revoked', () => {
    const view = show()
    fireEvent.click(screen.getByRole('tab', { name: 'Invites' }))
    fireEvent.change(screen.getByLabelText('Search users to invite'), { target: { value: 'Dena' } })
    myTeamsHook.mockReturnValue({ data: { items: [{ id: 42, role: 'leader' }] }, isError: true, error: { status: 403 } })
    view.rerender(<TeamRoutes />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Search users to invite')).not.toBeInTheDocument()
    expect(screen.queryByText('Team management')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile for Bob Member' })).toBeVisible()
    myTeamsHook.mockReturnValue({ data: { items: [{ id: 42, role: 'leader' }] } })
    view.rerender(<TeamRoutes />)
    expect(screen.getByRole('tab', { name: 'Members' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Invites' }))
    expect(screen.getByLabelText('Search users to invite')).toHaveValue('')
  })

  it('uses a valid Team h1 and returns signed-in viewers to Teams', () => {
    show()
    const heading = screen.getByRole('heading', { level: 1, name: 'Campus FC' })
    expect(heading.closest('span')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Teams/ }))
    expect(screen.getByRole('heading', { name: 'Personal Teams' })).toBeInTheDocument()
  })

  it('identifies each repeated roster action and opens the chosen Profile', () => {
    show()
    for (const name of ['Bob Member', 'Cara Member']) {
      expect(screen.getByRole('button', { name: `Remove ${name}` })).toBeEnabled()
      expect(screen.getByRole('button', { name: `Hand over captaincy to ${name}` })).toBeEnabled()
      expect(screen.getByRole('button', { name: `Profile for ${name}` })).toBeEnabled()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Profile for Cara Member' }))
    expect(screen.getByRole('heading', { name: 'Public player profile' })).toBeInTheDocument()
  })

  it('names invitations and preserves the selected player payload', () => {
    show()
    fireEvent.click(screen.getByRole('tab', { name: 'Invites' }))
    fireEvent.change(screen.getByLabelText('Search users to invite'), { target: { value: 'Player' } })
    expect(screen.getByRole('button', { name: 'Invite Evan Player' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Invite Dena Player' }))
    expect(invite).toHaveBeenCalledWith({ userId: 13 }, expect.any(Object))
  })

  it('retains Remove confirmation and its player payload', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bob Member' }))
    expect(screen.getByRole('dialog', { name: 'Remove Bob Member?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(kick).toHaveBeenCalledWith(11, expect.any(Object))
  })

  it('retains deferred Hand over wording and its player payload', () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Hand over captaincy to Bob Member' }))
    expect(screen.getByRole('dialog', { name: 'Make Bob Member the captain?' })).toHaveTextContent(
      'Request admin approval to make Bob Member the leader. The current leader keeps their rights until approval.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Hand over' }))
    expect(transfer).toHaveBeenCalledWith({ targetUserId: 11 }, expect.any(Object))
  })

  it('keeps approved-entry roster locks and captain protections', () => {
    applicationsHook.mockReturnValue({ data: { items: [
      { team: { id: 42 }, status: 'approved', tournament: { id: 9, name: 'Campus Cup' } },
    ] } })
    show()
    expect(screen.getByRole('button', { name: 'Remove Bob Member' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Remove Captain Campus' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hand over captaincy to Captain Campus' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Invites' }))
    expect(screen.queryByLabelText('Search users to invite')).not.toBeInTheDocument()
    expect(screen.getByText('Adding players is locked.')).toBeInTheDocument()
  })

  it.each([
    ['member', [{ id: 42, role: 'member' }]],
    ['authorized tournament staff outside the team', []],
  ])('allows a signed-in %s to read a permitted roster without leader controls', (_name, teams) => {
    myTeamsHook.mockReturnValue({ data: { items: teams } })
    show()
    expect(membersHook).toHaveBeenCalledWith(42, true)
    expect(screen.getByRole('button', { name: 'Profile for Bob Member' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Remove Bob Member' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Search users to invite')).not.toBeInTheDocument()
    expect(screen.queryByText("Sign in to view this squad's roster.")).not.toBeInTheDocument()
  })

  it('preserves a real signed-in permission refusal', () => {
    myTeamsHook.mockReturnValue({ data: { items: [] } })
    membersHook.mockReturnValue({ isError: true, error: { status: 403 } })
    show()
    expect(screen.getByText('You do not have access to this roster.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('focuses the invitation search only when roster editing is known to be unlocked', () => {
    applicationsHook.mockReturnValue({ isSuccess: true, data: { items: [] } })
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Invite players' }))
    expect(screen.getByRole('tab', { name: 'Invites' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Search users to invite')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Invite players' }))
    expect(screen.getByLabelText('Search users to invite')).toHaveFocus()
  })

  it('does not offer an invitation shortcut while entry status is unknown', () => {
    applicationsHook.mockReturnValue({ isError: true, error: new Error('Entries unavailable') })
    show()
    expect(screen.queryByRole('button', { name: 'Invite players' })).not.toBeInTheDocument()
  })

  it('hides a cached roster after a signed-in permission refusal', () => {
    myTeamsHook.mockReturnValue({ data: { items: [] } })
    membersHook.mockReturnValue({ data: { items: rows }, isError: true, error: { status: 403 } })
    show()
    expect(screen.getByText('You do not have access to this roster.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Profile for Bob Member' })).not.toBeInTheDocument()
  })

  it('keeps a cancellation outcome after its invitation disappears', () => {
    invitationsHook.mockReturnValue({ isSuccess: true, data: { items: [{ id: 51, invitedUser: { fullName: 'Evan Player' }, status: 'pending' }] } })
    cancel.mockImplementation((_id, options) => {
      invitationsHook.mockReturnValue({ isSuccess: true, data: { items: [] } })
      options?.onSuccess()
    })
    show()
    fireEvent.click(screen.getByRole('tab', { name: 'Invites' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel invitation to Evan Player' }))
    expect(screen.queryByRole('button', { name: 'Cancel invitation to Evan Player' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Invitation to Evan Player cancelled.')
    expect(cancel).toHaveBeenCalledWith(51, expect.any(Object))
  })

  it('does not retain leader controls after the role source denies access', () => {
    myTeamsHook.mockReturnValue({ data: { items: [{ id: 42, role: 'leader' }] }, isError: true, error: { status: 403 } })
    show()
    expect(screen.queryByRole('button', { name: 'Remove Bob Member' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Search users to invite')).not.toBeInTheDocument()
    expect(screen.queryByText('Team management')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile for Bob Member' })).toBeEnabled()
  })
})
