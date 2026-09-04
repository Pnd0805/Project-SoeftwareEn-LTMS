/**
 * src/mocks/matchWrites.ts — ทางเขียนของสไลซ์ 3 ในโหมด mock
 *
 * ── ปัญหาที่ไฟล์นี้แก้ ─────────────────────────────────────────────────────
 * `api/match.ts` เดิมเขียนผลลง `mockResults`/`mockMatches` ซึ่งเป็นอาร์เรย์ที่
 * เขียนมือ แต่แมตช์ทุกนัดที่คนกดในเดโมมาจาก seed และอ่านผ่าน `storeBridge`
 * เขียนที่หนึ่ง อ่านอีกที่หนึ่ง — กรอกผลแล้วหน้าจอไม่ขยับ ไม่มี error ให้เห็นด้วย
 *
 * ที่นี่จึงเขียนกลับ store ตัวเดียวกับที่ฝั่งอ่านใช้ หลักการเดียวกับที่กรรมการใช้:
 * อ่านจากไหน เขียนที่นั่น
 *
 * ทุกฟังก์ชันคืน `false` เมื่อหาแมตช์ไม่เจอ ผู้เรียกจะได้ตกไปใช้อาร์เรย์เขียนมือ
 * ต่อได้ (fixture ที่ยังต้องใช้ทดสอบ edge case บางอย่าง)
 *
 * ทั้งไฟล์ตายตอน `VITE_USE_MOCK=false`
 */
import { commitStore, getState } from '../shared/store'
import { me } from '../shared/selectors'
import { winnerId } from '../shared/rules'
import { findStoreMatch, numOf } from './storeBridge'
import type { Match as StoreMatch, PlayerStat, State } from '../shared/types'
import type { MatchRef } from './storeBridge'

/** ผู้ใช้ที่กำลังกดอยู่ — mock ใช้เป็นคนบันทึก/ยืนยัน แทน mockPlayers[3] ตายตัว */
const actor = (s: State): string | null => me(s)?.id ?? null

/**
 * ผู้ชนะเดินไปนัดต่อไป และในสายแพ้คัดออกสองครั้ง ผู้แพ้ก็เดินเหมือนกัน
 * `winTo`/`loseTo` เป็นตัวบอกปลายทางที่การจับสายวางไว้ ถ้าไม่มีก็ใช้เลขรอบ/ช่อง
 * แบบสายเดี่ยว (ช่องคู่ไป a ช่องคี่ไป b) ซึ่งเป็นกติกาเดียวกับที่ buildBracket ใช้
 */
function advance(s: State, m: StoreMatch): void {
  const win = winnerId(m)
  if (!win) return
  const lose = m.a === win ? m.b : m.a

  if (m.winTo) {
    const next = s.matches.find(x => x.id === m.winTo!.m)
    if (next) next[m.winTo.side] = win
  } else {
    const next = s.matches.find(x => x.tour === m.tour && x.round === m.round + 1 && x.slot === (m.slot >> 1))
    if (next) next[m.slot % 2 === 0 ? 'a' : 'b'] = win
  }

  if (m.loseTo && lose) {
    const drop = s.matches.find(x => x.id === m.loseTo!.m)
    if (drop) drop[m.loseTo.side] = lose
  }
}

interface ScoreInput {
  a: number | null
  b: number | null
  decider?: { a: number; b: number; kind: string } | null
}

/** บันทึกผล — สถานะไปที่ `pending` รออีกฝ่ายยืนยัน (FR-RS-01, FR-RS-02) */
export function writeResult(ref: MatchRef, score: ScoreInput): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  m.sa = score.a
  m.sb = score.b
  m.decider = score.decider ?? null
  m.enteredBy = actor(s) ?? m.refs[0] ?? null
  m.status = 'pending'
  m.confirmedBy = null
  m.disputedBy = null
  m.disputedTeam = null
  commitStore()
  return true
}

/**
 * ยืนยันผล — ตรงกับลำดับใน SDS §4.2.1 ขั้น 8 ถึง 11 ที่ต้องอยู่ในธุรกรรมเดียว
 * บันทึกว่า verified → เดินสายต่อ → ตารางคะแนนคำนวณใหม่เอง (leaderboard อ่านสด)
 */
export function writeVerify(ref: MatchRef, byOrganizer = false): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  m.status = 'confirmed'
  m.confirmedBy = actor(s)
  m.confirmedByOrg = byOrganizer
  m.disputedBy = null
  m.disputedTeam = null
  advance(s, m)
  commitStore()
  return true
}

