import type { MatchDto, MatchResultDto } from '../../types/match.dto'

/**
 * OD-55 (4 ต.ค.) — ใครเขียนผล อีกฝ่ายรับรอง · ดูจาก submittedRole ไม่ใช่โหมดอย่างเดียว
 *
 *   onsite · referee      → หัวหน้าทีมที่ชนะ
 *   online · team_leader  → กรรมการของแมตช์
 *   online · referee      → หัวหน้าทีมฝ่ายไหนก็ได้ (กรรมการแก้ผล S02b หรือส่งแทนตอนทีมเงียบ)
 *
 * เดิมเดาจากโหมด: ผลที่กรรมการเขียนในโหมด online จึงโชว์ปุ่มให้กรรมการ (กดแล้ว 403
 * SAME_PERSON_CANNOT_VERIFY) และหัวหน้าทีมที่กดได้จริงไม่เห็นปุ่ม — ผลค้างรอ auto-verify
 */
export type Confirmer = 'winning_leader' | 'referee' | 'either_leader'

export function confirmerOf(mode: MatchDto['mode'], role: MatchResultDto['submittedRole']): Confirmer {
  if (mode === 'onsite') return 'winning_leader'
  return role === 'referee' || role === 'organizer' ? 'either_leader' : 'referee'
}

export function canConfirm(m: MatchDto, result: MatchResultDto): boolean {
  const who = confirmerOf(m.mode, result.submittedRole)
  if (who === 'referee') return m.viewer.roles.includes('referee')
  if (!m.viewer.isTeamLeader) return false
  return who === 'either_leader' || result.winnerTeamId === m.viewer.myTeamId
}

export const confirmerName = (who: Confirmer) =>
  who === 'winning_leader' ? "the winning team's leader" : who === 'referee' ? 'the match referee' : 'either team leader'

const roleName = (role: MatchResultDto['submittedRole']) =>
  role === 'organizer' ? 'the organizer' : role === 'team_leader' ? 'a team leader' : 'a referee'

/**
 * OD-59 — สามกรณีของ S05 ต้องพูดคนละแบบ
 * hidden  = ผู้ดูไม่มีสิทธิ์รู้ชื่อ → บอกแค่บทบาท ไม่ใช่ "ไม่มีชื่อ" ซึ่งอ่านเหมือนข้อมูลหาย
 * deleted = บัญชีผู้ส่งถูกลบไปแล้ว → บอกตรง ๆ
 * shown   = มีชื่อ
 */
export function resultRecorder(result: MatchResultDto) {
  if (result.submittedByVisibility === 'deleted') return `${roleName(result.submittedRole)} whose account no longer exists`
  const name = result.submittedBy?.fullName?.trim()
  if (result.submittedByVisibility !== 'hidden' && name && name !== '—') return name
  return roleName(result.submittedRole)
}
