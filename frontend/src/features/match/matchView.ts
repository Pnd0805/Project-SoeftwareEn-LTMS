/**
 * src/features/match/matchView.ts — Person 3
 *
 * ขอบเขตของสไลซ์ 3 ที่แปลงรูป DTO ให้เป็นสิ่งที่ kit วาดได้
 *
 * `MatchState` เป็นภาษากลางของ kit ที่ไม่ผูกกับฝั่งไหน (ดู components/kit/viewModels.ts)
 * ไฟล์นี้คือ "ขอบ" ของโดเมนเรา ที่ map จาก schema มาเข้าภาษากลางนั้น
 */
import { USE_MOCK } from '../../api/client'
import type { MatchState, TeamView } from '../../components/kit/viewModels'
import type { MatchListItemDto, MatchTeamRef } from '../../types/match.dto'

/** `MatchTeamRef` (DTO) → `TeamView` (kit) — ต่างกันแค่ชื่อ field ของโลโก้ */
export const toTeamView = (t: MatchTeamRef | null): TeamView | null =>
  t ? { id: t.id, name: t.name, code: t.code, color: t.color, logoUrl: t.logoUrl } : null

/**
 * สองโมเดลไม่ตรงกัน และความไม่ตรงอยู่ตรงนี้จุดเดียว
 *
 * schema แยก "สถานะแมตช์" (`matches.match_status`) ออกจาก "สถานะผล"
 * (`match_results.status`) ส่วน prototype ยุบรวมเป็นอันเดียว — คำว่า `pending`
 * ของ prototype จริงๆ คือ `match_results.status = 'submitted'` ไม่ใช่สถานะแมตช์
 *
 * ผลชนะสถานะแมตช์เสมอ: ถ้ามีผลยืนยันแล้ว แมตช์จบแล้วไม่ว่า `match_status` จะเป็นอะไร
 */
export function matchStateOf(
  m: Pick<MatchListItemDto, 'status' | 'resultStatus' | 'teamA' | 'teamB' | 'outcome'>,
): MatchState {
  /* จบโดยไม่ได้แข่ง — บายผ่าน / แพ้ทั้งคู่ / แมตช์ตาย (B5 `outcome`) ไม่มีใบผลให้ดู
     ต้องตัดสินก่อนบรรทัดถัดไป ไม่งั้นแมตช์บายที่มีทีมเดียวจะค้างเป็น "รอคู่แข่ง" ตลอดไป */
  if (m.status === 'completed' && m.outcome && m.outcome.kind !== 'played') return 'confirmed'
  if (!m.teamA || !m.teamB) return 'waiting'
  if (m.status === 'disputed' || m.resultStatus === 'disputed') return 'disputed'
  if (m.resultStatus === 'verified' || m.resultStatus === 'walkover') return 'confirmed'
  if (m.resultStatus === 'submitted') return 'pending'
  /* ผู้จัดยกผลทิ้ง (S04 reject) — ใบผลเดิมไม่นับแล้ว รอคนส่งใหม่ (Result thrown out)
     คืน 'rejected' เพื่อแสดงสถานะโดยตรง และระบบเปิดให้ส่งผลใหม่ได้ */
  if (m.status === 'result_rejected' || m.resultStatus === 'rejected') return 'rejected'
  if (m.status === 'completed') return 'pending'   // จบแล้วแต่ยังไม่มีผล = รอคนกรอก
  if (m.status === 'in_progress') return 'live'
  if (m.status === 'checkin_open') return 'checkin'
  return 'scheduled'
}

/**
 * แมตช์ที่จบโดยไม่ได้แข่งจริง เขียนว่าเกิดอะไรขึ้นแทนที่จะปล่อยช่องว่างไว้ให้เดา
 * null = ไม่มีอะไรพิเศษ ให้วาดสกอร์ตามปกติ (โหมด mock ไม่มี `outcome` จึงได้ null เสมอ)
 */
export function outcomeNote(m: Pick<MatchListItemDto, 'outcome'>): string | null {
  switch (m.outcome?.kind) {
    case 'walkover': return 'W/O'
    case 'bye': return 'Bye'
    case 'void': return 'No contest'
    default: return null
  }
}

