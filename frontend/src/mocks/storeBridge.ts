/**
 * src/mocks/storeBridge.ts — Person 3, and temporary by design
 *
 * ── ปัญหาที่มันแก้ ─────────────────────────────────────────────────────────
 * ระหว่างย้าย แอปมี id สองระบบที่คุยกันไม่รู้เรื่อง
 *
 *   shared/seed.ts   `m-130` `t-vb`   string สร้างตอน runtime
 *   src/mocks/*      `301` `201`      ตัวเลข ตาม schema
 *
 * สไลซ์ 3 ย้ายไป API แล้ว แต่ BracketTab (สไลซ์ 2) · TeamPage (4) · WatchPage (1)
 * ยังส่ง id แบบ store มาที่ `/m/:id` ของเรา ผลคือกดแล้วขึ้น "No such match"
 * และเป็นทุกทิศ ไม่ใช่แค่ขาเข้า — กดบันทึก fixture แล้วเด้งไป `/t/201` ก็หาไม่เจอ
 * เพราะ TournamentPage ยังอ่าน store
 *
 * ── ทำไมแก้ตรงนี้ ไม่ไปแก้ seed ────────────────────────────────────────────
 * เปลี่ยน id ใน seed.ts ให้เป็นตัวเลขดูเหมือนตรงจุดกว่า แต่ลามหนัก: prototype
 * ประกาศ id เป็น `string` ทั้งระบบ และ prefix `t-` ใช้ทั้งทัวร์นาเมนต์และทีม
 * (`t-fb` เป็นทัวร์นาเมนต์ · `t-byt` เป็นทีม) แก้ทีเดียวสะเทือนทั้งสี่สไลซ์
 *
 * สะพานนี้อยู่ในไฟล์ของสไลซ์ 3 ล้วน **ไม่แตะโค้ดของใครเลย** และตายพร้อม
 * `VITE_USE_MOCK=false` — พอ backend จริงมา id เป็นตัวเลขจาก DB ทั้งหมด
 * ไฟล์นี้จะไม่ถูกเรียกอีก และลบทิ้งพร้อม store.ts ใน phase 2
 *
 * ── กติกาที่คัดลอกมา ───────────────────────────────────────────────────────
 * `viewer.can` ข้างล่างคือกติกาเดิมของ MatchPage ก่อนย้าย ยกมาทั้งดุ้นโดยตั้งใจ
 * เพื่อให้พฤติกรรมระหว่างช่วงเปลี่ยนผ่านเหมือนเดิมเป๊ะ — **ไม่ใช่กติกาจริง**
 * ของจริง server เป็นคนตัดสิน (ดู MatchViewerContext ใน match.dto.ts)
 */
import { getState } from '../shared/store'
import { isOrg, me, team, tour } from '../shared/selectors'
import { standings, winnerId } from '../shared/rules'
import type { Match as StoreMatch, State, Team as StoreTeam } from '../shared/types'
import type {
  MatchDto, MatchListItemDto, MatchResultDto, MatchTeamRef, MatchViewerContext,
  MatchViewerRole, PlayerRef, TournamentStandingDto,
} from '../types/match.dto'

/** id ที่มาจาก URL — ตัวเลขของ API หรือ string ของ store ก็ได้ */
export type MatchRef = number | string

/**
 * store id เป็น string, DTO ต้องการ number — จับคู่ให้เสถียร
 * seed เป็น deterministic (PRNG seed เดียว) ลำดับจึงเหมือนกันทุกเครื่อง
 * ตัวเลขเริ่มที่ 100000 เพื่อไม่ชนกับ id ของ mock ที่เขียนมือ (301, 201, ...)
 */
export const numOf = (storeId: string) => {
  let h = 0
  for (const c of storeId) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return 100000 + (h % 800000)
}

const asPlayer = (s: State, id: string | null): PlayerRef | null => {
  const u = s.users.find(x => x.id === id)
  return u ? { id: numOf(u.id), fullName: u.name, avatarUrl: null } : null
}

const asTeam = (s: State, t: StoreTeam | undefined, m: StoreMatch): MatchTeamRef | null => {
  if (!t) return null
  const named = m.lineup?.[t.id]?.starters?.length
    ? [...m.lineup[t.id].starters, ...(m.lineup[t.id].subs ?? [])]
    : t.members
  return {
    id: numOf(t.id),
    name: t.name,
    code: t.code,
    color: t.color,
    logoUrl: t.logo ?? null,
    players: named.map(id => asPlayer(s, id)).filter(Boolean) as PlayerRef[],
  }
}

