/**
 * src/features/tournament/dashboardView.ts — Person 3
 *
 * FR-DL-01 — ข้อมูลสรุปของทัวร์นาเมนต์ (SDS GET /tournaments/{id}/dashboard)
 *
 * backend ยังไม่มี route นี้ แดชบอร์ดจึงสรุปจากรายการแมตช์ชุดเดียวกับที่ Schedule
 * อ่านอยู่แล้ว แยกเป็นฟังก์ชันบริสุทธิ์ไว้ทดสอบโดยไม่ต้อง render — พอ backend มี
 * route ค่อยเปลี่ยนแหล่งข้อมูล หน้าจอไม่ต้องแก้
 */
import type { MatchState } from '../../components/kit/viewModels'
import type { MatchDto, MatchListItemDto, StandingRowDto, StandingsFormat } from '../../types/match.dto'
import { matchStateOf, scoreText } from '../match/matchView'

/**
 * แถวของรายการแมตช์ในทัวร์นาเมนต์ — GET /tournaments/:id/matches คืน MatchDto
 * โหมด mock แนบสกอร์กับสถานะผลมาด้วย ส่วน backend อาจไม่มี จึงเป็นทางเลือก
 */
export type DashboardMatch = MatchDto & Partial<Pick<MatchListItemDto, 'score' | 'resultStatus' | 'outcome'>>

/** ลำดับที่แสดงสถานะ — สิ่งที่ต้องมีคนทำก่อนขึ้นก่อน */
export const STATE_ORDER: MatchState[] = ['live', 'checkin', 'disputed', 'pending', 'scheduled', 'waiting', 'confirmed']

/**
 * สถานะของแถวหนึ่ง — ถ้าไม่มีสถานะผลมาด้วย แมตช์ที่ `completed` แล้วคือยืนยันผลแล้ว
 * (SDS: COMPLETED มาหลัง RESULT_VERIFIED เท่านั้น) ไม่ใช่ "รอคนกรอก" แบบที่ matchStateOf ตีความ
 */
export const stateOf = (m: DashboardMatch): MatchState => matchStateOf({
  ...m,
  resultStatus: m.resultStatus !== undefined ? m.resultStatus : m.status === 'completed' ? 'verified' : null,
})

/**
 * สกอร์เป็นข้อความ — ใช้กติกาเดียวกับตาราง /matches
 * ของเดิมเขียนเองอีกชุด แดชบอร์ดเลยขึ้น "— – —" ให้แมตช์บาย ขณะที่หน้ารายการขึ้น "Bye"
 */
export const scoreOf = (m: DashboardMatch): string => scoreText(m)

export interface DashboardSummary {
  /** แมตช์ที่ต้องแข่งจริง ไม่นับบาย */
  total: number
  finished: number
  byState: Record<MatchState, number>
  /** กำลังแข่งหรือเปิดเช็คอินอยู่ */
  onNow: DashboardMatch[]
  /** ผลที่รอยืนยันหรือถูกโต้แย้ง — ต้องมีคนตัดสินใจ */
  attention: DashboardMatch[]
  upNext: DashboardMatch[]
  latest: DashboardMatch[]
  /** รอบแรกสุดที่ยังแข่งไม่จบ */
  stage: string | null
}

/** แมตช์ที่มีทีมเดียวแต่จบแล้วคือบาย ไม่ใช่แมตช์ที่ต้องแข่ง */
const isBye = (m: DashboardMatch) =>
  (!m.teamA || !m.teamB) && (m.status === 'completed' || m.resultStatus === 'verified')

const at = (m: DashboardMatch) => (m.scheduledTime ? new Date(m.scheduledTime).getTime() : null)

/** เรียงตามเวลา แมตช์ที่ยังไม่มีเวลาไปอยู่ท้ายเสมอไม่ว่าจะเรียงทางไหน */
const byTime = (dir: 1 | -1) => (a: DashboardMatch, b: DashboardMatch) => {
  const ta = at(a), tb = at(b)
  if (ta === tb) return a.id - b.id
  if (ta === null) return 1
  if (tb === null) return -1
  return dir * (ta - tb)
}

export function summarizeMatches(items: DashboardMatch[], limit = 5): DashboardSummary {
  const byState: Record<MatchState, number> = {
    bye: 0, confirmed: 0, disputed: 0, pending: 0, checkin: 0, live: 0, scheduled: 0, waiting: 0,
  }
  const rows = items
    .filter(m => {
      if (!isBye(m)) return true
      byState.bye += 1
      return false
    })
    .map(m => ({ m, state: stateOf(m) }))
  rows.forEach(r => { byState[r.state] += 1 })

  const pick = (states: MatchState[]) => rows.filter(r => states.includes(r.state)).map(r => r.m)
  const open = rows
    .filter(r => r.state !== 'confirmed')
    .sort((a, b) => (a.m.roundNumber ?? 0) - (b.m.roundNumber ?? 0) || byTime(1)(a.m, b.m))

  return {
    total: rows.length,
    finished: byState.confirmed,
    byState,
    onNow: pick(['live', 'checkin']).sort(byTime(1)),
    attention: pick(['disputed', 'pending']).sort(byTime(1)),
    upNext: pick(['scheduled']).sort(byTime(1)).slice(0, limit),
    latest: pick(['confirmed']).sort(byTime(-1)).slice(0, limit),
    stage: open.length ? (open[0].m.stage || open[0].m.tag || null) : null,
  }
}

/**
 * หัวตารางของแดชบอร์ด
 *
 * รอบคัดออกจัดอันดับตามรอบที่ตกรอบ ทุกทีมที่ยังไม่ตกรอบจึงได้อันดับร่วมที่ 1
 * โชว์เป็นเลข 1 เรียงกันสามแถวแล้วอ่านเหมือนระบบพัง — ช่วงนั้นบอกว่าใครยังอยู่ในการแข่งแทน
 * ส่วนที่จัดอันดับได้แล้ว ทีมที่อันดับเท่ากับแถวสุดท้ายที่แสดงต้องขึ้นด้วย ไม่ตัดทิ้งครึ่งหนึ่ง
 */
export type TableTop =
  | { kind: 'still-in'; teams: StandingRowDto[] }
  | { kind: 'ranked'; rows: StandingRowDto[] }

export function topOfTable(rows: StandingRowDto[], format: StandingsFormat, limit = 3): TableTop {
  if (!rows.length) return { kind: 'ranked', rows: [] }
  const leaders = rows.filter(r => r.rank === rows[0].rank)
  if (format !== 'round_robin' && leaders.length > 1) return { kind: 'still-in', teams: leaders }
  const cutRank = rows[Math.min(limit, rows.length) - 1].rank
  return { kind: 'ranked', rows: rows.filter(r => r.rank <= cutRank) }
}
