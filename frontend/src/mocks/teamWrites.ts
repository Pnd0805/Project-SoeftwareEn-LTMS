/**
 * src/mocks/teamWrites.ts — ทางเขียนของสไลซ์ 4 ฝั่งทีม ในโหมด mock
 *
 * เหตุผลเดียวกับ `matchWrites.ts`: `teamBridge` อ่านจาก store ฉะนั้นทางเขียนก็ต้อง
 * ลง store ที่เดียวกัน ไม่งั้นได้สองแหล่งความจริงที่ค่อยๆ เพี้ยนออกจากกัน
 *
 * ส่วนใหญ่ส่งต่อให้ฟังก์ชันที่ prototype มีอยู่แล้ว (createTeam, invitePlayer, ...)
 * เพราะฟังก์ชันพวกนั้นถือกฎธุรกิจอยู่ด้วย เขียนเองใหม่จะได้กฎที่ไม่ตรงกับหน้าจอเดิม
 *
 * ── ทำไมคืน WriteBlock แทน boolean ────────────────────────────────────────
 * เดิมคืน true/false แล้วชั้น API ตอบ 404 ทุกกรณี — ถอนผู้เล่นตอนทีมถูกล็อกจึงได้
 * "สำเร็จ" ทั้งที่ store ไม่ได้ถอน (kickPlayer แค่ขึ้น toast แล้ว return) ตอนนี้ทุกทาง
 * ที่ทำไม่ได้คืนเหตุผลรูปเดียวกับ error ของ backend ให้หน้าจอบอกผู้ใช้ได้ตรงๆ
 *
 * ── กฎรายชื่อ ──────────────────────────────────────────────────────────────
 * ก่อนรายการที่ทีมได้ที่นั่งเริ่มแข่ง เพิ่มและถอนผู้เล่นได้ หลังเริ่มทั้งสองอย่างล็อก
 * จนรายการจบ (shared/rules.ts rosterLockOf) · backend ยังไม่ตรวจข้อนี้ — ดู
 * FEAT-1-REMAINING.md หมวด backend blockers
 *
 * ทั้งไฟล์ตายตอน `VITE_USE_MOCK=false`
 */
import {
  answerInvite, commitStore, createTeam as storeCreateTeam, decidePermanent,
  disbandTeam as storeDisband, getState, invitePlayer, notifyStore, requestPermanent,
  transferLeader as storeTransferLeader,
} from '../shared/store'
import { me } from '../shared/selectors'
import { SPORTS, joinFails, positionOf, rosterLockOf, startersAllowed } from '../shared/rules'
import { numOf } from './storeBridge'
import { findStoreTeam, type TeamRef } from './teamBridge'
import type { State, Team } from '../shared/types'

/** เหตุผลที่ทำไม่ได้ — รูปเดียวกับ error ของ backend ให้ api/ ส่งต่อเป็น ApiError ได้ตรงๆ */
export interface WriteBlock {
  status: number
  code: string
  message: string
  details?: unknown
}

const block = (status: number, code: string, message: string, details?: unknown): WriteBlock =>
  ({ status, code, message, details })

const actor = (s: State): string | null => me(s)?.id ?? null

const userIdOf = (s: State, id: number): string | undefined =>
  s.users.find(u => numOf(u.id) === id)?.id

/** sportTypeId 1..8 เรียงตรงกับ SPORTS ใน rules.ts และ mockSportTypes */
const sportOf = (sportTypeId: number): string => SPORTS[sportTypeId - 1] ?? SPORTS[0]

/** รหัสทีมสั้นๆ ที่ใช้บนชิปและตราทีม — ตัวอักษรหรือตัวเลข 2–3 ตัว */
const CODE_PATTERN = /^[A-Za-z0-9]{2,3}$/

/** ทีมเริ่มแข่งแล้ว — ข้อความเดียวกันทุกทางที่เปลี่ยนรายชื่อ */
function lockedBy(s: State, t: Team, action: string): WriteBlock | null {
  const lock = rosterLockOf(s, t)
  return lock
    ? block(409, 'ROSTER_LOCKED',
      `${t.name} เริ่มแข่ง ${lock.name} แล้ว ${action}ไม่ได้จนกว่ารายการนี้จะจบ`,
      { tournamentId: numOf(lock.id), tournamentName: lock.name })
    : null
}

