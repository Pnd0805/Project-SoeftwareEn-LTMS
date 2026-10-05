import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendMyInvitationDto, BackendMyTeamDto } from '../../types/team.dto'
import type { BackendMyApplicationDto } from '../../types/tournament.dto'

type Source<T> = {
  data: { items: T[] } | undefined
  isPending: boolean
  isError: boolean
  isSuccess: boolean
  error: Error | null
  refetch: ReturnType<typeof vi.fn>
}

const state = vi.hoisted(() => {
  const source = <T,>(): Source<T> => ({
    data: { items: [] }, isPending: false, isError: false, isSuccess: true,
    error: null, refetch: vi.fn(),
  })
  return {
    teams: source<BackendMyTeamDto>(), invitations: source<BackendMyInvitationDto>(),
    entries: source<BackendMyApplicationDto>(),
    answer: { isError: false, isPending: false, error: null as Error | null, mutate: vi.fn() },
    cancel: { isError: false, isPending: false, error: null as Error | null, mutate: vi.fn() },
    withdraw: { isError: false, isPending: false, error: null as Error | null, mutate: vi.fn(), mutateAsync: vi.fn() },
  }
})

vi.mock('../../api/client', () => ({ USE_MOCK: false }))
vi.mock('../../hooks/useTeam', () => ({
  useBackendMyTeams: () => state.teams,
  useBackendMyInvitations: () => state.invitations,
  useAnswerBackendInvitation: () => state.answer,
  useCreateTeam: () => ({ isError: false, reset: vi.fn() }),
}))
vi.mock('../../hooks/useTournament', () => ({
  useMyTournamentApplications: () => state.entries,
  useCancelMyApplication: () => state.cancel,
  useWithdrawMyApplication: () => state.withdraw,
}))
vi.mock('../../hooks/useReference', () => ({ useSportTypes: () => ({ data: { items: [] } }) }))
vi.mock('../../hooks/useLiveEngagement', () => ({ useReviews: () => ({ query: { isPending: false, isError: false } }) }))
vi.mock('../tournament/EnterTournamentButton', () => ({ EnterTournamentButton: () => null }))

import { TeamsPage } from './TeamsPage'

const team: BackendMyTeamDto = {
  id: 8, name: 'Northside FC', sportTypeId: 1, readinessStatus: 'Forming',
  officialStatus: 'Unofficial', memberCount: 2, role: 'leader',
}
const invitation: BackendMyInvitationDto = {
  id: 12, team: { id: 9, name: 'Byte Force', sportTypeId: 1 },
  invitedBy: { id: 4, fullName: 'Lee Captain', avatarUrl: null }, expiresAt: '2026-12-01T00:00:00.000Z',
}
const entry: BackendMyApplicationDto = {
  id: 20, tournament: { id: 7, name: 'Autumn Cup' }, team: { id: 8, name: 'Northside FC' },
  status: 'pending', rejectionReason: null, appliedAt: '2026-10-01T00:00:00.000Z',
}
const show = () => render(<MemoryRouter><TeamsPage /></MemoryRouter>)
const pending = <T,>(source: Source<T>) => Object.assign(source, { data: undefined, isPending: true, isError: false, isSuccess: false })
const failed = <T,>(source: Source<T>, message: string, status = 500) => Object.assign(source, {
  data: undefined, isPending: false, isError: true, isSuccess: false,
  error: Object.assign(new Error(message), { status }),
})

beforeEach(() => {
  vi.clearAllMocks()
  for (const source of [state.teams, state.invitations, state.entries]) {
    Object.assign(source, { data: { items: [] }, isPending: false, isError: false, isSuccess: true, error: null })
  }
  for (const mutation of [state.answer, state.cancel, state.withdraw]) Object.assign(mutation, { isError: false, error: null })
})

