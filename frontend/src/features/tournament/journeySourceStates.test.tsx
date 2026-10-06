import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tournament } from '../../shared/types'
import type { TournamentDetailDto } from '../../types/tournament.dto'

const hooks = vi.hoisted(() => ({
  mock: false,
  me: vi.fn(), tournaments: vi.fn(), tournament: vi.fn(), teams: vi.fn(), players: vi.fn(),
  approved: vi.fn(), eligibility: vi.fn(), myTeams: vi.fn(), applications: vi.fn(), matches: vi.fn(),
}))
vi.mock('../../api/client', async original => ({
  ...await original<typeof import('../../api/client')>(),
  get USE_MOCK() { return hooks.mock },
}))
vi.mock('../../hooks/useAuth', () => ({ useMe: hooks.me }))
vi.mock('../../hooks/useUser', () => ({ useSearchUsers: hooks.players }))
vi.mock('../../hooks/useTeam', () => ({ useSearchTeams: hooks.teams, useBackendMyTeams: hooks.myTeams }))
vi.mock('../../hooks/useTournament', () => ({
  useTournaments: hooks.tournaments, useTournament: hooks.tournament,
  useTournamentTeams: hooks.approved, useEligibilityRules: hooks.eligibility,
  useMyTournamentApplications: hooks.applications,
}))
vi.mock('../../hooks/useMatch', () => ({
  useTournamentMatches: hooks.matches, useTournamentWinner: () => ({ data: undefined }),
}))
vi.mock('../../hooks/useReference', () => ({
  useFaculties: () => ({ data: { items: [] } }),
  useSportTypes: () => ({ data: { items: [{ id: 3, name: 'Badminton', defaultMode: 'onsite' }] } }),
}))
vi.mock('../../shared/store', () => ({
  useLtms: () => ({ tournaments: [tournament], teams: [], registrations: [] }),
}))
vi.mock('../../shared/selectors', () => ({
  me: () => null, regsOf: () => [], squadsFor: () => [], team: () => null,
  user: () => null, matchesOf: () => [], isOrg: () => false, visibleTo: () => true,
}))
vi.mock('../../mocks/routeIds', () => ({ routeTour: () => tournament }))
vi.mock('./RegisterForm', () => ({ RegisterForm: () => <div>Registration form</div> }))
vi.mock('./BracketTab', () => ({ BracketTab: () => <div>Bracket content</div> }))
vi.mock('./DashboardTab', () => ({ DashboardTab: () => null }))
vi.mock('./LeaderboardTab', () => ({ LeaderboardTab: () => null }))
vi.mock('./AnnouncementsTab', () => ({ AnnouncementsTab: () => null }))
vi.mock('./CommunityTab', () => ({ CommunityTab: () => null }))
vi.mock('./LiveCommunityTab', () => ({ LiveCommunityTab: () => null }))
vi.mock('./manage/ManageTab', () => ({ ManageTab: () => null }))

import { ApiError } from '../../api/client'
import { SearchPage } from '../search/SearchPage'
import { TournamentPage } from './TournamentPage'
import { ScheduleTab } from './ScheduleTab'
import { EntryPanel } from './EntryPanel'

