/**
 * src/mocks/teamBridge.ts — Person 4, temporary like its sibling
 *
 * แปลง entity ของ store เป็น DTO ของสไลซ์ 4 เหตุผลเดียวกับ `storeBridge.ts`
 * — seed มีทีมจริงพร้อมสมาชิก คำเชิญ และคำร้อง Official อยู่แล้ว เขียน mock มือ
 * ขึ้นมาใหม่จะได้ข้อมูลจนกว่าและ id คนละชุดกับสไลซ์ 3
 *
 * ใช้ `numOf` ตัวเดียวกับ storeBridge เพื่อให้ id ของทีมตรงกันทั้งสองสไลซ์
 * ลบทิ้งพร้อมกันตอน `VITE_USE_MOCK=false`
 *
 * ⚠️ store กับ schema ใช้คำต่างกันสองจุด แปลงตรงนี้จุดเดียว
 *      store `permanent: boolean`   → schema `official_status` enum
 *      store `'declined'`           → schema `'rejected'`
 */
import { getState } from '../shared/store'
import { me } from '../shared/selectors'
import { minSquad, teamReady } from '../shared/rules'
import { numOf } from './storeBridge'
import type { State, Team as StoreTeam } from '../shared/types'
import type {
  TeamDto, TeamInvitationDto, TeamAdminRequestDto, TeamMemberDto, UserRefDto,
  PlayerProfileDto,
} from '../types/team.dto'

export type TeamRef = number | string

const asUser = (s: State, id: string | null | undefined): UserRefDto | null => {
  const u = s.users.find(x => x.id === id)
  return u ? { id: numOf(u.id), fullName: u.name, avatarUrl: null } : null
}

const unknownUser: UserRefDto = { id: 0, fullName: '—', avatarUrl: null }

const teamStub = (t: StoreTeam) => ({
  id: numOf(t.id), name: t.name, code: t.code, color: t.color,
})

/** ทีมนี้เคยลงแข่งหรือยัง — FR-TM-05 ห้ามลบทีมที่กำลังแข่ง */
function competing(s: State, t: StoreTeam) {
  return s.registrations.some(r => r.team === t.id && r.status === 'approved')
}

export function toTeamDto(s: State, t: StoreTeam): TeamDto {
  const u = me(s)
  const isLeader = !!u && t.leader === u.id
  const isMember = !!u && t.members.includes(u.id)
  const inPlay = competing(s, t)

  const members: TeamMemberDto[] = t.members.map(id => ({
    user: asUser(s, id) ?? unknownUser,
    /* store ไม่ได้เก็บ position รายคน — เอาลำดับในทีมมาแทนตามจำนวนขั้นต่ำของกีฬา
       ของจริงอ่านจาก team_members.position (FR-TM-04) */
    position: t.members.indexOf(id) < minSquad(t) ? 'starter' : 'substitute',
    joinedAt: new Date(t.created).toISOString(),
    isLeader: t.leader === id,
  }))

  return {
    id: numOf(t.id),
    name: t.name,
    code: t.code,
    color: t.color,
    logoUrl: t.logo ?? null,
    sportTypeId: 0,
    sportName: t.sport ?? '—',
    leader: asUser(s, t.leader) ?? unknownUser,
    members,
    readinessStatus: teamReady(t) ? 'Ready' : 'Forming',
    officialStatus: t.permanent ? 'Official' : 'Unofficial',
    createdAt: new Date(t.created).toISOString(),
    updatedAt: null,
    lastCompetedAt: null,
    deletedAt: t.disabled ? new Date().toISOString() : null,
    deletedReason: t.disabled ? 'inactive_6_months' : null,
    viewer: {
      isLeader,
      isMember,
      can: {
        invite: isLeader && !t.disabled,
        edit: isLeader && !t.disabled,
        disband: isLeader && !inPlay && !t.disabled,
        transferLeader: isLeader && !t.disabled,
        requestOfficial: isLeader && !t.permanent && teamReady(t),
        kickMember: isLeader && !inPlay,
      },
      disbandBlockedReason: inPlay
        ? 'This squad is entered in a tournament. Withdraw the entry first.'
        : null,
    },
  }
}

export function findStoreTeam(ref: TeamRef): StoreTeam | undefined {
  const s = getState()
  const raw = String(ref)
  return s.teams.find(t => t.id === raw) ?? s.teams.find(t => numOf(t.id) === Number(ref))
}

/** ทีมที่ "ฉัน" อยู่ — หน้า /teams ใช้ตัวนี้ */
export function myStoreTeams(): TeamDto[] {
  const s = getState()
  const u = me(s)
  if (!u) return []
  return s.teams.filter(t => t.members.includes(u.id) || t.leader === u.id).map(t => toTeamDto(s, t))
}

