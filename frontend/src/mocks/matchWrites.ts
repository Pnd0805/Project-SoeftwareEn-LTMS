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
import { commitStore, getState, notifyStore } from '../shared/store'
import { me } from '../shared/selectors'
import { winnerId } from '../shared/rules'
import { tour } from '../shared/selectors'
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

/** คนนี้อยู่ในทีมใดทีมหนึ่งของแมตช์นี้ไหม (UC-04) */
export function storeSquadHas(ref: MatchRef, userId: number): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  const uid = s.users.find(u => numOf(u.id) === userId)?.id
  if (!uid) return false
  return [m.a, m.b]
    .filter((x): x is string => !!x)
    .some(tid => s.teams.find(t => t.id === tid)?.members.includes(uid))
}

/**
 * เหตุผลที่แมตช์นี้ยังรับผลไม่ได้ — null แปลว่ารับได้
 *
 * ด่านพวกนี้ซ้อนกับที่หน้าจอกันอยู่แล้ว แต่ชั้น API ถูกเรียกตรงได้ จึงต้องตรวจซ้ำ
 * ทุกข้อคือสถานะที่เกิดขึ้นไม่ได้จริง ไม่ใช่แค่เรื่องสิทธิ์
 */
export function whyResultBlocked(m: StoreMatch): string | null {
  if (!m.a || !m.b) return 'แมตช์นี้ยังไม่รู้คู่แข่งทั้งสองฝั่ง จึงยังบันทึกผลไม่ได้'
  if (m.status === 'confirmed') return 'ผลนัดนี้ยืนยันแล้ว ต้องเปิดข้อโต้แย้งก่อนถึงจะแก้ได้'
  if (m.status === 'void') return 'แมตช์นี้ถูกยกเลิกไปแล้ว'
  return null
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
  if (whyResultBlocked(m)) return false
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
  /* ค้านได้เฉพาะตอนที่ผลยังรอการยืนยัน — ตรงกับ `can.disputeResult` ที่หน้าจอใช้
     ผลที่ปิดไปแล้วต้องให้ผู้จัดเปิดใหม่ ไม่ใช่ค้านซ้อนเข้าไป */
  if (m.status !== 'pending') return false
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

  /* บันทึกสถิติได้เฉพาะคนที่อยู่ในทีมใดทีมหนึ่งของแมตช์นี้
     สถิติของคนนอกจะไหลไปโผล่ในโปรไฟล์และตารางดาวซัลโวโดยไม่มีที่มา */
  const squad = new Set(
    [m.a, m.b].filter((x): x is string => !!x)
      .flatMap(tid => s.teams.find(t => t.id === tid)?.members ?? []),
  )

  entries.forEach(e => {
    const uid = userById.get(e.userId)
    const tid = teamById.get(e.teamId)
    if (!uid || !squad.has(uid)) return
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

/**
 * เช็คอิน (FR-MM-04, FR-PV-03, FR-PV-04)
 *
 * on-site สแกน QR ของกรรมการ ตรงรหัสก็ผ่านทันที — คนที่อยู่หน้างานเท่านั้นที่เห็น QR
 * online ไม่มีอะไรพิสูจน์ว่าอยู่ตรงไหน จึงส่งรูปคู่บัตรแล้วรอกรรมการตรวจ
 * สถานะจึงเป็น `exception` ไม่ใช่ `success` — ยังไม่นับว่าเข้าแล้วจนกว่าจะถูกอนุมัติ
 */
export function writeCheckin(
  ref: MatchRef,
  userId?: number,
  detail?: {
    method?: 'qr_onsite' | 'photo_online' | 'manual_by_referee'
    documentUrl?: string | null
    documentType?: 'student_id' | 'national_id' | null
  },
): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  const uid = userId !== undefined
    ? s.users.find(u => numOf(u.id) === userId)?.id
    : actor(s)
  if (!uid) return false

  /* เช็คอินหลังแมตช์จบไม่มีความหมาย — การเช็คอินคือการยืนยันว่าจะลงเล่น */
  if (m.status === 'confirmed' || m.status === 'void') return false

  /* UC-04 "ผู้ที่ไม่อยู่ในทีมสแกนต้องถูกปฏิเสธ" — หน้าจอวาดเฉพาะรายชื่อในทีมอยู่แล้ว
     แต่ชั้น API ถูกเรียกตรงได้ จึงต้องตรวจซ้ำที่นี่ */
  const inSquad = [m.a, m.b]
    .filter((x): x is string => !!x)
    .some(tid => s.teams.find(t => t.id === tid)?.members.includes(uid))
  if (!inSquad) return false

  const online = tour(s, m.tour)?.channel === 'online'
  const method = detail?.method ?? (online ? 'photo_online' : 'qr_onsite')
  /* รูปที่รอตรวจยังไม่นับเข้า — ยอด "3 of 10" ต้องหมายถึงคนที่ผ่านจริงเท่านั้น */
  const status = method === 'photo_online' ? 'exception' as const : 'success' as const

  m.checkins = m.checkins ?? {}
  m.checkins[uid] = {
    method,
    status,
    documentUrl: detail?.documentUrl ?? null,
    documentType: detail?.documentType ?? null,
    rejectionReason: null,
    at: Date.now(),
    verifiedBy: status === 'success' ? (m.refs[0] ?? null) : null,
  }
  if (status === 'success' && !m.checkedIn.includes(uid)) m.checkedIn.push(uid)
  commitStore()
  return true
}

/** กรรมการอนุมัติรูปที่ส่งมา (FR-PV-04) — นับเข้าเมื่อผ่านแล้วเท่านั้น */
export function writeApproveCheckin(ref: MatchRef, userId: number): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  const uid = s.users.find(u => numOf(u.id) === userId)?.id
  if (!uid) return false
  const rec = m.checkins?.[uid]
  if (rec) {
    rec.status = 'success'
    rec.rejectionReason = null
    rec.verifiedBy = actor(s) ?? m.refs[0] ?? null
  }
  if (!m.checkedIn.includes(uid)) m.checkedIn.push(uid)
  commitStore()
  return true
}

/** กรรมการปฏิเสธ — ถอดออกจากยอด และเก็บเหตุผลไว้ให้ผู้เล่นเห็น */
export function writeRejectCheckin(ref: MatchRef, userId: number, reason?: string): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  const uid = s.users.find(u => numOf(u.id) === userId)?.id
  if (!uid) return false
  m.checkedIn = m.checkedIn.filter(x => x !== uid)
  m.checkins = m.checkins ?? {}
  const prev = m.checkins[uid]
  m.checkins[uid] = {
    method: prev?.method ?? 'manual_by_referee',
    status: 'rejected',
    documentUrl: prev?.documentUrl ?? null,
    documentType: prev?.documentType ?? null,
    rejectionReason: reason ?? 'กรรมการไม่รับหลักฐานนี้',
    at: prev?.at ?? Date.now(),
    verifiedBy: actor(s) ?? m.refs[0] ?? null,
  }
  commitStore()
  return true
}