const tournament: Tournament = {
  id: '42', name: 'Campus Cup', sport: 'Badminton', format: 'single', channel: 'onsite',
  status: 'public', registrationOpen: true, date: '2099-10-01', venue: 'Main Hall', pin: null,
  cap: 16, organizer: '7', referees: [], drawn: false, rounds: 0, champion: null,
  rules: { gender: 'any', ageMin: 'any', ageMax: 'any', faculty: 'any', major: 'any', year: 'any' },
}
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
function pending() {
  return { data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() }
}
const httpError = (status: number) => new ApiError(status, { code: 'TEST_ERROR', message: 'Read failed' })
function search(q = 'Campus') {
  return render(<MemoryRouter initialEntries={[`/search/${q}`]}>
    <Routes><Route path="/search/:q" element={<SearchPage />} /></Routes>
  </MemoryRouter>)
}
function detail(id = '42') {
  return render(<MemoryRouter initialEntries={[`/t/${id}`]}>
    <Routes><Route path="/t/:id" element={<TournamentPage />} /></Routes>
  </MemoryRouter>)
}
function entry(approvedCount: number | undefined = 0) {
  return render(<MemoryRouter><EntryPanel t={tournament} approvedCount={approvedCount} sportTypeId={3} /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  hooks.mock = false
  hooks.me.mockReturnValue({ data: undefined })
  hooks.tournaments.mockReturnValue(ready({ items: [] }))
  hooks.tournament.mockReturnValue(ready(dto))
  hooks.teams.mockReturnValue(ready({ items: [] }))
  hooks.players.mockReturnValue(pending())
  hooks.approved.mockReturnValue(ready({ items: [] }))
  hooks.eligibility.mockReturnValue(ready({ items: [] }))
  hooks.myTeams.mockReturnValue(ready({ items: [] }))
  hooks.applications.mockReturnValue(ready({ items: [] }))
  hooks.matches.mockReturnValue(ready({ items: [] }))
})

