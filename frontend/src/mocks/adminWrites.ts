/**
 * src/mocks/adminWrites.ts — ทางเขียนของสไลซ์ 4 ฝั่ง Admin ในโหมด mock
 *
 * เหตุผลเดียวกับ `matchWrites.ts` และ `teamWrites.ts`: `adminBridge` อ่านจาก store
 * ทางเขียนจึงต้องลง store ที่เดียวกัน · ทางที่ทำไม่ได้คืน WriteBlock รูปเดียวกับ
 * error ของ backend ให้หน้าจอบอกผู้ใช้ได้ตรงๆ
 *
 * ── สองเรื่องที่ prototype แทนได้ไม่ตรงนัก ────────────────────────────────
 * `admin_scopes`  schema แยกระดับคณะกับระดับมหาวิทยาลัย แต่ store รู้แค่
 *                 `user.role === 'Admin'` การให้สิทธิ์จึงกลายเป็นระดับมหาวิทยาลัย
 *                 เสมอ ตรงกับที่ `storeAdminScopes()` แปลงกลับออกมาอยู่แล้ว
 * `is_suspended`  เก็บเป็นฟิลด์ทางเลือกใน store User (schema มีคอลัมน์นี้อยู่แล้ว)
 *
 * ── กรรมการภายนอก (FR-RM-02) ──────────────────────────────────────────────
 * ตอบรับแล้วยังไม่นับเป็นกรรมการของรายการจนกว่า Admin จะอนุมัติ `store.answerAppointment`
 * ใส่ชื่อลง `tr.referees` ทันที ทางของบุคคลภายนอกจึงเขียนเองในไฟล์นี้
 *
 * ทั้งไฟล์ตายตอน `VITE_USE_MOCK=false`
 */
import {
  answerAppointment, appointReferee, commitStore, decideTournament, getState, notifyStore,
} from '../shared/store'
import { me } from '../shared/selectors'
import { numOf } from './storeBridge'
import type { TeamRef } from './teamBridge'
import type { WriteBlock } from './teamWrites'
import type { State } from '../shared/types'

const block = (status: number, code: string, message: string): WriteBlock => ({ status, code, message })

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

// ── บัญชีผู้ใช้ (FR-UM-05) ─────────────────────────────────────────────────

/**
 * ระงับหรือยกเลิกการระงับบัญชี
 * ผู้ที่ถูกระงับเข้าสู่ระบบไม่ได้ (auth.mock) และไม่ผ่าน Hard filter (rules.ts)
 */
