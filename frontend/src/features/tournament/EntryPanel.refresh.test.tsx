import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TournamentDetailDto } from '../../types/tournament.dto'

const hooks = vi.hoisted(() => ({
  approved: vi.fn(), rules: vi.fn(), teams: vi.fn(), applications: vi.fn(), apply: vi.fn(),
}))
vi.mock('../../api/client', async original => ({ ...await original<typeof import('../../api/client')>(), USE_MOCK: false }))
vi.mock('../../hooks/useAuth', () => ({ useMe: () => ({ data: { id: 7 } }) }))
vi.mock('../../hooks/useTournament', () => ({
  useTournament: () => ready(dto), useTournamentTeams: hooks.approved,
  useEligibilityRules: hooks.rules, useMyTournamentApplications: hooks.applications,
  useApplyToTournament: () => ({ mutateAsync: hooks.apply, isPending: false }),
}))
vi.mock('../../hooks/useTeam', () => ({
  useBackendMyTeams: hooks.teams,
  useBackendTeamMembers: () => ready({ items: [
    { userId: 1, fullName: 'Alice', joinedAt: '2026-09-18T00:00:00Z' },
    { userId: 2, fullName: 'Bob', joinedAt: '2026-09-18T00:00:00Z' },
  ] }),
}))
vi.mock('../../hooks/useMatch', () => ({ useTournamentWinner: () => ({ data: undefined }) }))
vi.mock('../../hooks/useReference', () => ({
  useFaculties: () => ready({ items: [] }),
  useSportTypes: () => ready({ items: [{ id: 3, name: 'Badminton', defaultMode: 'onsite', minMembers: 1, maxMembers: 2 }] }),
}))
vi.mock('../../shared/store', async original => ({
  ...await original<typeof import('../../shared/store')>(),
  useLtms: () => ({ tournaments: [], registrations: [] }),
}))
vi.mock('../../shared/selectors', () => ({
  me: () => null, regsOf: () => [], squadsFor: () => [], team: () => null,
  user: () => null, matchesOf: () => [], isOrg: () => false, visibleTo: () => true,
}))
vi.mock('./BracketTab', () => ({ BracketTab: () => null }))
vi.mock('./ScheduleTab', () => ({ ScheduleTab: () => null }))
vi.mock('./DashboardTab', () => ({ DashboardTab: () => null }))
vi.mock('./LeaderboardTab', () => ({ LeaderboardTab: () => null }))
vi.mock('./AnnouncementsTab', () => ({ AnnouncementsTab: () => null }))
vi.mock('./CommunityTab', () => ({ CommunityTab: () => null }))
vi.mock('./LiveCommunityTab', () => ({ LiveCommunityTab: () => null }))
vi.mock('./manage/ManageTab', () => ({ ManageTab: () => null }))

import { ApiError } from '../../api/client'
import { TournamentPage } from './TournamentPage'

const dto: TournamentDetailDto = {
  id: 42, name: 'Campus Cup', sportTypeId: 3, bracketFormat: 'single_elimination',
  scopeType: 'university', organizingFacultyId: null, organizingDepartmentId: null,
  requestedByUserId: 7, status: 'public', registrationOpen: true,
  registrationStart: null, registrationEnd: null, eventStartDate: '2099-10-01',
  eventEndDate: null, maxTeams: 16, minTeams: 2, venue: 'Main Hall',
  disputeWindowHours: 24, genderRequirement: 'any', minAge: null, maxAge: null,
  rejectionReason: null, approvedBy: 1, approvedAt: null, createdAt: '2026-09-01', deletedAt: null,
  eligibilityRules: [], referees: [], applications: [], championTeamId: null, completedAt: null,
}
function ready<T>(data: T) {
  return { data, isPending: false, isError: false, error: null, refetch: vi.fn() }
}
function failed(error: unknown, data?: unknown) {
  return { data, isPending: false, isError: true, error, refetch: vi.fn() }
}
const httpError = (status: number) => new ApiError(status, { code: 'READ_FAILED', message: 'Read failed' })
const teamRows = { items: [{ id: 9, name: 'Ready Squad', sportTypeId: 3, readinessStatus: 'Ready', role: 'leader', memberCount: 2 }] }
function Page() {
  return <MemoryRouter initialEntries={['/t/42']}><Routes><Route path="/t/:id" element={<TournamentPage />} /></Routes></MemoryRouter>
}
async function openDraft() {
  const view = render(<Page />)
  fireEvent.click(screen.getByRole('button', { name: 'Register a squad' }))
  const dialog = await screen.findByRole('dialog', { name: 'Register a squad' })
  await waitFor(() => expect(within(dialog).getByLabelText('Team')).toHaveValue('9'))
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Enter Bob' }))
  expect(within(dialog).getByRole('status', { name: 'Selected players' })).toHaveTextContent('1 selected')
  return { view, dialog }
}
beforeEach(() => {
  vi.clearAllMocks()
  hooks.rules.mockReturnValue(ready({ items: [] }))
  hooks.approved.mockReturnValue(ready({ items: [] }))
  hooks.teams.mockReturnValue(ready(teamRows))
  hooks.applications.mockReturnValue(ready({ items: [{ id: 5, tournament: { id: 42 }, team: { name: 'My existing entry' }, status: 'approved' }] }))
})