/**
 * คนใหม่ไม่ผ่านเงื่อนไขของรายการที่ทีมได้ที่นั่งไว้แล้ว
 * ตอบรูปเดียวกับ 422 HARD_FILTER_FAILED ตอนสมัคร เพราะเป็นกฎข้อเดียวกัน (UC-03)
 */
function eligibilityBlock(s: State, t: Team, uid: string): WriteBlock | null {
  const found = joinFails(s, t, uid)
  if (!found.length) return null
  const name = s.users.find(u => u.id === uid)?.name ?? 'ผู้เล่นคนนี้'
  const why = found
    .map(f => `${f.tournament.name} (${f.fails.map(x => `${x.rule} ต้อง ${x.need} แต่เป็น ${x.got}`).join(', ')})`)
    .join(' · ')
  return block(422, 'HARD_FILTER_FAILED',
    `${name} ไม่ผ่านเงื่อนไขของรายการที่ทีมได้ที่นั่งไว้แล้ว — ${why}`,
    found.map(f => ({
      tournamentId: numOf(f.tournament.id),
      tournamentName: f.tournament.name,
      fails: f.fails.map(x => ({ rule: x.rule, need: x.need, got: x.got })),
    })))
}

// ── ทีม ───────────────────────────────────────────────────────────────────

