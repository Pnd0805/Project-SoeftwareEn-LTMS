/**
 * src/mocks/adminBridge.ts — Person 4, temporary like its siblings
 *
 * แปลง entity ของ store เป็น DTO ฝั่ง Admin/Referee
 * ใช้ `numOf` และ `asUser` ร่วมกับ storeBridge/teamBridge — id ตรงกันทุกสไลซ์
 *
 * ⚠️ สองอย่างที่ store ไม่มีเลย จึงคืนว่างแทนที่จะกุขึ้นมา
 *      `admin_scopes`  prototype มีแค่ `user.role === 'Admin'` ไม่มีระดับคณะ
 *      `audit_logs`    ไม่มีการบันทึกประวัติในหน่วยความจำเลย
 *    ของว่างที่ตรงไปตรงมา ดีกว่าตารางปลอมที่ทำให้คิดว่าฟีเจอร์เสร็จแล้ว
 */
import { getState } from '../shared/store'
import { refsNeeded } from '../shared/rules'
import { MOCK_NOW, numOf } from './storeBridge'
import { asUser, unknownUser, type TeamRef } from './teamBridge'
import type {
  TournamentRequestDto, TournamentRefereeDto, RefereeCoverageDto,
  AdminScopeDto, UserAdminViewDto, AuditLogDto,
} from '../types/admin.dto'

// ── คิวอนุมัติทัวร์นาเมนต์ (FR-TC-02) ──────────────────────────────────────

export function storeTournamentRequests(): TournamentRequestDto[] {
  const s = getState()
  return s.tournaments
    .filter(t => t.status === 'pending')
    .map(t => ({
      id: numOf(t.id),
      name: t.name,
      sportName: t.sport,
      requestedBy: asUser(s, t.organizer) ?? unknownUser,
      /* store ใช้ 'pending'/'private'/'public' — schema ละเอียดกว่านั้น */
      status: 'pending_approval' as const,
      eventStartDate: t.date,
      eventEndDate: null,
      venue: t.venue || null,
      maxTeams: t.cap,
      minTeams: 2,
      entryRules: {
        gender: t.rules.gender === 'any' ? 'any' : t.rules.gender === 'Male' ? 'male' : 'female',
        minAge: t.rules.ageMin === 'any' ? null : t.rules.ageMin,
        maxAge: t.rules.ageMax === 'any' ? null : t.rules.ageMax,
      },
      requestedAt: MOCK_NOW,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
    }))
}

// ── กรรมการ (FR-RM-01, FR-RM-02) ──────────────────────────────────────────

export function storeTournamentReferees(ref: TeamRef): TournamentRefereeDto[] {
  const s = getState()
  const raw = String(ref)
  const t = s.tournaments.find(x => x.id === raw) ?? s.tournaments.find(x => numOf(x.id) === Number(ref))
  if (!t) return []

  /* คนที่ตอบรับแล้วอยู่ใน t.referees · คำเชิญที่ยังค้างอยู่ใน refInvites
     store แยกสองที่ schema รวมเป็นแถวเดียวที่มี invitation_status */
  const accepted = (t.referees ?? []).map(uid => ({
    uid, status: 'accepted' as const, inviteId: `acc-${uid}`,
  }))
  const pending = s.refInvites
    .filter(i => i.tour === t.id && i.status === 'pending')
    .map(i => ({ uid: i.user, status: 'pending' as const, inviteId: i.id }))

  return [...accepted, ...pending].map(r => ({
    id: numOf(r.inviteId),
    tournamentId: numOf(t.id),
    user: asUser(s, r.uid) ?? unknownUser,
    invitedBy: asUser(s, t.organizer) ?? unknownUser,
    invitationStatus: r.status,
    /* prototype ไม่มีแนวคิดกรรมการภายนอก — ทุกคนเป็นนิสิตในระบบ */
    isExternal: false,
    externalApprovalStatus: 'not_required' as const,
    approvedBy: null,
    approvedAt: null,
    createdAt: MOCK_NOW,
    removedAt: null,
    removedBy: null,
    /* FR-RM-01 + FR-RM-02: ตอบรับแล้ว และถ้าเป็นคนนอกต้องอนุมัติแล้วด้วย */
    isActive: r.status === 'accepted',
  }))
}

/**
 * FR-RM-03 — on-site ที่บันทึกสถิติต้องมีกรรมการตอบรับแล้วอย่างน้อย 2 คน
 * `refsNeeded()` ใน rules.ts ถือกฎนี้อยู่แล้ว (onsite 2 · online 1)
 */
export function storeRefereeCoverage(ref: TeamRef): RefereeCoverageDto | null {
  const s = getState()
  const raw = String(ref)
  const t = s.tournaments.find(x => x.id === raw) ?? s.tournaments.find(x => numOf(x.id) === Number(ref))
  if (!t) return null
  const required = refsNeeded(t)
  const accepted = (t.referees ?? []).length
  const shortfall = Math.max(0, required - accepted)
  return {
    tournamentId: numOf(t.id),
    required,
    accepted,
    shortfall,
    blocksStatRecording: t.channel === 'onsite' && shortfall > 0,
  }
}

// ── ผู้ใช้ในมุมของ Admin (FR-UM-05) ───────────────────────────────────────

export function storeUsersForAdmin(): UserAdminViewDto[] {
  const s = getState()
  /* ดึง scope มาครั้งเดียวแล้วทำดัชนี — เดิมเรียก storeAdminScopes() ในลูป
     แปลว่า getState() 97 ครั้งและวน filter 97×97 รอบ ต่อการโหลดหน้าเดียว */
  const scopesByUser = new Map<number, AdminScopeDto[]>()
  for (const sc of storeAdminScopes()) {
    const list = scopesByUser.get(sc.user.id)
    if (list) list.push(sc); else scopesByUser.set(sc.user.id, [sc])
  }
  return s.users.map(u => ({
    user: { id: numOf(u.id), fullName: u.name, avatarUrl: null },
    email: u.email,
    userType: u.role === 'Admin' ? 'staff' : 'student',
    facultyName: u.faculty || null,
    /* prototype ไม่มีการระงับบัญชี — คอลัมน์ users.is_suspended มีใน schema แล้ว */
    isSuspended: false,
    suspendedReason: null,
    adminScopes: scopesByUser.get(numOf(u.id)) ?? [],
    teamCount: s.teams.filter(t => t.members.includes(u.id)).length,
  }))
}

/**
 * `admin_scopes` ไม่มีใน store — prototype รู้แค่ `role === 'Admin'`
 * แปลงคนที่เป็น Admin ให้เป็น scope ระดับมหาวิทยาลัย ซึ่งเป็นค่าที่ใกล้ที่สุด
 * ระดับคณะยังไม่มีข้อมูลให้แปลง
 */
export function storeAdminScopes(): AdminScopeDto[] {
  const s = getState()
  return s.users.filter(u => u.role === 'Admin').map(u => ({
    id: numOf(u.id) + 1,
    user: { id: numOf(u.id), fullName: u.name, avatarUrl: null },
    scopeType: 'university_wide' as const,
    facultyId: null,
    facultyName: null,
    createdAt: MOCK_NOW,
    createdBy: null,
  }))
}

/** `audit_logs` ไม่มีใน store เลย — คืนว่าง ไม่กุขึ้นมา */
export function storeAuditLogs(): AuditLogDto[] {
  return []
}