describe('TeamsPage independent sources', () => {
  it.each([401, 403])('does not expose cached private sources after HTTP %i', status => {
    failed(state.teams, 'Teams denied', status)
    failed(state.invitations, 'Invitations denied', status)
    failed(state.entries, 'Entries denied', status)
    state.teams.data = { items: [team] }
    state.invitations.data = { items: [invitation] }
    state.entries.data = { items: [entry] }
    show()
    expect(screen.queryByText('Northside FC')).not.toBeInTheDocument()
    expect(screen.queryByText('Byte Force')).not.toBeInTheDocument()
    expect(screen.queryByText('Autumn Cup')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(3)
  })

  it('keeps the heading and usable invitations and entries when teams fail', () => {
    failed(state.teams, 'Teams unavailable')
    state.invitations.data = { items: [invitation] }
    state.entries.data = { items: [entry] }
    show()
    expect(screen.getByRole('heading', { name: 'Teams', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeEnabled()
    expect(screen.getByText('Autumn Cup')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByText(/Accepting shares your faculty/)).toBeInTheDocument()
    expect(screen.queryByText("You're not in a squad yet")).not.toBeInTheDocument()
  })

  it('keeps each loading source distinct without reporting empty data', () => {
    pending(state.teams)
    pending(state.invitations)
    pending(state.entries)
    show()
    expect(screen.getByRole('heading', { name: 'Teams', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Loading your teams…')).toHaveAttribute('role', 'status')
    expect(screen.getByText('Loading invitations…')).toHaveAttribute('role', 'status')
    expect(screen.getByText('Loading entries…')).toHaveAttribute('role', 'status')
    expect(screen.queryByText("You're not in a squad yet")).not.toBeInTheDocument()
    expect(screen.queryByText('No invitations right now.')).not.toBeInTheDocument()
    expect(screen.queryByText('No tournament entries yet.')).not.toBeInTheDocument()
  })

  it('retains teams while invitations load and entries fail', () => {
    state.teams.data = { items: [team] }
    pending(state.invitations)
    failed(state.entries, 'Entries unavailable')
    show()
    expect(screen.getByText('Northside FC')).toBeInTheDocument()
    expect(screen.getByText('Loading invitations…')).toBeInTheDocument()
    expect(screen.getByText('Entries unavailable')).toBeInTheDocument()
    expect(screen.queryByText('No invitations right now.')).not.toBeInTheDocument()
    expect(screen.queryByText('No tournament entries yet.')).not.toBeInTheDocument()
  })

  it('names simultaneous errors and retries only the selected source', () => {
    failed(state.teams, 'Teams unavailable')
    failed(state.invitations, 'Invitations unavailable')
    failed(state.entries, 'Entries unavailable')
    show()
    for (const [name, source] of [['teams', state.teams], ['invitations', state.invitations], ['entries', state.entries]] as const) {
      fireEvent.click(screen.getByRole('button', { name: `Retry ${name}` }))
      expect(source.refetch).toHaveBeenCalledTimes(1)
      for (const other of [state.teams, state.invitations, state.entries]) {
        if (other !== source) expect(other.refetch).not.toHaveBeenCalled()
      }
      vi.clearAllMocks()
    }
    expect(screen.getAllByRole('alert')).toHaveLength(3)
  })

  it('shows each empty source only after a successful settled read', () => {
    show()
    expect(screen.getByText("You're not in a squad yet")).toBeInTheDocument()
    expect(screen.getByText('No invitations right now.')).toBeInTheDocument()
    expect(screen.getByText('No tournament entries yet.')).toBeInTheDocument()
  })

  it('shows permission denial explicitly and keeps cached usable rows after a failed refresh', () => {
    failed(state.teams, 'Access denied', 403)
    failed(state.invitations, 'Refresh unavailable')
    state.invitations.data = { items: [invitation] }
    show()
    expect(screen.getByText('You cannot view your teams.')).toBeInTheDocument()
    expect(screen.getByText('Access denied')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeInTheDocument()
    expect(screen.queryByText('No invitations right now.')).not.toBeInTheDocument()
  })

  it('retains mutation errors after entry rows disappear', () => {
    state.entries.data = { items: [entry] }
    const view = show()
    expect(screen.getByText('Autumn Cup')).toBeInTheDocument()
    state.entries.data = { items: [] }
    Object.assign(state.cancel, { isError: true, error: new Error('Cancellation rejected') })
    Object.assign(state.withdraw, { isError: true, error: new Error('Withdrawal rejected') })
    view.rerender(<MemoryRouter><TeamsPage /></MemoryRouter>)
    expect(screen.queryByText('Autumn Cup')).not.toBeInTheDocument()
    expect(screen.getByText('Cancellation rejected')).toBeInTheDocument()
    expect(screen.getByText('Withdrawal rejected')).toBeInTheDocument()
  })
})