/** FR-TM-01 — คืน id ตัวเลขของทีมที่เพิ่งสร้าง หรือเหตุผลที่สร้างไม่ได้ */
export function writeCreateTeam(
  input: { name: string; sportTypeId: number; code?: string; color?: string },
): number | WriteBlock {
  const s = getState()
  const leader = actor(s)
  if (!leader) return block(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อนสร้างทีม')
  const name = input.name.trim()
  if (!name) return block(400, 'VALIDATION_FAILED', 'กรุณาระบุชื่อทีม')
  const sport = sportOf(input.sportTypeId)

  /* FR-TM-01 — ชื่อซ้ำในกีฬาเดียวกันไม่ได้ (UNIQUE(team_name, sport_id)) */
  if (s.teams.some(t => t.sport === sport && t.name.trim().toLowerCase() === name.toLowerCase())) {
    return block(409, 'TEAM_NAME_TAKEN', 'มีทีมชื่อนี้ในประเภทกีฬานี้แล้ว')
  }
  /* UC-02 — ทีม Unofficial ไม่เกิน 5 ทีมต่อคน */
  if (s.teams.filter(t => !t.permanent && !t.disabled && t.members.includes(leader)).length >= 5) {
    return block(422, 'TEAM_QUOTA_EXCEEDED', 'คุณมีทีม Unofficial ครบ 5 ทีมแล้ว')
  }

  const id = storeCreateTeam({
    name,
    code: input.code ?? name.slice(0, 3),
    sport,
    color: input.color ?? '#4f46e5',
  }, leader)
  return numOf(id)
}

/**
 * FR-TM-04 — แก้ชื่อ รหัส และโลโก้ของทีม
 * ชื่อซ้ำกับทีมอื่นในกีฬาเดียวกันไม่ได้ — backend ตอบ 409 TEAM_NAME_TAKEN แบบเดียวกัน
 */
export function writeUpdateTeam(
  ref: TeamRef,
  input: { name?: string; code?: string; color?: string; logoUrl?: string | null },
): WriteBlock | null {
  const s = getState()
  const t = findStoreTeam(ref)
  if (!t) return block(404, 'TEAM_NOT_FOUND', 'ไม่พบทีมนี้ในระบบ')

  const name = input.name?.trim()
  if (name !== undefined) {
    if (!name) return block(400, 'VALIDATION_FAILED', 'กรุณาใส่ชื่อทีม')
    if (s.teams.some(x => x.id !== t.id && x.sport === t.sport && x.name.trim().toLowerCase() === name.toLowerCase())) {
      return block(409, 'TEAM_NAME_TAKEN', 'มีทีมชื่อนี้ในประเภทกีฬานี้แล้ว')
    }
  }
  const code = input.code?.trim()
  if (code !== undefined && !CODE_PATTERN.test(code)) {
    return block(400, 'VALIDATION_FAILED', 'รหัสทีมต้องเป็นตัวอักษรหรือตัวเลข 2–3 ตัว')
  }

  if (name !== undefined) t.name = name
  if (code !== undefined) t.code = code.toUpperCase()
  if (input.color !== undefined) t.color = input.color
  /* null = เอารูปออก · undefined = ไม่แตะ จึงต้องเทียบกับ undefined ไม่ใช่ falsy */
  if (input.logoUrl !== undefined) t.logo = input.logoUrl ?? undefined
  commitStore()
  return null
}

/**
 * FR-TM-04 — ตัวจริง/ตัวสำรอง (team_members.position)
 *
 * ตัวจริงเกินจำนวนที่กีฬาลงสนามได้ไม่ได้ (SDS Sport.validateRoster) · ตั้งครั้งแรกแล้ว
 * บันทึกตำแหน่งของทุกคนไว้ ไม่งั้นพอมีคนเข้าออก ลำดับเลื่อนแล้วตำแหน่งของคนอื่นเปลี่ยนเอง
 * ตำแหน่งไม่ได้เปลี่ยนว่าใครอยู่ในทีม จึงไม่ติดกฎล็อกรายชื่อ
 */
export function writeSetMemberPosition(
  ref: TeamRef,
  userId: number,
  position: 'starter' | 'substitute',
): WriteBlock | null {
  const s = getState()
  const t = findStoreTeam(ref)
  if (!t) return block(404, 'TEAM_NOT_FOUND', 'ไม่พบทีมนี้ในระบบ')
  const uid = userIdOf(s, userId)
  if (!uid || !t.members.includes(uid)) return block(404, 'USER_NOT_FOUND', 'ผู้ใช้ไม่อยู่ในทีมนี้')
  if (positionOf(t, uid) === position) return null

  if (position === 'starter') {
    const starters = t.members.filter(m => positionOf(t, m) === 'starter').length
    const allowed = startersAllowed(t)
    if (starters >= allowed) {
      return block(422, 'STARTERS_FULL',
        `${t.sport ?? 'กีฬานี้'} ลงสนามได้ ${allowed} คน ตัวจริงครบแล้ว — ย้ายใครสักคนเป็นตัวสำรองก่อน`)
    }
  }

  const next: Record<string, 'starter' | 'substitute'> = {}
  t.members.forEach(m => { next[m] = positionOf(t, m) })
  next[uid] = position
  t.positions = next
  commitStore()
  return null
}

/**
 * FR-TM-05 — ลบได้เฉพาะทีมที่ยังไม่เคยลงแข่ง
 * ทีมที่เคยได้ที่นั่งแล้วเป็นส่วนหนึ่งของประวัติรายการนั้น ลบไปผลแข่งจะไม่มีเจ้าของ
 */
export function writeDisbandTeam(ref: TeamRef): WriteBlock | null {
  const s = getState()
  const t = findStoreTeam(ref)
  if (!t) return block(404, 'TEAM_NOT_FOUND', 'ไม่พบทีมนี้ในระบบ')
  const entered = s.registrations.find(r => r.team === t.id && r.status === 'approved')
  if (entered) {
    const tr = s.tournaments.find(x => x.id === entered.tour)
    return block(409, 'TEAM_HAS_COMPETED',
      `${t.name} เคยได้ที่นั่งใน ${tr?.name ?? 'รายการแข่งขัน'} แล้ว ทีมที่ลงแข่งแล้วลบไม่ได้`)
  }
  storeDisband(t.id)
  return null
}

// ── สมาชิกและคำเชิญ ───────────────────────────────────────────────────────

/** FR-TM-02 — เชิญเข้าทีม (สร้าง Invitation ไม่ใช่ membership) */
export function writeInviteMember(ref: TeamRef, userId: number): WriteBlock | null {
  const s = getState()
  const t = findStoreTeam(ref)
  if (!t) return block(404, 'TEAM_NOT_FOUND', 'ไม่พบทีมนี้ในระบบ')
  const uid = userIdOf(s, userId)
  if (!uid) return block(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้ในระบบ')
  if (t.members.includes(uid)) return block(409, 'ALREADY_MEMBER', 'ผู้ใช้นี้อยู่ในทีมแล้ว')
  if (s.invites.some(i => i.team === t.id && i.user === uid && i.status === 'pending')) {
    return block(409, 'ALREADY_INVITED', 'ส่งคำเชิญถึงคนนี้ไปแล้ว รอเขาตอบรับ')
  }
  const locked = lockedBy(s, t, 'เพิ่มผู้เล่น')
  if (locked) return locked
  const ineligible = eligibilityBlock(s, t, uid)
  if (ineligible) return ineligible

  invitePlayer(t.id, uid)
  return null
}

/**
 * FR-TM-03 — ตอบรับหรือปฏิเสธคำเชิญ
 * คืน id ของทีมที่คำเชิญนั้นสังกัด เพราะผู้เรียกต้องหาแถวคืนจากคำเชิญของ "ทีม"
 * ไม่ใช่คำเชิญของ "ฉัน" — คนตอบกับคนที่กำลังล็อกอินอยู่อาจไม่ใช่คนเดียวกัน
 */
export function writeAnswerInvitation(invitationId: TeamRef, accept: boolean): string | WriteBlock {
  const s = getState()
  const raw = String(invitationId)
  const inv = s.invites.find(i => i.id === raw)
    ?? s.invites.find(i => numOf(i.id) === Number(invitationId))
  if (!inv) return block(404, 'INVITATION_NOT_FOUND', 'ไม่พบคำเชิญนี้')
  if (inv.status !== 'pending') {
    return block(409, 'INVITATION_ALREADY_ANSWERED', 'คำเชิญนี้ถูกตอบรับหรือปฏิเสธไปแล้ว')
  }

  /* คำเชิญที่ส่งก่อนรายการเริ่มแต่มากดรับหลังเริ่ม ต้องติดกฎเดียวกับตอนเชิญ
     ไม่งั้นกฎล็อกรายชื่อมีรูรั่วให้เข้าทีมกลางรายการได้ */
  const t = s.teams.find(x => x.id === inv.team)
  if (accept && t) {
    const locked = lockedBy(s, t, 'รับสมาชิกเพิ่ม')
    if (locked) return locked
    const ineligible = eligibilityBlock(s, t, inv.user)
    if (ineligible) return ineligible
  }

  answerInvite(inv.id, accept)
  return inv.team
}

/** DELETE /teams/:id/invitations/:iid — ยกเลิกคำเชิญที่ยังไม่มีคนตอบ */
export function writeCancelInvitation(ref: TeamRef, invitationId: number): WriteBlock | null {
  const s = getState()
  const t = findStoreTeam(ref)
  const inv = t ? s.invites.find(i => i.team === t.id && numOf(i.id) === invitationId) : undefined
  if (!t || !inv) return block(404, 'INVITATION_NOT_FOUND', 'ไม่พบคำเชิญนี้')
  if (inv.status !== 'pending') {
    return block(409, 'INVITATION_ALREADY_ANSWERED', 'คำเชิญนี้ถูกตอบรับหรือปฏิเสธไปแล้ว ยกเลิกไม่ได้')
  }
  s.invites = s.invites.filter(i => i.id !== inv.id)
  commitStore()
  return null
}

/**
 * ถอนผู้เล่นออกจากทีม
 *
 * ถอนได้จนกว่ารายการที่ทีมได้ที่นั่งจะเริ่มแข่ง — เดิมใช้ `kickPlayer` ของ store
 * ซึ่งล็อกตั้งแต่ได้รับอนุมัติ และขึ้นแค่ toast แล้ว return ชั้น API จึงตอบว่าสำเร็จ
 * ทั้งที่ไม่มีใครถูกถอน
 */
export function writeKickMember(ref: TeamRef, userId: number): WriteBlock | null {
  const s = getState()
  const t = findStoreTeam(ref)
  if (!t) return block(404, 'TEAM_NOT_FOUND', 'ไม่พบทีมนี้ในระบบ')
  const uid = userIdOf(s, userId)
  if (!uid || !t.members.includes(uid)) return block(404, 'USER_NOT_FOUND', 'ผู้ใช้ไม่อยู่ในทีมนี้')
  /* ถอนหัวหน้าทีมแล้วทีมจะไม่มีคนตัดสินใจ — backend ตอบ 403 เหมือนกัน ต้องโอนสิทธิ์ก่อน (FR-TM-08) */
  if (t.leader === uid) return block(403, 'FORBIDDEN', 'ถอนหัวหน้าทีมไม่ได้ — โอนสิทธิ์หัวหน้าให้คนอื่นก่อน')
  const locked = lockedBy(s, t, 'ถอนผู้เล่น')
  if (locked) return locked

  t.members = t.members.filter(x => x !== uid)
  if (t.positions) delete t.positions[uid]
  /* รายชื่อผู้ลงของรายการที่ยังไม่จบต้องไม่มีคนที่ออกไปแล้ว
     ของรายการที่จบแล้วเป็นประวัติ (MATCH_PARTICIPANT เป็นสแนปช็อต) เก็บไว้ตามเดิม */
  s.registrations.forEach(r => {
    if (r.team !== t.id || !r.squad.includes(uid)) return
    const tr = s.tournaments.find(x => x.id === r.tour)
    if (tr && !tr.champion) r.squad = r.squad.filter(x => x !== uid)
  })
  notifyStore([uid], `You were removed from ${t.name}.`, '/teams')
  commitStore()
  return null
}

/** FR-TM-08 — โอนสิทธิ์หัวหน้าทีม */
export function writeTransferLeader(ref: TeamRef, targetUserId: number): boolean {
  const s = getState()
  const t = findStoreTeam(ref)
  const uid = userIdOf(s, targetUserId)
  if (!t || !uid || t.leader === uid || !t.members.includes(uid)) return false
  storeTransferLeader(t.id, uid)
  return true
}

// ── คำร้องถึง Admin ───────────────────────────────────────────────────────

/** FR-TM-06 — ยื่นขอเป็นทีม Official พร้อมเอกสารประกอบ (team.schema.ts requestSchema) */
export function writeRequestOfficial(ref: TeamRef, supportingDocs: string[]): WriteBlock | null {
  const s = getState()
  const t = findStoreTeam(ref)
  const by = actor(s)
  if (!t) return block(404, 'TEAM_NOT_FOUND', 'ไม่พบทีมนี้ในระบบ')
  if (!by) return block(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบก่อน')
  const docs = supportingDocs.map(d => d.trim()).filter(Boolean)
  if (!docs.length) return block(400, 'OFFICIAL_DOCS_REQUIRED', 'กรุณาแนบเอกสารประกอบคำร้อง')
  if (t.permanent) return block(409, 'ALREADY_OFFICIAL', `${t.name} เป็นทีม Official อยู่แล้ว`)
  if (s.permanentRequests.some(r => r.team === t.id && r.status === 'pending')) {
    return block(409, 'REQUEST_PENDING', 'มีคำร้องของทีมนี้ค้างอยู่กับ Admin แล้ว')
  }
  requestPermanent(t.id, docs.join('\n'), by)
  return null
}

/** FR-TM-06 — Admin ตัดสินคำร้อง · คืน id ของคำร้องที่เพิ่งตัดสิน */
export function writeReviewTeamRequest(requestId: TeamRef, approve: boolean): string | null {
  const s = getState()
  const raw = String(requestId)
  const req = s.permanentRequests.find(r => r.id === raw)
    ?? s.permanentRequests.find(r => numOf(r.id) === Number(requestId))
  if (!req) return null
  decidePermanent(req.id, approve)
  return req.id
}