/** โต้แย้งผล — บันทึกไว้กับทีม ไม่ใช่กับคนที่กด (FR-RS-04) */
export function writeDispute(ref: MatchRef, reason: string): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  const u = actor(s)
  m.status = 'disputed'
  m.disputedBy = u
  m.disputedTeam = s.teams.find(t => t.members.includes(u ?? '') && [m.a, m.b].includes(t.id))?.id ?? null
  m.note = reason || m.note
  commitStore()
  return true
}

/** ผู้จัดชี้ขาด — แก้สกอร์ได้ด้วยถ้าส่งมา แล้วปิดเป็น confirmed (FR-RS-04) */
export function writeResolve(ref: MatchRef, score?: ScoreInput): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  if (score) {
    m.sa = score.a
    m.sb = score.b
    m.decider = score.decider ?? null
  }
  m.status = 'confirmed'
  m.confirmedBy = actor(s)
  m.confirmedByOrg = true
  m.disputedBy = null
  m.disputedTeam = null
  advance(s, m)
  commitStore()
  return true
}

/**
 * สถิติรายคน — store เก็บ goals/assists เป็นช่องตรง ที่เหลือไปอยู่ใน `x`
 * ชื่อช่องมาจาก `sport_stat_definitions` จึงต่างกันไปตามกีฬา
 */
export function writeStats(
  ref: MatchRef,
  entries: { userId: number; teamId: number; values: Record<string, number> }[],
): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  const userById = new Map(s.users.map(u => [numOf(u.id), u.id]))
  const teamById = new Map(s.teams.map(t => [numOf(t.id), t.id]))

  entries.forEach(e => {
    const uid = userById.get(e.userId)
    const tid = teamById.get(e.teamId)
    if (!uid) return
    const prev: PlayerStat = m.stats[uid] ?? { team: tid ?? '', goals: 0, assists: 0, x: {} }
    /* เก็บด้วย statKey เดิมเสมอ — ฝั่งอ่านต้องได้คีย์เดียวกับที่ sport_stat_definitions
       ประกาศไว้ ('points' ของวอลเลย์บอลไม่ใช่ 'goals') ส่วน goals/assists ที่ store
       มีเป็นช่องตรงเป็นแค่เงาไว้ให้หน้าจอเก่าที่ยังอ่านสองช่องนั้นอยู่ */
    const x: Record<string, number> = { ...prev.x, ...e.values }
    const scoreKey = ['goals', 'points', 'score'].find(k => k in e.values)
    m.stats[uid] = {
      team: tid ?? prev.team,
      goals: scoreKey ? e.values[scoreKey] : prev.goals,
      assists: 'assists' in e.values ? e.values.assists : prev.assists,
      x,
    }
  })
  commitStore()
  return true
}

/** เช็คอิน — store เก็บเป็นรายชื่อผู้ใช้ที่เช็คอินแล้ว (FR-MM-04, FR-PV-03) */
export function writeCheckin(ref: MatchRef, userId?: number): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  const uid = userId !== undefined
    ? s.users.find(u => numOf(u.id) === userId)?.id
    : actor(s)
  if (!uid) return false
  if (!m.checkedIn.includes(uid)) m.checkedIn.push(uid)
  commitStore()
  return true
}

/** กรรมการปฏิเสธการเช็คอิน — ถอดชื่อออกจากรายการ */
export function writeRejectCheckin(ref: MatchRef, userId: number): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  const uid = s.users.find(u => numOf(u.id) === userId)?.id
  if (!uid) return false
  m.checkedIn = m.checkedIn.filter(x => x !== uid)
  commitStore()
  return true
}

/** จัดเวลาและสนาม (FR-MM-02) — SDS §S5 PATCH /matches/{id}/schedule */
export function writeSchedule(
  ref: MatchRef,
  input: { kickoffAt?: string | null; venue?: string | null; roomCode?: string | null },
): boolean {
  const m = findStoreMatch(ref)
  if (!m) return false
  if (input.kickoffAt !== undefined) m.kickoff = input.kickoffAt ?? ''
  if (input.venue !== undefined) m.venue = input.venue ?? ''
  if (input.roomCode !== undefined) m.roomCode = input.roomCode ?? undefined
  commitStore()
  return true
}

/** ผูกลิงก์วิดีโอ (FR-LS-01) — SDS §S7 POST /matches/{id}/stream */
export function writeLivestream(ref: MatchRef, url: string | null): boolean {
  const m = findStoreMatch(ref)
  if (!m) return false
  m.replay = url ?? undefined
  commitStore()
  return true
}

/** มอบหมายกรรมการเข้าแมตช์ — คนละเรื่องกับการแต่งตั้งเข้าทัวร์นาเมนต์ */
export function writeMatchReferees(ref: MatchRef, userIds: number[]): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  m.refs = userIds
    .map(id => s.users.find(u => numOf(u.id) === id)?.id)
    .filter((x): x is string => !!x)
  commitStore()
  return true
}
