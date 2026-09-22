import type { BackendEligibilityRuleDto, TournamentDto, TournamentDetailDto } from '../../types/tournament.dto'
import type { Rules, Tournament } from '../../shared/types'
import type { SportType } from '../../types/dto'
import { regWindowClosed } from '../../shared/rules'

/**
 * ชื่อกีฬาสำรอง — ใช้เฉพาะตอนที่ GET /sport-types ยังโหลดไม่เสร็จ
 *
 * ⚠️ อย่าเชื่อตารางนี้เป็นหลัก backend renumber id กีฬามาแล้วครั้งหนึ่ง
 *    (migration 010 เหลือ 5 กีฬา: แบดมินตัน 6→3, RoV 8→4, VALORANT 9→5)
 *    รอบนั้นหน้าทัวร์นาเมนต์แบดมินตันขึ้นว่า "Basketball" อยู่พักใหญ่กว่าจะรู้ตัว
 *    ของจริงมาจาก useSportTypes() ที่ส่งเข้ามาทาง `sports` เสมอ
 */
const fallbackSportNames: Record<number, string> = {
  1: 'Football', 2: 'Basketball', 3: 'Badminton', 4: 'RoV', 5: 'VALORANT',
}

/**
 * เงื่อนไขรับสมัคร (hard filter) ของ backend มาจากสองที่:
 *   เพศ/อายุ  → คอลัมน์ในตาราง tournaments
 *   คณะ/ชั้นปี → ตาราง eligibility_rules (GET /tournaments/:id/eligibility-rules)
 * ⚠️ เดิมเอา organizingFacultyId (คณะที่ "จัด") มาแสดงเป็นเงื่อนไข "ผู้สมัคร"
 *    ทำให้ทุกรายการดูเหมือนจำกัดเฉพาะคณะนั้น ทั้งที่ backend ไม่ได้ตรวจแบบนั้น
 */
const rulesFromDto = (
  dto: TournamentDto,
  eligibility: BackendEligibilityRuleDto[] = [],
  faculties: Array<{ id: number; name: string }> = [],
): Rules => {
  const facultyRules = eligibility.filter(rule => rule.ruleType === 'faculty').map(rule => rule.ruleValue)
  const years = eligibility.filter(rule => rule.ruleType === 'year').map(rule => rule.ruleValue)
  return {
    gender: dto.genderRequirement === 'male' ? 'Male' : dto.genderRequirement === 'female' ? 'Female' : 'any',
    ageMin: dto.minAge ?? 'any',
    ageMax: dto.maxAge ?? 'any',
    faculty: facultyRules.length
      ? facultyRules.map(id => faculties.find(f => f.id === id)?.name ?? `คณะ #${id}`).join(', ')
      : 'any',
    major: 'any',
    year: years.length === 1 ? years[0] : 'any',
  }
}

/**
 * ค่าที่ใส่ในช่อง champion เมื่อรู้ว่า "จบแล้ว" แต่ยังไม่รู้ว่าทีมไหนได้แชมป์
 *
 * รายการจาก GET /tournaments ไม่ได้บอกสถานะหรือผู้ชนะมาด้วย และชื่อแชมป์จริง
 * ต้องขอจาก GET /tournaments/:id/winner ซึ่งเป็นคนละคำขอ — หน้ารวมจึงใช้ค่านี้
 * เพื่อจัดกลุ่ม "แข่งจบแล้ว" เท่านั้น (ทุกที่ที่เอาไปหาชื่อทีมจะได้ undefined และกันไว้แล้ว)
 */
export const CHAMPION_UNKNOWN = "finished"

/** Keep the entry form aligned with the backend's explicit registration lifecycle. */
export function registrationClosedReason(t: Tournament, approved: number, realMode: boolean): string {
  if (t.drawn) return 'The bracket is drawn — entries are closed.'
  if (t.status !== 'public') return 'Not open for registration yet.'
  if (realMode && t.registrationOpen !== true) return 'Registration has not been opened by the organizer yet.'
  if (approved >= t.cap) return `Full at ${t.cap} squads.`
  return regWindowClosed(t)
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function tournamentView(
  dto: TournamentDto | TournamentDetailDto,
  eligibility: BackendEligibilityRuleDto[] = [],
  faculties: Array<{ id: number; name: string }> = [],
  /** GET /sport-types — ชื่อกีฬาและ onsite/online ของจริง ไม่ใช่ที่เราเดาไว้ */
  sports: SportType[] = [],
): Tournament {
  const sport = sports.find(row => row.id === dto.sportTypeId)
  const format = dto.bracketFormat === 'double_elimination' ? 'double'
    : dto.bracketFormat === 'round_robin' ? 'roundrobin' : 'single'
  const status = dto.status === 'pending_approval' ? 'pending'
    : dto.status === 'private' ? 'private' : dto.status === 'public' ? 'public' : 'public'
  const referees = 'referees' in dto ? dto.referees.map(referee => String(referee.userId)) : []

  /* สถานะของรายการ backend มีแค่ pending_approval/private/public/completed
     ไม่มีคำว่า "กำลังแข่ง" — ดูจากวันแข่งแทน ซึ่งเป็นสิ่งที่คนอ่านเองอยู่แล้ว
     (และรายการจาก GET /tournaments ไม่ส่ง status มาด้วยซ้ำ) */
  const today = todayIso()
  const lastDay = dto.eventEndDate ?? dto.eventStartDate
  const started = dto.eventStartDate <= today
  const over = lastDay < today
  const finished = dto.status === "completed" || over

  return {
    id: String(dto.id),
    name: dto.name,
    sport: sport?.name ?? fallbackSportNames[dto.sportTypeId] ?? `Sport ${dto.sportTypeId}`,
    format,
    channel: sport?.defaultMode === 'online' ? 'online' : 'onsite',
    status,
    registrationOpen: dto.registrationOpen,
    registrationStart: dto.registrationStart,
    registrationEnd: dto.registrationEnd,
    date: dto.eventStartDate,
    venue: dto.venue ?? '',
    pin: null,
    cap: dto.maxTeams,
    organizer: String(dto.requestedByUserId),
    referees,
    rules: rulesFromDto(dto, eligibility, faculties),
    drawn: finished || started,
    rounds: 0,
    champion: finished ? CHAMPION_UNKNOWN : null,
  }
}
