import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const { membersHook, myTeamsHook, applicationsHook } = vi.hoisted(() => ({
  membersHook: vi.fn(() => ({ isPending: false, isError: false, data: undefined })),
  myTeamsHook: vi.fn(() => ({ data: undefined })),
  applicationsHook: vi.fn(() => ({ data: undefined })),
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

describe('TeamPage guest access', () => {
  it('shows public team information without calling authenticated team endpoints', () => {
    render(
      <MemoryRouter initialEntries={['/team/42']}>
        <Routes><Route path="/team/:id" element={<TeamPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(screen.getAllByText('Public Campus FC')).toHaveLength(2)
    expect(screen.getByText('Captain Public')).toBeInTheDocument()
    expect(screen.getByText("Sign in to view this squad's roster.")).toBeInTheDocument()
    expect(membersHook).toHaveBeenCalledWith(42, false)
    expect(myTeamsHook).toHaveBeenCalledWith(false)
    expect(applicationsHook).toHaveBeenCalledWith(false)
  })
})