describe('Search applicable source states', () => {
  it('shows genuine Guest public-empty results despite a disabled pending player read', () => {
    search()
    expect(screen.getByText('Nothing matched “Campus”')).toBeInTheDocument()
    expect(screen.queryByText('Searching players…')).not.toBeInTheDocument()
    expect(hooks.players).toHaveBeenCalledWith('Campus', false)
  })
  it('retains short public results without a Keep typing empty state', () => {
    hooks.tournaments.mockReturnValue(ready({ items: [dto] }))
    search('Ca')
    expect(screen.getByText('Campus Cup')).toBeInTheDocument()
    expect(screen.queryByText('Keep typing')).not.toBeInTheDocument()
  })
  it('retains tournaments and retries only failed squads', () => {
    hooks.tournaments.mockReturnValue(ready({ items: [dto] }))
    const teams = failed(new Error('offline'))
    hooks.teams.mockReturnValue(teams)
    search()
    expect(screen.getByText('Campus Cup')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry squads' }))
    expect(teams.refetch).toHaveBeenCalledOnce()
    expect(hooks.tournaments.mock.results[0].value.refetch).not.toHaveBeenCalled()
    expect(screen.queryByText('Nothing matched “Campus”')).not.toBeInTheDocument()
  })
  it('distinguishes simultaneous failures and isolates each Retry', () => {
    hooks.me.mockReturnValue({ data: { id: 7 } })
    const tournaments = failed(httpError(500)), players = failed(httpError(403))
    hooks.tournaments.mockReturnValue(tournaments)
    hooks.players.mockReturnValue(players)
    search()
    expect(screen.getByText('Your account is not allowed to search players.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry tournaments' }))
    expect(tournaments.refetch).toHaveBeenCalledOnce()
    expect(players.refetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Retry players' }))
    expect(players.refetch).toHaveBeenCalledOnce()
  })
  it('hides cached private players and errors when the Guest read is inapplicable', () => {
    hooks.players.mockReturnValue(failed(httpError(401), { items: [{ id: 8, fullName: 'Private cached player' }] }))
    search()
    expect(screen.queryByText('Private cached player')).not.toBeInTheDocument()
    expect(screen.queryByText('Sign in again to search players.')).not.toBeInTheDocument()
    expect(screen.getByText('Nothing matched “Campus”')).toBeInTheDocument()
  })
  it('does not apply signed-in player query states to a short public search', () => {
    hooks.me.mockReturnValue({ data: { id: 7 } })
    hooks.players.mockReturnValue(failed(httpError(403)))
    search('Ca')
    expect(hooks.players).toHaveBeenCalledWith('Ca', false)
    expect(screen.queryByText('Your account is not allowed to search players.')).not.toBeInTheDocument()
    expect(screen.getByText('Nothing matched “Ca”')).toBeInTheDocument()
  })
  it('does not show unrelated failure or loading states before a search is entered', () => {
    hooks.tournaments.mockReturnValue(failed(httpError(500)))
    hooks.teams.mockReturnValue(failed(httpError(500)))
    search('%20')
    expect(screen.getByText('Type to search')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument()
  })
  it('keeps mock public results despite irrelevant pending API reads', () => {
    hooks.mock = true
    hooks.tournaments.mockReturnValue(pending())
    hooks.teams.mockReturnValue(pending())
    search('Ca')
    expect(screen.getByText('Campus Cup')).toBeInTheDocument()
    expect(screen.queryByText('Keep typing')).not.toBeInTheDocument()
    expect(screen.queryByText('Loading tournaments…')).not.toBeInTheDocument()
  })
})

describe('Tournament source states', () => {
  it.each([404, 'invalid'] as const)('uses safe unavailable wording for %s without retrying a disabled ID', status => {
    hooks.tournament.mockReturnValue(status === 'invalid' ? pending() : failed(httpError(status)))
    detail(status === 'invalid' ? 't-prototype' : '42')
    expect(screen.getByText('Tournament unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry tournament' })).not.toBeInTheDocument()
    expect(screen.queryByText('Loading tournament')).not.toBeInTheDocument()
  })
  it.each([500, 'network'] as const)('keeps %s failures distinct from an unavailable tournament', status => {
    const query = failed(status === 'network' ? new Error('offline') : httpError(status))
    hooks.tournament.mockReturnValue(query)
    detail()
    expect(screen.getByText('Could not load the tournament')).toBeInTheDocument()
    expect(screen.queryByText('Tournament unavailable')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry tournament' }))
    expect(query.refetch).toHaveBeenCalledOnce()
  })
  it('keeps a permission denial explicit', () => {
    hooks.tournament.mockReturnValue(failed(httpError(403)))
    detail()
    expect(screen.getByText('You do not have access to this tournament')).toBeInTheDocument()
    expect(screen.queryByText('Tournament unavailable')).not.toBeInTheDocument()
  })
  it('retains last loaded details during a retryable tournament refresh failure', () => {
    const query = failed(new Error('offline'), dto)
    hooks.tournament.mockReturnValue(query)
    detail()
    expect(screen.getByRole('heading', { name: 'Campus Cup' })).toBeInTheDocument()
    expect(screen.getByText('Could not refresh the tournament. Showing the last loaded details.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry tournament' }))
    expect(query.refetch).toHaveBeenCalledOnce()
  })
  it('does not expose cached details after a visibility 404', () => {
    hooks.tournament.mockReturnValue(failed(httpError(404), dto))
    detail()
    expect(screen.getByText('Tournament unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Campus Cup' })).not.toBeInTheDocument()
  })
  it('retains the tournament while failed rules cannot advertise unrestricted entry', () => {
    const rules = failed(new Error('offline'))
    hooks.eligibility.mockReturnValue(rules)
    detail()
    expect(screen.getByRole('heading', { name: 'Campus Cup' })).toBeInTheDocument()
    expect(screen.queryByText('open to everybody')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in to enter a squad' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry entry rules' }))
    expect(rules.refetch).toHaveBeenCalledOnce()
    expect(hooks.approved.mock.results[0].value.refetch).not.toHaveBeenCalled()
  })
  it('does not infer zero capacity or no approved teams after an approved-list failure', () => {
    const approved = failed(httpError(500), { items: [] })
    hooks.approved.mockReturnValue(approved)
    detail()
    expect(screen.queryByText('No teams have been approved yet.')).not.toBeInTheDocument()
    expect(screen.queryByText('Open', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in to enter a squad' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry approved teams' }))
    expect(approved.refetch).toHaveBeenCalledOnce()
  })
  it('waits for public entry prerequisites without blanking the successful page', () => {
    hooks.eligibility.mockReturnValue(pending())
    hooks.approved.mockReturnValue(pending())
    detail()
    expect(screen.getByRole('heading', { name: 'Campus Cup' })).toBeInTheDocument()
    expect(screen.queryByText('open to everybody')).not.toBeInTheDocument()
    expect(screen.queryByText('Open', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText('Loading entry rules…')).toBeInTheDocument()
  })
  it('retains usable approved teams during a background failure', () => {
    hooks.approved.mockReturnValue(failed(httpError(500), { items: [{ id: 9, name: 'Already approved', sportTypeId: 3 }] }))
    detail()
    expect(screen.getByText('Already approved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry approved teams' })).toBeInTheDocument()
  })
  it('preserves mock entry controls while disabled public reads remain pending', () => {
    hooks.mock = true
    hooks.tournament.mockReturnValue(pending())
    hooks.eligibility.mockReturnValue(pending())
    hooks.approved.mockReturnValue(pending())
    detail('t-public')
    expect(screen.getByRole('heading', { name: 'Campus Cup' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in to enter a squad' })).toBeInTheDocument()
    expect(screen.getByText('Open', { exact: true })).toBeInTheDocument()
  })
})

describe('Schedule source states', () => {
  it.each([500, 'network'] as const)('does not claim an empty schedule after %s failure', status => {
    const query = failed(status === 'network' ? new Error('offline') : httpError(status))
    hooks.matches.mockReturnValue(query)
    render(<MemoryRouter><ScheduleTab tournamentId={42} /></MemoryRouter>)
    expect(screen.getByText('Could not load the schedule')).toBeInTheDocument()
    expect(screen.queryByText('Nothing scheduled yet')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry schedule' }))
    expect(query.refetch).toHaveBeenCalledOnce()
  })
  it('preserves a genuine successful empty schedule', () => {
    render(<MemoryRouter><ScheduleTab tournamentId={42} /></MemoryRouter>)
    expect(screen.getByText('Nothing scheduled yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry schedule' })).not.toBeInTheDocument()
  })
  it.each([
    [401, 'Sign in to view the schedule'],
    [403, 'You do not have access to this schedule'],
  ] as const)('keeps denied %s schedule reads explicit', (status, message) => {
    hooks.matches.mockReturnValue(failed(httpError(status)))
    render(<MemoryRouter><ScheduleTab tournamentId={42} /></MemoryRouter>)
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(screen.queryByText('Nothing scheduled yet')).not.toBeInTheDocument()
  })
  it.each([401, 403, 404])('hides cached fixtures when access is lost with HTTP %s', status => {
    hooks.matches.mockReturnValue(failed(httpError(status), { items: [{
      id: 11, tag: 'Private fixture', roundNumber: 1, scheduledTime: null, teamA: null, teamB: null,
      status: 'scheduled', resultStatus: null, outcome: null, viewer: { can: { editFixture: false } },
    }] }))
    render(<MemoryRouter><ScheduleTab tournamentId={42} /></MemoryRouter>)
    expect(screen.queryByText('Private fixture')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry schedule' })).toBeInTheDocument()
  })
  it('keeps loaded fixtures and their destination during a background failure', () => {
    hooks.matches.mockReturnValue(failed(httpError(500), { items: [{
      id: 11, tag: 'Round 1', scheduledTime: null, teamA: null, teamB: null,
      status: 'scheduled', resultStatus: null, outcome: null, viewer: { can: { editFixture: false } },
    }] }))
    render(<MemoryRouter initialEntries={['/t/42/schedule']}>
      <Routes>
        <Route path="/t/:id/schedule" element={<ScheduleTab tournamentId={42} />} />
        <Route path="/m/:id" element={<div>Match detail destination</div>} />
      </Routes>
    </MemoryRouter>)
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry schedule' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByText('Match detail destination')).toBeInTheDocument()
  })
})

describe('Entry private source states', () => {
  it.each([
    [{ ...tournament, registrationOpen: false }, 0, 'Registration has not been opened by the organizer yet.'],
    [tournament, 16, 'Full at 16 squads.'],
    [{ ...tournament, drawn: true }, 0, 'The bracket is drawn — entries are closed.'],
  ] as const)('explains an unavailable entry action using existing decisions: %s', (t, count, reason) => {
    render(<MemoryRouter><EntryPanel t={t} approvedCount={count} sportTypeId={3} /></MemoryRouter>)
    expect(screen.getByText(reason)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Register a squad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in to enter a squad' })).not.toBeInTheDocument()
  })
  it('disables Guest private reads and hides cached entries', () => {
    hooks.myTeams.mockReturnValue(pending())
    hooks.applications.mockReturnValue(ready({ items: [{ id: 1, tournament: { id: 42 }, team: { name: 'Private entry' }, status: 'approved' }] }))
    entry()
    expect(hooks.myTeams).toHaveBeenCalledWith(false)
    expect(hooks.applications).toHaveBeenCalledWith(false)
    expect(screen.queryByText('Loading the squads you lead…')).not.toBeInTheDocument()
    expect(screen.queryByText('Private entry')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in to enter a squad' })).toBeInTheDocument()
  })
  it('reports failed leader-team reads without implying no eligible team', () => {
    hooks.me.mockReturnValue({ data: { id: 7 } })
    const teams = failed(new Error('offline'))
    hooks.myTeams.mockReturnValue(teams)
    entry()
    expect(screen.getByText('Could not load the squads you lead.')).toBeInTheDocument()
    expect(screen.queryByText(/You need a squad you lead/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry your squads' }))
    expect(teams.refetch).toHaveBeenCalledOnce()
    expect(hooks.applications.mock.results[0].value.refetch).not.toHaveBeenCalled()
    expect(hooks.myTeams).toHaveBeenCalledWith(true)
  })
  it('keeps denied team reads explicit and successful personal entries visible', () => {
    hooks.me.mockReturnValue({ data: { id: 7 } })
    hooks.myTeams.mockReturnValue(failed(httpError(403)))
    hooks.applications.mockReturnValue(ready({ items: [{
      id: 1, tournament: { id: 42 }, team: { name: 'My approved entry' }, status: 'approved',
    }] }))
    entry()
    expect(screen.getByText('Your account is not allowed to view these squads.')).toBeInTheDocument()
    expect(screen.getByText('My approved entry')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Register a squad' })).not.toBeInTheDocument()
  })
  it('retains a ready team when entries fail and retries entries alone', () => {
    hooks.me.mockReturnValue({ data: { id: 7 } })
    hooks.myTeams.mockReturnValue(ready({ items: [{ id: 9, name: 'Ready Squad', role: 'leader', sportTypeId: 3, readinessStatus: 'Ready' }] }))
    const applications = failed(httpError(500))
    hooks.applications.mockReturnValue(applications)
    entry()
    expect(screen.getByRole('button', { name: 'Register a squad' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry your entries' }))
    expect(applications.refetch).toHaveBeenCalledOnce()
    expect(hooks.myTeams.mock.results[0].value.refetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Register a squad' }))
    expect(screen.getByText('Registration form')).toBeInTheDocument()
  })
  it('does not claim Open or offer registration with unknown real capacity', () => {
    render(<MemoryRouter><EntryPanel t={tournament} sportTypeId={3} /></MemoryRouter>)
    expect(screen.queryByText('Open', { exact: true })).not.toBeInTheDocument()
    expect(screen.getByText('Capacity unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in to enter a squad' })).not.toBeInTheDocument()
  })
  it('preserves mock Guest entry using the store count without private loading', () => {
    hooks.mock = true
    hooks.myTeams.mockReturnValue(pending())
    hooks.applications.mockReturnValue(pending())
    render(<MemoryRouter><EntryPanel t={tournament} sportTypeId={3} /></MemoryRouter>)
    expect(screen.getByText('Open', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in to enter a squad' })).toBeInTheDocument()
    expect(screen.queryByText('Loading your entries…')).not.toBeInTheDocument()
  })
})