// ── คำเชิญ ────────────────────────────────────────────────────────────────

export function myStoreInvitations(): TeamInvitationDto[] {
  const s = getState()
  const u = me(s)
  if (!u) return []
  return s.invites
    .filter(i => i.user === u.id)
    .map(i => {
      const t = s.teams.find(x => x.id === i.team)
      return {
        id: numOf(i.id),
        team: t ? teamStub(t) : { id: 0, name: '—', code: null, color: null },
        invitedUser: asUser(s, i.user) ?? unknownUser,
        invitedBy: t ? asUser(s, t.leader) ?? unknownUser : unknownUser,
        /* store ใช้ 'declined' — schema ใช้ 'rejected' */
        status: i.status === 'declined' ? 'rejected' : i.status,
        createdAt: new Date().toISOString(),
        respondedAt: i.status === 'pending' ? null : new Date().toISOString(),
        expiresAt: null,   // TODO(schema): ไม่มีคอลัมน์ ดู team.dto.ts
      }
    })
}

export function teamStoreInvitations(ref: TeamRef): TeamInvitationDto[] {
  const s = getState()
  const t = findStoreTeam(ref)
  if (!t) return []
  return s.invites.filter(i => i.team === t.id).map(i => ({
    id: numOf(i.id),
    team: teamStub(t),
    invitedUser: asUser(s, i.user) ?? unknownUser,
    invitedBy: asUser(s, t.leader) ?? unknownUser,
    status: i.status === 'declined' ? 'rejected' : i.status,
    createdAt: new Date().toISOString(),
    respondedAt: i.status === 'pending' ? null : new Date().toISOString(),
    expiresAt: null,
  }))
}

// ── คำร้องถึง Admin ───────────────────────────────────────────────────────

export function storeTeamAdminRequests(): TeamAdminRequestDto[] {
  const s = getState()
  return s.permanentRequests.map(r => {
    const t = s.teams.find(x => x.id === r.team)
    /* FR-TM-06: อนุมัติไม่ได้ถ้าสมาชิกคนไหนสังกัดทีม Official อื่นในกีฬาเดียวกัน
       ซึ่งเป็นกฎที่ official_team_memberships บังคับด้วย UNIQUE(user, sport) */
    const blocking = t
      ? t.members.filter(uid => s.teams.some(o =>
          o.id !== t.id && o.permanent && o.sport === t.sport && o.members.includes(uid)))
      : []
    return {
      id: numOf(r.id),
      team: t ? teamStub(t) : { id: 0, name: '—', code: null, color: null },
      requestType: 'official_status' as const,
      requestedBy: asUser(s, r.by) ?? unknownUser,
      targetUser: null,
      status: r.status === 'declined' ? 'rejected' : r.status,
      requestedAt: new Date(r.at).toISOString(),
      reviewedBy: null,
      reviewedAt: r.status === 'pending' ? null : new Date().toISOString(),
      rejectionReason: null,
      blockingMembers: blocking.map(uid => asUser(s, uid) ?? unknownUser),
    }
  })
}

// ── โปรไฟล์ผู้เล่น ─────────────────────────────────────────────────────────

export function findStorePlayer(ref: TeamRef): PlayerProfileDto | null {
  const s = getState()
  const raw = String(ref)
  const u = s.users.find(x => x.id === raw) ?? s.users.find(x => numOf(x.id) === Number(ref))
  if (!u) return null
  const teams = s.teams.filter(t => t.members.includes(u.id))
  /* store ไม่ได้เก็บสถิติสะสม — สรุปจากแมตช์ที่ยืนยันแล้ว
     ของจริงอ่านจาก player_profile_stats ที่ backend คำนวณไว้ */
  const bySport = [...new Set(teams.map(t => t.sport ?? '—'))].map(sport => {
    const mine = teams.filter(t => (t.sport ?? '—') === sport).map(t => t.id)
    const played = s.matches.filter(m =>
      m.status === 'confirmed' && [m.a, m.b].some(x => x && mine.includes(x)))
    const wins = played.filter(m => {
      const win = (m.sa ?? 0) === (m.sb ?? 0)
        ? (m.decider ? (m.decider.a > m.decider.b ? m.a : m.b) : null)
        : (m.sa ?? 0) > (m.sb ?? 0) ? m.a : m.b
      return !!win && mine.includes(win)
    }).length
    return {
      sportTypeId: 0,
      sportName: sport,
      matchesPlayed: played.length,
      wins,
      losses: played.length - wins,
      championships: 0,
    }
  })
  return {
    user: { id: numOf(u.id), fullName: u.name, avatarUrl: null },
    facultyId: 0,
    departmentId: 0,
    teams: teams.map(t => ({ ...teamStub(t), sportName: t.sport ?? '—' })),
    bySport,
  }
}