describe('Entry refresh preserves an active real registration draft', () => {
  it.each(['rules', 'approved'] as const)('retains the mounted form, choices and personal entries after %s refresh fails', async source => {
    hooks.apply.mockRejectedValueOnce(new TypeError('Connection lost'))
    const { view, dialog } = await openDraft()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit registration' }))
    await within(dialog).findByText('Could not confirm registration. Check your entries before retrying.')
    const query = failed(new TypeError('offline'), { items: [] })
    hooks[source].mockReturnValue(query)
    view.rerender(<Page />)
    expect(screen.getByRole('dialog', { name: 'Register a squad' })).toBe(dialog)
    expect(within(dialog).getByRole('checkbox', { name: 'Enter Bob' })).toBeChecked()
    expect(within(dialog).getByRole('status', { name: 'Selected players' })).toHaveTextContent('1 selected')
    expect(screen.getByText('My existing entry')).toBeInTheDocument()
    expect(hooks.apply).toHaveBeenCalledExactlyOnceWith({ teamId: 9, playerIds: [2] })
    expect(within(dialog).getByText(/Entry availability is unconfirmed/).closest('[role="alert"]')).toBeInTheDocument()
    expect(within(dialog).getByText('Could not confirm registration. Check your entries before retrying.')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: source === 'rules' ? 'Retry entry rules' : 'Retry approved teams' }))
    expect(query.refetch).toHaveBeenCalledOnce()
    expect(hooks[source === 'rules' ? 'approved' : 'rules'].mock.results[0].value.refetch).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('checkbox', { name: 'Enter Bob' })).toBeChecked()
    hooks[source].mockReturnValue(ready({ items: [] }))
    view.rerender(<Page />)
    expect(screen.getByRole('dialog', { name: 'Register a squad' })).toBe(dialog)
    expect(within(dialog).getByRole('checkbox', { name: 'Enter Bob' })).toBeChecked()
    expect(within(dialog).getByText('Could not confirm registration. Check your entries before retrying.')).toBeInTheDocument()
    expect(hooks.apply).toHaveBeenCalledOnce()
    hooks[source].mockReturnValue(query)
    view.rerender(<Page />)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Register a squad' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: source === 'rules' ? 'Retry entry rules' : 'Retry approved teams' })).toBeInTheDocument()
    expect(screen.getByText('Entry availability is unconfirmed.')).toBeInTheDocument()
  })
  it.each([500, 'network'] as const)('retains the same form and choices after a %s team refresh failure', async status => {
    const { view, dialog } = await openDraft()
    const teams = failed(status === 'network' ? new TypeError('offline') : httpError(status), teamRows)
    hooks.teams.mockReturnValue(teams)
    view.rerender(<Page />)
    expect(screen.getByRole('dialog', { name: 'Register a squad' })).toBe(dialog)
    expect(within(dialog).getByRole('checkbox', { name: 'Enter Bob' })).toBeChecked()
    expect(within(dialog).getByRole('status', { name: 'Selected players' })).toHaveTextContent('1 selected')
    expect(hooks.apply).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry your squads' }))
    expect(teams.refetch).toHaveBeenCalledOnce()
    expect(within(dialog).getByRole('checkbox', { name: 'Enter Bob' })).toBeChecked()
    hooks.teams.mockReturnValue(ready(teamRows))
    view.rerender(<Page />)
    expect(screen.getByRole('dialog', { name: 'Register a squad' })).toBe(dialog)
    expect(within(dialog).getByRole('checkbox', { name: 'Enter Bob' })).toBeChecked()
    hooks.teams.mockReturnValue(teams)
    view.rerender(<Page />)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Register a squad' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry your squads' }))
    expect(teams.refetch).toHaveBeenCalledTimes(2)
  })
  it.each(['rules', 'approved', 'teams'] as const)('withdraws an active form on genuine %s access loss', async source => {
    const { view } = await openDraft()
    hooks[source].mockReturnValue(failed(httpError(403), source === 'teams' ? teamRows : { items: [] }))
    view.rerender(<Page />)
    expect(screen.queryByRole('dialog', { name: 'Register a squad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Register a squad' })).not.toBeInTheDocument()
    expect(hooks.apply).not.toHaveBeenCalled()
  })
  it('keeps personal entries when entry prerequisites have never loaded, without opening registration', () => {
    hooks.rules.mockReturnValue(failed(new TypeError('offline')))
    hooks.approved.mockReturnValue(failed(httpError(500)))
    render(<Page />)
    expect(screen.getByText('My existing entry')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Register a squad' })).not.toBeInTheDocument()
    expect(screen.queryByText('open to everybody')).not.toBeInTheDocument()
    expect(screen.queryByText('Open', { exact: true })).not.toBeInTheDocument()
  })
})
