import type { BackendMyInvitationDto, BackendMyTeamDto } from '../../types/team.dto'
import type { HomeTask } from '../home/homeTasks'

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
        detail: `Expires ${new Date(invitation.expiresAt).toLocaleString('en-GB', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        })}`,
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
