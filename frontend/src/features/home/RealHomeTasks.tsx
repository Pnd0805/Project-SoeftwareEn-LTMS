import { useBackendMyInvitations, useBackendMyTeams } from '../../hooks/useTeam'
import { useAdminAccess, useMyRefereeInvitations, useMyRefereeRequests, usePendingTournamentRequests } from '../../hooks/useAdmin'
import { useMyMatches } from '../../hooks/useMatch'
import { useMyTournaments } from '../../hooks/useTournament'
import { HomeTaskPanel } from './HomeTaskPanel'
import type { HomeTaskFeed } from './homeTasks'
import { teamHomeTasks } from '../team/teamHomeTasks'
import { refereeHomeTasks } from '../admin/refereeHomeTasks'
import { matchHomeTasks } from '../match/matchHomeTasks'
import { tournamentHomeTasks } from '../tournament/tournamentHomeTasks'
import { adminHomeTasks } from '../admin/adminHomeTasks'

function queryState(query: { isPending: boolean; isError: boolean }): HomeTaskFeed['state'] {
  return query.isPending ? 'loading' : query.isError ? 'failed' : 'ready'
}

export function RealHomeTasks() {
  const invitations = useBackendMyInvitations()
  const teams = useBackendMyTeams()
  const refereeInvitations = useMyRefereeInvitations()
  const refereeRequests = useMyRefereeRequests()
  const matches = useMyMatches()
  const tournaments = useMyTournaments()
  const adminAccess = useAdminAccess()
  const hasAdminAccess = adminAccess.data === true && !adminAccess.isError
  const adminAccessDenied = adminAccess.isError
    && (adminAccess.error as { status?: unknown } | null)?.status === 403
  const adminRequests = usePendingTournamentRequests(hasAdminAccess)

  const feeds: HomeTaskFeed[] = [
    {
      source: 'team',
      label: 'Team invitations',
      state: queryState(invitations),
      tasks: teamHomeTasks(invitations.data?.items ?? [], [], new Date()),
      retry: () => { void invitations.refetch() },
    },
    {
      source: 'team',
      label: 'Team readiness',
      state: queryState(teams),
      tasks: teamHomeTasks([], teams.data?.items ?? [], new Date()),
      retry: () => { void teams.refetch() },
    },
    {
      source: 'referee',
      label: 'Referee invitations',
      state: queryState(refereeInvitations),
      tasks: refereeHomeTasks(refereeInvitations.data?.items ?? [], []),
      retry: () => { void refereeInvitations.refetch() },
    },
    {
      source: 'referee',
      label: 'Referee requests',
      state: queryState(refereeRequests),
      tasks: refereeHomeTasks([], refereeRequests.data?.incoming ?? []),
      retry: () => { void refereeRequests.refetch() },
    },
    {
      source: 'match',
      label: 'Matches',
      state: queryState(matches),
      tasks: matchHomeTasks(matches.data?.items ?? []),
      retry: () => { void matches.refetch() },
    },
    {
      source: 'tournament',
      label: 'Tournament setup',
      state: queryState(tournaments),
      tasks: tournamentHomeTasks(tournaments.data?.items ?? []),
      retry: () => { void tournaments.refetch() },
    },
    {
      source: 'admin',
      label: 'Admin requests',
      state: adminAccessDenied ? 'ready' : hasAdminAccess ? queryState(adminRequests) : queryState(adminAccess),
      tasks: hasAdminAccess ? adminHomeTasks(adminRequests.data?.items ?? []) : [],
      retry: () => { void (hasAdminAccess ? adminRequests.refetch() : adminAccess.refetch()) },
    },
  ]

  return <HomeTaskPanel feeds={feeds} />
}
