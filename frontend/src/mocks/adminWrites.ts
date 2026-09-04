/**
 * src/mocks/adminWrites.ts — ทางเขียนของสไลซ์ 4 ฝั่ง Admin ในโหมด mock
 *
 * เหตุผลเดียวกับ `matchWrites.ts` และ `teamWrites.ts`: `adminBridge` อ่านจาก store
 * ทางเขียนจึงต้องลง store ที่เดียวกัน
 *
 * ── สองเรื่องที่ prototype แทนได้ไม่ตรงนัก ────────────────────────────────
 * `admin_scopes`  schema แยกระดับคณะกับระดับมหาวิทยาลัย แต่ store รู้แค่
 *                 `user.role === 'Admin'` การให้สิทธิ์จึงกลายเป็นระดับมหาวิทยาลัย
 *                 เสมอ ตรงกับที่ `storeAdminScopes()` แปลงกลับออกมาอยู่แล้ว
 * `is_suspended`  เพิ่งเพิ่มเป็นฟิลด์ทางเลือกใน store User (schema มีคอลัมน์นี้อยู่แล้ว)
 *
 * ทั้งไฟล์ตายตอน `VITE_USE_MOCK=false`
 */
import { commitStore, decideTournament, getState } from '../shared/store'
import { numOf } from './storeBridge'
import type { TeamRef } from './teamBridge'
import type { State } from '../shared/types'

const userOf = (s: State, ref: TeamRef) =>
  s.users.find(u => u.id === String(ref)) ?? s.users.find(u => numOf(u.id) === Number(ref))

/**
 * FR-TC-02 — Admin พิจารณาคำขอจัดทัวร์นาเมนต์
 * `storeTournamentRequests()` ใช้ `numOf(tournament.id)` เป็น id ของคำขอ
 * เพราะ prototype เก็บคำขอเป็นทัวร์นาเมนต์สถานะ pending ไม่ใช่ตารางแยก
 * คืน id ของทัวร์นาเมนต์ใน store เพื่อให้ผู้เรียกหาแถวคืนได้
 */
export function writeReviewTournamentRequest(requestId: TeamRef, approve: boolean): string | null {
  const s = getState()
  const raw = String(requestId)
  const t = s.tournaments.find(x => x.id === raw)
    ?? s.tournaments.find(x => numOf(x.id) === Number(requestId))
  if (!t) return null
  decideTournament(t.id, approve)
  return t.id
}

/**
 * FR-UM-05 — ระงับหรือยกเลิกการระงับบัญชี
 * ผู้ที่ถูกระงับต้องเข้าสู่ระบบไม่ได้ และไม่นับเป็นสมาชิกทีมที่ลงแข่งได้
 * ข้อหลังจะมีผลเมื่อฝั่งอ่านเริ่มกรองด้วย `suspended` — ตอนนี้เก็บค่าไว้ก่อน
 */
export function writeSuspendUser(userId: TeamRef, suspend: boolean, reason?: string): boolean {
  const s = getState()
  const u = userOf(s, userId)
  if (!u) return false
  u.suspended = suspend
  u.suspendedReason = suspend ? (reason ?? null) : null
  commitStore()
  return true
}

/**
 * ให้สิทธิ์ผู้ดูแล — store มีแค่ `role` จึงเป็นระดับมหาวิทยาลัยเสมอ
 * ระดับคณะยังไม่มีที่เก็บ ผู้เรียกควรบอกผู้ใช้ให้ชัดว่าได้สิทธิ์ระดับไหนจริง
 */
export function writeGrantAdminScope(userId: TeamRef): boolean {
  const s = getState()
  const u = userOf(s, userId)
  if (!u) return false
  u.role = 'Admin'
  commitStore()
  return true
}

/**
 * เพิกถอนสิทธิ์ — `storeAdminScopes()` สร้าง id เป็น `numOf(user.id) + 1`
 * จึงย้อนกลับด้วยการลบหนึ่งก่อนค้นหา
 */
export function writeRevokeAdminScope(scopeId: TeamRef): boolean {
  const s = getState()
  const u = s.users.find(x => numOf(x.id) === Number(scopeId) - 1)
  if (!u) return false
  u.role = 'User'
  commitStore()
  return true
}
