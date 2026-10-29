import type { TournamentDto } from '../../types/tournament.dto'
import type { HomeTask } from '../home/homeTasks'

/** The /me/tournaments response is ownership-verified by the backend. */
export function tournamentHomeTasks(tournaments: readonly TournamentDto[]): HomeTask[] {
  return tournaments
    .filter(tournament => tournament.status === 'private' && tournament.deletedAt === null)
    .map(tournament => ({
      key: `tournament:${tournament.id}`,
      source: 'tournament',
      label: 'Continue setup',
      context: tournament.name,
      urgency: 'waiting',
      href: `/t/${tournament.id}/manage/progress`,
    }))
}
