import type { BackendMyInvitationDto, BackendMyTeamDto } from '../../types/team.dto'
import type { HomeTask } from '../home/homeTasks'
import { fmtDateTime } from '../../shared/dateFormat'

export function teamHomeTasks(
  invites: readonly BackendMyInvitationDto[],
  teams: readonly BackendMyTeamDto[],
  now: Date,
): HomeTask[] {
  return [
    ...invites
      .filter(invitation => new Date(invitation.expiresAt).getTime() > now.getTime())
      .map(invitation => ({
        key: `team:invitation:${invitation.id}`,
        source: 'team' as const,
        label: 'Accept',
        context: invitation.team.name,
        detail: `Expires ${fmtDateTime(invitation.expiresAt)}`,
        urgency: 'urgent' as const,
        href: '/teams',
      })),
    ...teams
      .filter(team => team.readinessStatus === 'Forming' && team.role === 'leader')
      .map(team => ({
        key: `team:readiness:${team.id}`,
        source: 'team' as const,
        label: 'Complete team',
        context: team.name,
        urgency: 'ready' as const,
        href: `/team/${team.id}`,
      })),
  ]
}
