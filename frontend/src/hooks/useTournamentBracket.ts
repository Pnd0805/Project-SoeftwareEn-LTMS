import { useQuery } from '@tanstack/react-query'
import { getBracket } from '../api/match'
import { useTournamentPolling } from './tournamentPolling'

/** ผังใช้แบ่งสาย/เรียงช่องเท่านั้น ทีมและสกอร์ต้องอ่านจาก matches ที่อัปเดตจริง */
export function useTournamentBracket(tournamentId: number, enabled: boolean) {
  const polling = useTournamentPolling()
  return useQuery({
    ...polling,
    queryKey: ['matches', 'bracket-layout', tournamentId],
    queryFn: () => getBracket(tournamentId),
    enabled,
  })
}