/** สกอร์เป็นข้อความ — `—` เมื่อยังไม่มีผล ไม่ใช่ `0` */
export const scoreText = (m: Partial<Pick<MatchListItemDto, 'score' | 'outcome'>>): string => {
  const note = outcomeNote(m)
  if (!m.score) return note ?? '— – —'
  /* บายมีสกอร์ประจำกีฬาติดมา เลขอย่างเดียวจึงอ่านเหมือนแข่งจริง — ต่อท้ายว่ามันคืออะไร */
  const text = `${m.score.a ?? '—'} – ${m.score.b ?? '—'}`
  return note ? `${text} · ${note}` : text
}

// ── ถังงานของกรรมการ ────────────────────────────────────────────────────
/**
 * กรรมการหนึ่งคนไม่ได้มีคิวเดียว — onsite กับ online สลับกันว่าใครขยับก่อน
 * onsite: กรรมการอยู่ที่สนาม เป็นคนกรอกผล
 * online: หัวหน้าทีมส่งผลมาก่อน กรรมการเป็นคนยืนยัน
 */
export const REF_BUCKETS = {
  room: { label: 'Needs a room', empty: 'Every online match has its room open.' },
  score: { label: 'Needs your score', empty: 'Nothing waiting on a score right now.' },
  confirm: { label: 'Needs your confirmation', empty: 'No submissions waiting on you.' },
  waiting: { label: 'Waiting on the squads', empty: 'Nothing parked here.' },
} as const

export type RefBucket = keyof typeof REF_BUCKETS

/**
 * งานของกรรมการเรียงตามลำดับที่มันเกิดจริง
 *
 * online: กรรมการเปิดห้องก่อน แล้วทีมที่ชนะส่งผล แล้วกรรมการยืนยัน
 * onsite: ผู้เล่นสแกน QR เข้ามา แล้วกรรมการกรอกผล แล้วหัวหน้าทีมที่ชนะยืนยัน
 *
 * เดิมนัด online ที่ยังไม่มีผลตกไปอยู่ถัง 'waiting' ทั้งหมด ทั้งที่สิ่งที่มันรออยู่คือ
 * กรรมการเปิดห้อง ไม่ใช่รอทีม — กรรมการจึงมองไม่เห็นว่าตัวเองต้องทำอะไรกับนัด online
 */
export function refBucketOf(m: MatchListItemDto): RefBucket {
  const done = m.status === 'completed'
  /* คิว "ประกาศรหัสห้อง" มีความหมายเฉพาะตอนที่ระบบเก็บรหัสห้องได้ — backend ยังไม่มีคอลัมน์นั้น
     ถ้าไม่กันไว้ แมตช์ออนไลน์ทุกนัดจะค้างอยู่ในคิวนี้ตลอดไปเพราะ roomCode เป็น null เสมอ */
  if (USE_MOCK && m.mode === 'online' && !done && m.resultStatus === null && !m.roomCode) return 'room'
  if (m.mode === 'onsite' && m.resultStatus === null && !done) return 'score'
  if (m.mode === 'online' && m.resultStatus === 'submitted') return 'confirm'
  return 'waiting'
}

/**
 * แมตช์ที่ยังไม่จบ — ตัวที่กรรมการต้องเห็นในคิว
 *
 * เดิมเช็คแค่ `resultStatus !== 'verified'` ซึ่งแปลว่าแมตช์ที่ชนะบายไม่มีวันหลุดออกจากคิว
 * (ใบผลของมันเป็น `walkover` ไม่ใช่ `verified`) และแมตช์ที่จบแบบไม่มีใบผลเลยก็เหมือนกัน
 * ตั้งแต่ `3b6ee3d` บายเกิดเองเป็นลูกโซ่ เรื่องนี้เลยกลายเป็นของที่เจอทุกวัน
 * ใช้ `matchStateOf` ตัวเดียวกับที่ป้ายสถานะใช้ จะได้ไม่มีนิยาม "จบแล้ว" สองชุดในแอป
 */
export const isOpen = (m: MatchListItemDto) =>
  !!m.teamA && !!m.teamB && matchStateOf(m) !== 'confirmed'