export function writeSuspendUser(userId: TeamRef, suspend: boolean, reason?: string): WriteBlock | null {
  const s = getState()
  const u = userOf(s, userId)
  if (!u) return block(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้ในระบบ')
  const why = reason?.trim() ?? ''
  if (suspend) {
    if (u.id === me(s)?.id) return block(409, 'CANNOT_SUSPEND_SELF', 'ระงับบัญชีของตัวเองไม่ได้')
    if (u.role === 'Admin') {
      return block(409, 'USER_IS_ADMIN', `${u.name} เป็นผู้ดูแลระบบ — เพิกถอนสิทธิ์ก่อนจึงระงับบัญชีได้`)
    }
    /* SDS 7.4 — ระงับบัญชีที่ทำผิดกฎ และทุกการระงับต้องตรวจย้อนหลังได้ จึงต้องมีเหตุผล */
    if (!why) return block(400, 'SUSPEND_REASON_REQUIRED', 'กรุณาระบุเหตุผลที่ระงับบัญชี')
  }
  u.suspended = suspend
  u.suspendedReason = suspend ? why : null
  if (!suspend) notifyStore([u.id], 'Your account was reinstated — you can sign in and enter tournaments again.', '/')
  commitStore()
  return null
}

/**
 * ให้สิทธิ์ผู้ดูแล — store มีแค่ `role` จึงเป็นระดับมหาวิทยาลัยเสมอ
 * ระดับคณะยังไม่มีที่เก็บ ผู้เรียกควรบอกผู้ใช้ให้ชัดว่าได้สิทธิ์ระดับไหนจริง
 */
export function writeGrantAdminScope(userId: TeamRef): WriteBlock | null {
  const s = getState()
  const u = userOf(s, userId)
  if (!u) return block(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้ในระบบ')
  if (u.role === 'Admin') return block(409, 'ALREADY_ADMIN', `${u.name} เป็นผู้ดูแลระบบอยู่แล้ว`)
  if (u.suspended) return block(409, 'USER_SUSPENDED', `${u.name} ถูกระงับบัญชีอยู่ — ยกเลิกการระงับก่อน`)
  if (u.external) return block(409, 'USER_IS_EXTERNAL', 'บุคคลภายนอกเป็นผู้ดูแลระบบไม่ได้')
  u.role = 'Admin'
  notifyStore([u.id], 'You were given admin rights.', '/admin')
  commitStore()
  return null
}

/**
 * เพิกถอนสิทธิ์ — `storeAdminScopes()` สร้าง id เป็น `numOf(user.id) + 1`
 * จึงย้อนกลับด้วยการลบหนึ่งก่อนค้นหา
 */
export function writeRevokeAdminScope(scopeId: TeamRef): WriteBlock | null {
  const s = getState()
  const u = s.users.find(x => numOf(x.id) === Number(scopeId) - 1)
  if (!u || u.role !== 'Admin') return block(404, 'SCOPE_NOT_FOUND', 'ไม่พบสิทธิ์ผู้ดูแลนี้')
  if (u.id === me(s)?.id) return block(409, 'CANNOT_REVOKE_SELF', 'เพิกถอนสิทธิ์ของตัวเองไม่ได้')
  if (s.users.filter(x => x.role === 'Admin').length <= 1) {
    return block(409, 'LAST_ADMIN', 'ระบบต้องมีผู้ดูแลอย่างน้อยหนึ่งคน')
  }
  u.role = 'User'
  commitStore()
  return null
}

// ── กรรมการภายนอก (FR-RM-02) ──────────────────────────────────────────────

/**
 * แต่งตั้งกรรมการ — ถ้าผู้ถูกเชิญเป็นบุคคลภายนอก คำเชิญต้องติดธงไว้
 * backend รับ `isExternal` ใน POST /tournaments/:id/referees เหมือนกัน
 */
export function writeAppointReferee(tournamentId: string, userId: string): void {
  appointReferee(tournamentId, userId)
  const s = getState()
  const invite = [...s.refInvites].reverse()
    .find(i => i.tour === tournamentId && i.user === userId && i.status === 'pending')
  if (invite && s.users.find(u => u.id === userId)?.external) {
    invite.external = true
    commitStore()
  }
}

/** ตอบคำเชิญเป็นกรรมการ — บุคคลภายนอกที่ตอบรับไปรอ Admin ก่อนนับเป็นกรรมการ */
export function writeAnswerRefereeInvite(inviteId: string, accept: boolean): void {
  const s = getState()
  const inv = s.refInvites.find(i => i.id === inviteId)
  if (!inv) return
  if (!inv.external || !accept) {
    answerAppointment(inv.id, accept)
    return
  }
  const tr = s.tournaments.find(t => t.id === inv.tour)
  const who = s.users.find(u => u.id === inv.user)?.name ?? 'An external referee'
  inv.status = 'accepted'
  inv.approval = 'pending'
  notifyStore(s.users.filter(u => u.role === 'Admin').map(u => u.id),
    `${who} (external) accepted a referee appointment for ${tr?.name ?? 'a tournament'} and needs your approval.`,
    '/admin/referees')
  notifyStore([tr?.organizer],
    `${who} accepted — an admin has to approve an external referee before they count.`,
    `/t/${inv.tour}/manage/referees`)
  commitStore()
}

/** Admin ตัดสินกรรมการภายนอก — ไม่อนุมัติต้องมีเหตุผล (SDS 7.4) */
export function writeReviewExternalReferee(requestId: TeamRef, approve: boolean, reason?: string): WriteBlock | null {
  const s = getState()
  const inv = s.refInvites.find(i => i.id === String(requestId))
    ?? s.refInvites.find(i => numOf(i.id) === Number(requestId))
  if (!inv || !inv.external) return block(404, 'REQUEST_NOT_FOUND', 'ไม่พบคำขอกรรมการภายนอกนี้')
  if (inv.status !== 'accepted' || inv.approval !== 'pending') {
    return block(409, 'ALREADY_DECIDED', 'คำขอนี้ถูกพิจารณาไปแล้ว')
  }
  const why = reason?.trim() ?? ''
  if (!approve && !why) return block(400, 'REJECT_REASON_REQUIRED', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ')

  const tr = s.tournaments.find(t => t.id === inv.tour)
  const who = s.users.find(u => u.id === inv.user)?.name ?? 'The external referee'
  inv.approval = approve ? 'approved' : 'rejected'
  inv.approvalReason = approve ? null : why
  if (approve && tr && !tr.referees.includes(inv.user)) tr.referees.push(inv.user)

  notifyStore([inv.user], approve
    ? `An admin approved you to officiate ${tr?.name ?? 'the tournament'}.`
    : `An admin did not approve you to officiate ${tr?.name ?? 'the tournament'}: ${why}`, '/matches')
  notifyStore([tr?.organizer], approve
    ? `${who} was approved as an external referee for ${tr?.name ?? 'your tournament'}.`
    : `${who} was not approved as an external referee for ${tr?.name ?? 'your tournament'}: ${why}`,
  `/t/${inv.tour}/manage/referees`)
  commitStore()
  return null
}

/**
 * ผู้จัดถอดกรรมการได้ทุกเมื่อ ทั้งก่อนเปิดรับและระหว่างแข่ง แล้วแต่งตั้งคนเดิมใหม่ได้ทันที
 *
 * schema เก็บแถวไว้พร้อม removed_at / removed_by แต่ store ไม่มีช่องนี้ จึงลบคำเชิญทิ้ง
 * ผลต่อหน้าจอเท่ากัน: แถวหายจากรายชื่อ และเชิญซ้ำได้ (referee.service ของ backend ก็ดูแค่
 * แถวล่าสุดที่ removed_at ยังว่าง) · ถอนคำเชิญที่ยังไม่ตอบใช้ทางเดียวกัน
 *
 * แมตช์ที่ยังไม่จบเอาชื่อออกด้วย คนที่ไม่ใช่กรรมการของรายการแล้วต้องบันทึกหรือยืนยันผลไม่ได้
 * แมตช์ที่ยืนยันแล้วเก็บชื่อไว้ เพราะเป็นประวัติว่าใครตัดสิน
 */
export function writeRemoveReferee(tournamentRef: TeamRef, userRef: TeamRef): WriteBlock | null {
  const s = getState()
  const tr = s.tournaments.find(t => t.id === String(tournamentRef))
    ?? s.tournaments.find(t => numOf(t.id) === Number(tournamentRef))
  if (!tr) return block(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้')
  if (me(s)?.id !== tr.organizer) return block(403, 'NOT_ORGANIZER', 'เฉพาะผู้จัดรายการนี้ที่ถอดกรรมการได้')

  const u = userOf(s, userRef)
  const active = !!u && tr.referees.includes(u.id)
  const invited = !!u && s.refInvites.some(i => i.tour === tr.id && i.user === u.id && i.status !== 'declined')
  if (!u || (!active && !invited)) {
    return block(404, 'REFEREE_NOT_FOUND', 'คนนี้ไม่ได้เป็นกรรมการหรือได้รับเชิญในรายการนี้')
  }

  tr.referees = tr.referees.filter(id => id !== u.id)
  s.refInvites = s.refInvites.filter(i => !(i.tour === tr.id && i.user === u.id))
  s.matches
    .filter(m => m.tour === tr.id && m.status !== 'confirmed' && m.status !== 'void')
    .forEach(m => { m.refs = m.refs.filter(id => id !== u.id) })

  notifyStore([u.id], active
    ? `You are no longer a referee for ${tr.name}.`
    : `Your invitation to officiate ${tr.name} was withdrawn.`, '/matches')
  commitStore()
  return null
}
