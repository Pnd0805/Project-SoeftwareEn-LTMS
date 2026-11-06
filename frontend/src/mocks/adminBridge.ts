/**
 * src/mocks/adminBridge.ts — Person 4, temporary like its siblings
 *
 * แปลง entity ของ store เป็น DTO ฝั่ง Admin/Referee
 * ใช้ `numOf` และ `asUser` ร่วมกับ storeBridge/teamBridge — id ตรงกันทุกสไลซ์
 *
 * ⚠️ `audit_logs` ไม่มีการบันทึกประวัติในหน่วยความจำเลย จึงคืนว่างแทนที่จะกุขึ้นมา
 *    `admin_scopes` prototype มีแค่ `user.role === 'Admin'` ไม่มีระดับคณะ
 */
import { getState } from '../shared/store'
import { refsNeeded } from '../shared/rules'
import { MOCK_NOW, numOf } from './storeBridge'
import { asUser, unknownUser, type TeamRef } from './teamBridge'
import type {
  TournamentRequestDto, TournamentRefereeDto, RefereeCoverageDto,
  AdminScopeDto, UserAdminViewDto, AuditLogDto, MyRefereeInvitationDto, ExternalRefereeRequestDto,
} from '../types/admin.dto'
import type { ExternalApprovalStatus } from '../types/enums'

// ── แปลง id ตัวเลขกลับเป็น id ของ store ───────────────────────────────────
/**
 * `numOf` เป็นแฮชทางเดียว การย้อนกลับจึงต้องกวาดหาตัวที่แฮชตรงกัน
 * ใช้เฉพาะตอนรับคำสั่งเขียนจาก UI ที่ถือ id ตัวเลขของ DTO อยู่
 * ตายพร้อมสะพานตอน `VITE_USE_MOCK=false`
 */
const resolve = <T extends { id: string }>(rows: T[], ref: TeamRef): T | undefined => {
  const raw = String(ref)
  return rows.find(r => r.id === raw) ?? rows.find(r => numOf(r.id) === Number(ref))
}

export const storeTournamentIdOf = (ref: TeamRef): string | undefined =>
  resolve(getState().tournaments, ref)?.id

export const storeUserIdOf = (ref: TeamRef): string | undefined =>
  resolve(getState().users, ref)?.id

export const storeRefInviteIdOf = (ref: TeamRef): string | undefined =>
  resolve(getState().refInvites, ref)?.id

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

interface RefereeRow {
  uid: string
  status: 'accepted' | 'pending'
  inviteId: string
  approval: ExternalApprovalStatus
}

export function storeTournamentReferees(ref: TeamRef): TournamentRefereeDto[] {
  const s = getState()
  const raw = String(ref)
  const t = s.tournaments.find(x => x.id === raw) ?? s.tournaments.find(x => numOf(x.id) === Number(ref))
  if (!t) return []
  const referees = t.referees ?? []
  const isExternalUser = (uid: string) => !!s.users.find(u => u.id === uid)?.external

  /* คนที่มีสิทธิ์แล้วอยู่ใน t.referees · คำเชิญที่ยังค้าง และบุคคลภายนอกที่ตอบรับแล้ว
     แต่ยังไม่ผ่าน Admin อยู่ใน refInvites — schema รวมเป็นแถวเดียวที่มีทั้งสองสถานะ */
  const active: RefereeRow[] = referees.map(uid => ({
    uid, status: 'accepted', inviteId: `acc-${uid}`,
    approval: isExternalUser(uid) ? 'approved' : 'not_required',
  }))
  const waiting: RefereeRow[] = s.refInvites
    .filter(i => i.tour === t.id && !referees.includes(i.user)
      && (i.status === 'pending' || (i.status === 'accepted' && !!i.external && i.approval !== 'approved')))
    .map(i => ({
      uid: i.user,
      status: i.status === 'pending' ? 'pending' : 'accepted',
      inviteId: i.id,
      approval: i.external || isExternalUser(i.user) ? (i.approval ?? 'pending') : 'not_required',
    }))

  return [...active, ...waiting].map(r => ({
    id: numOf(r.inviteId),
    tournamentId: numOf(t.id),
    user: asUser(s, r.uid) ?? unknownUser,
    invitedBy: asUser(s, t.organizer) ?? unknownUser,
    invitationStatus: r.status,
    isExternal: r.approval !== 'not_required',
    externalApprovalStatus: r.approval,
    approvedBy: null,
    approvedAt: null,
    createdAt: MOCK_NOW,
    removedAt: null,
    removedBy: null,
    /* FR-RM-01 + FR-RM-02: ตอบรับแล้ว และถ้าเป็นคนนอกต้องอนุมัติแล้วด้วย */
    isActive: r.status === 'accepted' && (r.approval === 'not_required' || r.approval === 'approved'),
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

/**
 * FR-RM-02 — บุคคลภายนอกที่ตอบรับแล้วและรอ Admin
 * id ของคำขอคือ `numOf(refInvite.id)` · Admin ตัดสินผ่าน `writeReviewExternalReferee`
 */
export function storeExternalRefereeRequests(): ExternalRefereeRequestDto[] {
  const s = getState()
  return s.refInvites
    .filter(i => i.external && i.status === 'accepted' && i.approval === 'pending')
    .map(i => {
      const t = s.tournaments.find(x => x.id === i.tour)
      return {
        id: numOf(i.id),
        tournament: { id: t ? numOf(t.id) : 0, name: t?.name ?? '—' },
        referee: asUser(s, i.user) ?? unknownUser,
        invitedBy: t ? asUser(s, t.organizer) ?? unknownUser : unknownUser,
        status: 'pending' as const,
        createdAt: MOCK_NOW,
      }
    })
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
    userType: u.external ? 'external' : u.role === 'Admin' ? 'staff' : 'student',
    facultyName: u.faculty || null,
    isSuspended: !!u.suspended,
    suspendedReason: u.suspendedReason ?? null,
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

/** คำเชิญกรรมการของผู้ใช้ปัจจุบัน */
export function storeMyRefereeInvitations(): MyRefereeInvitationDto[] {
  const s = getState()
  const u = s.session ? s.users.find(x => x.id === s.session) : null
  if (!u) return []
  return s.refInvites
    .filter(i => i.user === u.id && i.status === 'pending')
    .map(i => {
      const t = s.tournaments.find(x => x.id === i.tour)
      return {
        id: numOf(i.id),
        tournament: {
          id: t ? numOf(t.id) : 0,
          name: t ? t.name : '—',
          sportTypeId: 1,
          eventStartDate: t ? t.date : MOCK_NOW,
        },
        isExternal: !!i.external,
        createdAt: MOCK_NOW,
      }
    })
}