/** กติกาเดิมของ MatchPage — ยกมาเพื่อให้ช่วงเปลี่ยนผ่านทำงานเหมือนเดิม */
function viewerOf(s: State, m: StoreMatch): MatchViewerContext {
  const u = me(s)
  const t = tour(s, m.tour)
  const onsite = t?.channel === 'onsite'
  const isReferee = !!u && (m.refs ?? []).includes(u.id)
  const org = isOrg(s, t)
  const sides = [m.a, m.b].filter(Boolean) as string[]
  const myTeam = u ? sides.find(x => team(s, x)?.members.includes(u.id)) ?? null : null
  const anyLeader = !!u && sides.some(x => team(s, x)?.leader === u.id)
  const win = m.status === 'pending' ? winnerId(m) : null
  const leadsWinner = !!win && !!u && team(s, win)?.leader === u.id

  const roles: MatchViewerRole[] = []
  if (isReferee) roles.push('referee')
  if (myTeam) roles.push('player')
  if (org) roles.push('organizer')

  return {
    roles,
    myTeamId: myTeam ? numOf(myTeam) : null,
    isTeamLeader: anyLeader,
    can: {
      submitResult: m.status === 'scheduled' && ((onsite && isReferee) || (!onsite && anyLeader)),
      verifyResult: m.status === 'pending' && (onsite ? leadsWinner : isReferee),
      disputeResult: m.status === 'pending' && onsite && anyLeader,
      resolveDispute: m.status === 'disputed' && org,
      editFixture: org && m.status === 'scheduled' && !m.checkedIn.length,
      recordStats: isReferee,
      manageCheckin: isReferee,
    },
  }
}

export function toMatchDto(s: State, m: StoreMatch): MatchDto {
  const t = tour(s, m.tour)
  const A = team(s, m.a), B = team(s, m.b)
  const refs = (m.refs ?? []).map(r => asPlayer(s, r)).filter(Boolean) as PlayerRef[]
  const pool = (t?.referees ?? []).map(r => asPlayer(s, r)).filter(Boolean) as PlayerRef[]
  const lineup = [A, B].filter(Boolean).reduce(
    (n, x) => n + (m.lineup?.[x!.id]?.starters?.length ?? x!.members.length), 0)

  return {
    id: numOf(m.id),
    tournamentId: t ? numOf(t.id) : 0,
    tournament: {
      id: t ? numOf(t.id) : 0,
      name: t?.name ?? '—',
      championTeamId: t?.champion ? numOf(t.champion) : null,
      sportTypeId: 0,               // mock: ใช้ชุดสถิติกลาง
      sportName: t?.sport ?? '—',
    },
    bracketNodeId: null,
    nextMatchId: m.winTo?.m ? numOf(m.winTo.m) : null,
    loserNextMatchId: m.loseTo?.m ? numOf(m.loseTo.m) : null,
    roundNumber: m.round,
    teamA: asTeam(s, A, m),
    teamB: asTeam(s, B, m),
    scheduledTime: m.kickoff || null,
    venue: m.venue || null,
    checkinOpenAt: null,
    /* store ยุบสถานะแมตช์กับสถานะผลไว้ด้วยกัน — แยกกลับตอนแปลง */
    status: m.status === 'confirmed' ? 'completed'
      : m.status === 'disputed' ? 'disputed'
        : m.checkedIn.length ? 'checkin_open' : 'scheduled',
    mode: t?.channel ?? 'onsite',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    stage: m.stage ?? `Round ${m.round}`,
    tag: m.tag ?? `R${m.round}-M${m.slot}`,
    referees: refs,
    availableReferees: pool,
    roomCode: m.roomCode ?? null,
    checkinToken: m.status === 'scheduled' || m.checkedIn.length ? `SEED-${m.id.toUpperCase()}` : null,
    replayUrl: m.replay ?? null,
    checkedIn: m.checkedIn.length,
    lineupSize: lineup,
    viewer: viewerOf(s, m),
  }
}

