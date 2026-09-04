/**
 * src/mocks/teamWrites.ts — ทางเขียนของสไลซ์ 4 ฝั่งทีม ในโหมด mock
 *
 * เหตุผลเดียวกับ `matchWrites.ts`: `teamBridge` อ่านจาก store ฉะนั้นทางเขียนก็ต้อง
 * ลง store ที่เดียวกัน ไม่งั้นได้สองแหล่งความจริงที่ค่อยๆ เพี้ยนออกจากกัน
 *
 * ส่วนใหญ่ส่งต่อให้ฟังก์ชันที่ prototype มีอยู่แล้ว (createTeam, invitePlayer, ...)
 * เพราะฟังก์ชันพวกนั้นถือกฎธุรกิจอยู่ด้วย — เช่น `disbandTeam` เช็ค rosterLock
 * และ `invitePlayer` กันเชิญซ้ำ เขียนเองใหม่จะได้กฎที่ไม่ตรงกับหน้าจอเดิม
 *
 * ทุกฟังก์ชันคืน `false` เมื่อหาเป้าหมายไม่เจอ ผู้เรียกจะได้ตอบ 404 ให้ถูก
 * ทั้งไฟล์ตายตอน `VITE_USE_MOCK=false`
 */
import {
  answerInvite, commitStore, createTeam as storeCreateTeam, decidePermanent,
  disbandTeam as storeDisband, getState, invitePlayer, kickPlayer, requestPermanent,
  transferLeader as storeTransferLeader,
} from '../shared/store'
import { me } from '../shared/selectors'
import { SPORTS } from '../shared/rules'
import { numOf } from './storeBridge'
import { findStoreTeam, type TeamRef } from './teamBridge'
import type { State } from '../shared/types'

const actor = (s: State): string | null => me(s)?.id ?? null

const userIdOf = (s: State, id: number): string | undefined =>
  s.users.find(u => numOf(u.id) === id)?.id

/** sportTypeId 1..8 เรียงตรงกับ SPORTS ใน rules.ts และ mockSportTypes */
const sportOf = (sportTypeId: number): string => SPORTS[sportTypeId - 1] ?? SPORTS[0]

// ── ทีม ───────────────────────────────────────────────────────────────────

/** FR-TM-01 — คืน id ตัวเลขของทีมที่เพิ่งสร้าง หรือ null ถ้ายังไม่ได้ล็อกอิน */
export function writeCreateTeam(
  input: { name: string; sportTypeId: number; code?: string; color?: string },
): number | null {
  const s = getState()
  const leader = actor(s)
  if (!leader) return null
  const id = storeCreateTeam({
    name: input.name,
    code: input.code ?? input.name.slice(0, 3),
    sport: sportOf(input.sportTypeId),
    color: input.color ?? '#4f46e5',
  }, leader)
  return numOf(id)
}

/** FR-TM-04 — แก้ชื่อ รหัส สี ของทีม */
export function writeUpdateTeam(
  ref: TeamRef,
  input: { name?: string; code?: string; color?: string },
): boolean {
  const t = findStoreTeam(ref)
  if (!t) return false
  if (input.name !== undefined) t.name = input.name
  if (input.code !== undefined) t.code = input.code.toUpperCase().slice(0, 3)
  if (input.color !== undefined) t.color = input.color
  commitStore()
  return true
}

/**
 * FR-TM-04 — ตัวจริง/ตัวสำรอง
 *
 * store ไม่มีคอลัมน์ position — `teamBridge` อ่านจากลำดับในอาร์เรย์ `members`
 * (คนแรกๆ เท่าจำนวนขั้นต่ำของกีฬาคือตัวจริง) การตั้งตำแหน่งจึงคือการย้ายลำดับ
 * ซึ่งให้ผลตรงกับสิ่งที่ฝั่งอ่านเห็นจริง ของจริงอ่านจาก team_members.position
 *
 * ⚠️ ทีมที่มีสมาชิกน้อยกว่าจำนวนขั้นต่ำของกีฬาจะขึ้นเป็น starter ทั้งหมดไม่ว่าจะ
 *    ตั้งอะไร เพราะเส้นแบ่งคือ minSquad ไม่ใช่ค่าที่เก็บไว้ — ข้อจำกัดของ prototype
 */
export function writeSetMemberPosition(
  ref: TeamRef,
  userId: number,
  position: 'starter' | 'substitute',
): boolean {
  const s = getState()
  const t = findStoreTeam(ref)
  const uid = userIdOf(s, userId)
  if (!t || !uid || !t.members.includes(uid)) return false
  const rest = t.members.filter(x => x !== uid)
  t.members = position === 'starter' ? [uid, ...rest] : [...rest, uid]
  commitStore()
  return true
}

/** FR-TM-05 — ลบทีม (store เช็ค rosterLock ให้เอง) */
export function writeDisbandTeam(ref: TeamRef): boolean {
  const t = findStoreTeam(ref)
  if (!t) return false
  storeDisband(t.id)
  return true
}

// ── สมาชิกและคำเชิญ ───────────────────────────────────────────────────────

/** FR-TM-02 — เชิญเข้าทีม (สร้าง Invitation ไม่ใช่ membership) */
export function writeInviteMember(ref: TeamRef, userId: number): boolean {
  const s = getState()
  const t = findStoreTeam(ref)
  const uid = userIdOf(s, userId)
  if (!t || !uid) return false
  invitePlayer(t.id, uid)
  return true
}

/**
 * FR-TM-03 — ตอบรับหรือปฏิเสธคำเชิญ
 * คืน id ของทีมที่คำเชิญนั้นสังกัด เพราะผู้เรียกต้องหาแถวคืนจากคำเชิญของ "ทีม"
 * ไม่ใช่คำเชิญของ "ฉัน" — คนตอบกับคนที่กำลังล็อกอินอยู่อาจไม่ใช่คนเดียวกัน
 */
export function writeAnswerInvitation(invitationId: TeamRef, accept: boolean): string | null {
  const s = getState()
  const raw = String(invitationId)
  const inv = s.invites.find(i => i.id === raw)
    ?? s.invites.find(i => numOf(i.id) === Number(invitationId))
  if (!inv) return null
  answerInvite(inv.id, accept)
  return inv.team
}

export function writeKickMember(ref: TeamRef, userId: number): boolean {
  const s = getState()
  const t = findStoreTeam(ref)
  const uid = userIdOf(s, userId)
  if (!t || !uid) return false
  kickPlayer(t.id, uid)
  return true
}

/** FR-TM-08 — โอนสิทธิ์หัวหน้าทีม */
export function writeTransferLeader(ref: TeamRef, targetUserId: number): boolean {
  const s = getState()
  const t = findStoreTeam(ref)
  const uid = userIdOf(s, targetUserId)
  if (!t || !uid) return false
  storeTransferLeader(t.id, uid)
  return true
}

// ── คำร้องถึง Admin ───────────────────────────────────────────────────────

/** FR-TM-06 — ยื่นขอเป็นทีม Official */
export function writeRequestOfficial(ref: TeamRef, reason: string): boolean {
  const s = getState()
  const t = findStoreTeam(ref)
  const by = actor(s)
  if (!t || !by) return false
  requestPermanent(t.id, reason, by)
  return true
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
