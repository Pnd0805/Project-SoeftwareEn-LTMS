import { createContext, useContext } from 'react'
import { retryPolicy, USE_MOCK } from '../api/client'

/**
 * PF-04 / FR-DL-02 — ผู้ชมต้องเห็นผลภายใน 10 วินาทีหลังยืนยันผล
 * ตรวจ SRS/SDS 30 ต.ค. 2569 (ข้อ 1.4): เดิม 10 วินาที ⇒ กรณีแย่สุดรอรอบเกือบ 10 วินาที + เวลาเรียก API/แสดงผล = เกิน SLA
 * 5 วินาที ⇒ กรณีแย่สุด ~5 วินาที + เวลาเรียก API ยังเหลือเผื่อในกรอบ 10 วินาที
 */
export const TOURNAMENT_REFRESH_MS = 5_000
export const TOURNAMENT_REFRESH_SLA_MS = 10_000
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
