import type { MatchListItemDto } from '../../types/match.dto'
import type { Tournament } from '../../shared/types'
import { formatOf } from '../../shared/rules'

/** Older two-team double-elimination draws must not count as completed setup. */
export function hasValidBracket(t: Tournament, matches: MatchListItemDto[]): boolean {
  if (matches.length === 0) return false
  if (formatOf(t) !== 'double') return true
  const firstRoundTeams = new Set<number>()
  matches.filter(match => match.roundNumber === 1).forEach(match => {
    if (match.teamA) firstRoundTeams.add(match.teamA.id)
    if (match.teamB) firstRoundTeams.add(match.teamB.id)
  })
  return firstRoundTeams.size >= 4
}