/** ผู้เล่นทุกคนของทั้งสองทีมในแมตช์นี้ — คนที่ต้องรู้เมื่อมีอะไรเปลี่ยน */
function squadMembers(s: State, m: StoreMatch): string[] {
  return [m.a, m.b]
    .filter((x): x is string => !!x)
    .flatMap(tid => s.teams.find(t => t.id === tid)?.members ?? [])
}

/**
 * จัดเวลา สนาม และรหัสห้อง (FR-MM-02) — SDS §S5 PATCH /matches/{id}/schedule
 *
 * การแข่งแบบ online ไม่มี QR ให้สแกนที่หน้างาน กรรมการจึงประกาศรหัสห้องแทน
 * และรหัสนั้นไร้ประโยชน์ถ้าผู้เล่นไม่รู้ — ประกาศแล้วต้องเด้งเข้า inbox ของทั้ง
 * สองทีมทันที พร้อมลิงก์กลับมาที่แมตช์
 */
export function writeSchedule(
  ref: MatchRef,
  input: { kickoffAt?: string | null; venue?: string | null; roomCode?: string | null },
): boolean {
  const s = getState()
  const m = findStoreMatch(ref)
  if (!m) return false
  const roomBefore = m.roomCode ?? ''
  if (input.kickoffAt !== undefined) m.kickoff = input.kickoffAt ?? ''
  if (input.venue !== undefined) m.venue = input.venue ?? ''
  if (input.roomCode !== undefined) m.roomCode = input.roomCode ?? undefined

  const roomAfter = m.roomCode ?? ''
  if (roomAfter && roomAfter !== roomBefore) {
    const t = s.tournaments.find(x => x.id === m.tour)
    notifyStore(
      squadMembers(s, m),
      `ห้องแข่งของ ${t?.name ?? 'แมตช์'} เปิดแล้ว — รหัส ${roomAfter}`,
      `/m/${m.id}`,
    )
  }
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
