import type { MatchResultDto } from '../../types/match.dto'
export function resultRecorder(result: MatchResultDto) {
  const name = result.submittedBy?.fullName?.trim()
  if (name && name !== '—') return name
  return result.submittedRole === 'organizer' ? 'the organizer (name not provided)'
    : result.submittedRole === 'team_leader' ? 'a team leader (name not provided)' : 'a referee (name not provided)'
}