export function toListItem(s: State, m: StoreMatch): MatchListItemDto {
  return {
    ...toMatchDto(s, m),
    score: m.sa === null && m.sb === null ? null : { a: m.sa, b: m.sb },
    resultStatus: m.status === 'confirmed' ? 'verified'
      : m.status === 'disputed' ? 'disputed'
        : m.status === 'pending' ? 'submitted' : null,
  }
}

/** ผลการแข่งขัน — store เก็บไว้บนตัวแมตช์ ไม่ได้แยกตาราง */
export function toResultDto(s: State, m: StoreMatch): MatchResultDto | null {
  if (m.status === 'scheduled' || !m.enteredBy) return null
  const win = winnerId(m)
  return {
    id: numOf(m.id) + 1,
    matchId: numOf(m.id),
    winnerTeamId: win ? numOf(win) : null,
    scoreData: { a: m.sa, b: m.sb, ...(m.decider ? { decider: m.decider } : {}) },
    submittedBy: asPlayer(s, m.enteredBy) ?? { id: 0, fullName: '—', avatarUrl: null },
    submittedRole: tour(s, m.tour)?.channel === 'onsite' ? 'referee' : 'team_leader',
    status: m.status === 'confirmed' ? 'verified' : m.status === 'disputed' ? 'disputed' : 'submitted',
    disputeReason: null,
    disputeRaisedBy: asPlayer(s, m.disputedBy),
    disputeRaisedAt: m.disputedBy ? new Date().toISOString() : null,
    disputeResolvedBy: null,
    disputeResolution: null,
    disputeResolvedAt: null,
    verifiedBy: asPlayer(s, m.confirmedBy),
    verifiedAt: m.confirmedBy ? new Date().toISOString() : null,
    amendedBy: null,
    amendReason: null,
    amendedAt: null,
    createdAt: new Date().toISOString(),
  }
}

/** หาแมตช์ใน store จาก id รูปไหนก็ได้ — string ตรงๆ หรือเลขที่ numOf เคยแปลงไว้ */
export function findStoreMatch(ref: MatchRef): StoreMatch | undefined {
  const s = getState()
  const raw = String(ref)
  return s.matches.find(m => m.id === raw) ?? s.matches.find(m => numOf(m.id) === Number(ref))
}

export function findStoreTournamentMatches(ref: MatchRef): StoreMatch[] {
  const s = getState()
  const raw = String(ref)
  const t = s.tournaments.find(x => x.id === raw) ?? s.tournaments.find(x => numOf(x.id) === Number(ref))
  return t ? s.matches.filter(m => m.tour === t.id) : []
}

/**
 * ตารางคะแนนจาก seed — ใช้ `standings()` ใน rules.ts คำนวณ
 * ของจริง backend เป็นคนคำนวณตอนยืนยันผล (SRS FR-RS-05) นี่แค่ให้เดโมมีข้อมูลดู
 */
export function findStoreStandings(ref: MatchRef): TournamentStandingDto[] {
  const s = getState()
  const raw = String(ref)
  const t = s.tournaments.find(x => x.id === raw) ?? s.tournaments.find(x => numOf(x.id) === Number(ref))
  if (!t) return []
  return standings(s, t).map(row => {
    const tm = team(s, row.team)
    return {
      tournamentId: numOf(t.id),
      team: tm ? asTeam(s, tm, { a: null, b: null, lineup: {} } as unknown as StoreMatch)!
        : { id: 0, name: '—', code: '—', color: null, logoUrl: null, players: [] },
      played: row.p,
      won: row.w,
      lost: row.l,
      points: row.pts,
      updatedAt: new Date().toISOString(),
      rank: row.rank,
    }
  })
}

/**
 * id ที่ใช้ "เดินทาง" ไปหน้าทัวร์นาเมนต์ — คนละเรื่องกับ id ใน DTO
 *
 * `TournamentPage` เป็นของสไลซ์ 2 และยังอ่าน store ล้วน ส่ง id ตัวเลขไปมันหาไม่เจอ
 * ตัวนี้แปลงกลับเป็น id ของ store ให้ถ้าแปลงได้ ไม่งั้นคืนตัวเลขตามเดิม
 * ลบทิ้งพร้อมไฟล์นี้ตอนสไลซ์ 2 ย้ายเสร็จ
 */
export function tournamentRouteId(id: number | string): string {
  const raw = String(id)
  const hit = getState().tournaments.find(t => t.id === raw || numOf(t.id) === Number(id))
  return hit ? hit.id : raw
}

export const storeState = getState
