import type { HomeTask } from '../home/homeTasks'
import type { BackendRefereeRequestDto, MyRefereeInvitationDto } from '../../types/admin.dto'

export function refereeHomeTasks(
  invites: readonly MyRefereeInvitationDto[],
  incoming: readonly BackendRefereeRequestDto[],
): HomeTask[] {
  const tasks: HomeTask[] = []
  const seenInvitations = new Set<number>()
  const seenRequests = new Set<number>()

  for (const invite of invites) {
    if (seenInvitations.has(invite.id)) continue
    seenInvitations.add(invite.id)
    tasks.push({
      key: `referee:invitation:${invite.id}`,
      source: 'referee',
      label: 'Accept',
      context: invite.tournament.name,
      urgency: 'ready',
      href: '/matches',
    })
  }

  for (const request of incoming) {
    if (request.status !== 'open' || seenRequests.has(request.id)) continue
    seenRequests.add(request.id)
    tasks.push({
      key: `referee:request:${request.id}`,
      source: 'referee',
      label: 'Review',
      context: `Tournament ${request.tournamentId}${request.matchA ? ` · Match ${request.matchA.id}` : ' · Withdrawal'}`,
      urgency: 'ready',
      href: '/inbox',
    })
  }

  return tasks
}
