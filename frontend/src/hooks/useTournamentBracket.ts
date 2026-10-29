import { useQuery } from '@tanstack/react-query'
import { getBracket } from '../api/match'
import { retryPolicy } from '../api/client'

/** ผังใช้แบ่งสาย/เรียงช่องเท่านั้น ทีมและสกอร์ต้องอ่านจาก matches ที่อัปเดตจริง */
export function useTournamentBracket(tournamentId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['matches', 'bracket-layout', tournamentId],
    queryFn: () => getBracket(tournamentId),
    enabled,
    retry: retryPolicy,
  })
}
