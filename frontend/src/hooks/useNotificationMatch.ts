import { useQuery } from '@tanstack/react-query'
import { getNotificationMatch } from '../api/notification'
import { getTournament } from '../api/tournament'

/** Account-scoped optional context, shared by every notice about the same match. */
export function useNotificationMatch(userId: number, matchId: number) {
  const match = useQuery({
    queryKey: ['notificationMatch', userId, matchId],
    queryFn: () => getNotificationMatch(matchId),
    staleTime: 60_000,
    retry: false,
  })
  const tournamentId = !match.isError ? match.data?.tournamentId : undefined
  const tournament = useQuery({
    queryKey: ['notificationTournament', userId, tournamentId],
    queryFn: () => getTournament(tournamentId!),
    enabled: tournamentId !== undefined,
    staleTime: 60_000,
    retry: false,
  })
  return {
    match: !match.isError ? match.data : undefined,
    tournamentName: !tournament.isError ? tournament.data?.name : undefined,
  }
}
