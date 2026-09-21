import { ApiError } from '../../api/client'

export const conflictOfInterestDetails = (error: ApiError) => {
  if (error.code !== 'TEAM_CONFLICT_OF_INTEREST') return []
  const role = error.extra.role === 'organizer' ? 'organizer' : 'referee'
  const tournamentId = typeof error.extra.tournamentId === 'number' ? ` #${error.extra.tournamentId}` : ''
  return [
    `A selected player is already an ${role} of tournament${tournamentId}. They cannot compete in the same tournament.`,
    'Remove that player from this submitted squad, or remove the conflicting tournament role before applying again.',
  ]
}
