import { createContext, useContext } from 'react'
import { retryPolicy, USE_MOCK } from '../api/client'

export const TOURNAMENT_REFRESH_MS = 10_000
export const TournamentRefreshContext = createContext<{ enabled: boolean; status?: string }>({ enabled: false })

export function tournamentRefreshInterval(status: string | undefined, enabled: boolean, error: unknown) {
  return !USE_MOCK && enabled && !!status && !['completed', 'cancelled'].includes(status) && !error
    ? TOURNAMENT_REFRESH_MS : false
}

/** เปิดเฉพาะ workspace ที่แสดงอยู่; TanStack หยุด interval เมื่อ browser tab ถูกซ่อน */
export function useTournamentPolling() {
  const { enabled, status } = useContext(TournamentRefreshContext)
  return {
    retry: enabled ? false as const : retryPolicy,
    refetchInterval: (query: { state: { error: unknown } }) => tournamentRefreshInterval(status, enabled, query.state.error),
    refetchIntervalInBackground: false,
  }
}
