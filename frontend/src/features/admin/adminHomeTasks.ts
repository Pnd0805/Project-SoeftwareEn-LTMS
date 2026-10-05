import type { HomeTask } from '../home/homeTasks'
import type { BackendPendingTournamentRequestDto } from '../../types/tournament.dto'

/** The caller supplies rows from the pending-only Admin endpoint after access confirmation. */
export function adminHomeTasks(requests: readonly BackendPendingTournamentRequestDto[]): HomeTask[] {
  return requests.map(request => ({
    key: `admin:tournament-request:${request.id}`,
    source: 'admin',
    label: 'Review',
    context: request.name,
    urgency: 'waiting',
    href: '/admin/requests',
  }))
}
