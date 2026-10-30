/**
 * เริ่มรับสมัครแล้วหรือยัง — ตัวตัดสินว่าแผงจัดการจะให้ Delete หรือ Cancel (เอกสารแก้ UI ข้อ 8)
 *
 * นับจากผู้จัดกด Open registration หรือมีใบสมัคร/แมตช์แล้ว · backend ไม่เก็บว่า "เคยเปิด"
 * ทัวร์ที่เปิดแล้วปิดโดยไม่มีใบสมัครจึงกลับมาลบได้ ซึ่งตรงกับด่าน TOURNAMENT_HAS_ACTIVITY ฝั่ง backend
 *
 * คืน null ระหว่างรออ่านใบสมัคร เพื่อไม่ให้ปุ่มลบโผล่แวบก่อนรู้คำตอบ
 * อ่านไม่ได้ให้ถือว่าเริ่มแล้ว — ถ้าไม่แน่ใจต้องไม่เสนอการลบ
 */
import { useTournamentApplications } from '../../../hooks/useTournament'
import type { Tournament } from '../../../shared/types'
import { awaitingApproval } from './awaitingApproval'

export function useRegistrationStarted(t: Tournament): boolean | null {
  const gated = awaitingApproval(t)
  const id = Number.isInteger(Number(t.id)) && !gated ? Number(t.id) : undefined
  const applications = useTournamentApplications(id)
  if (gated) return false
  if (t.registrationOpen || t.drawn) return true
  if (applications.isError) return true
  return applications.data ? applications.data.items.length > 0 : null
}
