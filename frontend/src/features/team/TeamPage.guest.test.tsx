vi.mock('./JoinRequestsPanel', () => ({ JoinRequestsPanel: () => null }))
vi.mock('./LeaveTeamPanel', () => ({ LeaveTeamPanel: () => null }))
import { render } from '../../test/renderWithQueryClient'
import { fireEvent, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { membersHook, myTeamsHook, applicationsHook } = vi.hoisted(() => ({
  membersHook: vi.fn(),
  myTeamsHook: vi.fn(),
  applicationsHook: vi.fn(),
}))

vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(), USE_MOCK: false,
}))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: undefined }) }))
vi.mock('../../shared/store', () => ({ useLtms: () => ({}), getState: () => ({}) }))
vi.mock('../../hooks/useReference', () => ({
  useSportTypes: () => ({ data: { items: [{ id: 1, name: 'Football', minMembers: 5 }] } }),
}))
vi.mock('../../hooks/useUser', () => ({
  useFollow: () => ({ isFollowing: false, toggle: { mutate: vi.fn(), isPending: false } }),
  useSearchUsers: () => ({ data: { items: [] } }),
}))
vi.mock('../../hooks/useTournament', () => ({
  useMyTournamentApplications: applicationsHook,
  useTournamentsByIds: () => [],
}))
vi.mock('./TeamManage', () => ({ TeamManage: () => <div>Team management</div> }))
vi.mock('../tournament/EnterTournamentButton', () => ({ EnterTournamentButton: () => <button>Enter tournament</button> }))
vi.mock('../../hooks/useTeam', () => ({
  useBackendTeam: () => ({
    isPending: false, isError: false,
    data: {
      id: 42, name: 'Public Campus FC', sportTypeId: 1,
      readinessStatus: 'Ready', officialStatus: 'Official', memberCount: 8,
      leader: { id: 7, fullName: 'Captain Public' }, createdAt: '2026-09-01T00:00:00.000Z',
    },
  }),
  useBackendTeamMembers: membersHook,
  useBackendMyTeams: myTeamsHook,
  useKickMember: () => ({ isError: false }),
  useTransferLeader: () => ({ isError: false }),
  useSetMemberPosition: () => ({ isError: false }),
  useCancelTeamInvitation: () => ({}),
  useInviteMember: () => ({}),
  useTeamInvitations: () => ({}),
}))

import { TeamPage } from './TeamPage'

beforeEach(() => {
  vi.clearAllMocks()
  membersHook.mockReturnValue({ isPending: false, isError: false, data: undefined })
  myTeamsHook.mockReturnValue({ data: undefined })
  applicationsHook.mockReturnValue({ data: undefined })
})

function show() {
  return render(
    <MemoryRouter initialEntries={['/team/42']}>
      <Routes>
        <Route path="/team/:id" element={<TeamPage />} />
        <Route path="/" element={<h1>Public tournaments</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TeamPage guest access', () => {
  it('shows public team information without calling authenticated team endpoints', () => {
    show()

    expect(screen.getAllByText('Public Campus FC')).toHaveLength(2)
    expect(screen.getByText('Captain Public')).toBeInTheDocument()
    expect(screen.getByText("Sign in to view this squad's roster.")).toBeInTheDocument()
    expect(membersHook).toHaveBeenCalledWith(42, false)
    expect(myTeamsHook).toHaveBeenCalledWith(false)
    expect(applicationsHook).toHaveBeenCalledWith(false)
  })

  it('names the public team with an h1 and keeps the Guest Tournaments parent', () => {
    show()
    const heading = screen.getByRole('heading', { level: 1, name: 'Public Campus FC' })
    expect(heading.closest('span')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Tournaments/ }))
    expect(screen.getByRole('heading', { name: 'Public tournaments' })).toBeInTheDocument()
  })

  it.each([
    ['disabled pending', { isPending: true }],
    ['cached empty success', { isSuccess: true, data: { items: [] } }],
    ['cached permission error', { isError: true, error: { status: 403 } }],
    ['cached network error', { isError: true, error: new Error('Private roster failure') }],
    ['cached private rows', {
      isSuccess: true,
      data: { items: [{ userId: 99, fullName: 'Private Cached Player', joinedAt: '2026-09-01' }] },
    }],
  ])('shows only the public access explanation for %s', (_name, state) => {
    membersHook.mockReturnValue(state)
    show()
    expect(screen.getByText("Sign in to view this squad's roster.")).toBeInTheDocument()
    expect(screen.queryByText('Loading members…')).not.toBeInTheDocument()
    expect(screen.queryByText('No members found.')).not.toBeInTheDocument()
    expect(screen.queryByText('You do not have access to this roster.')).not.toBeInTheDocument()
    expect(screen.queryByText('Private roster failure')).not.toBeInTheDocument()
    expect(screen.queryByText('Private Cached Player')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('does not expose leader panels from cached private membership while signed out', () => {
    myTeamsHook.mockReturnValue({ data: { items: [{ id: 42, role: 'leader' }] } })
    show()
    expect(screen.queryByText('Add players')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Search users to invite')).not.toBeInTheDocument()
  })
})
