/**
 * src/shared/types.ts
 *
 * Entity shapes ported 1:1 from ltms-prototype.html's `S` store, named with the
 * CONTEXT.md glossary. This is the single source of truth for the ported UI —
 * src/types/dto.ts stays the shape the *real* API will hand back, and the two
 * meet in an adapter when the backend lands (PLAN.md phase 2).
 */

export type Role = 'Admin' | 'User'
export type Channel = 'onsite' | 'online'
export type Format = 'single' | 'double' | 'roundrobin'
export type TourStatus = 'pending' | 'private' | 'public'
export type MatchStatus = 'scheduled' | 'pending' | 'confirmed' | 'disputed' | 'void'
export type RegStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'
export type InviteStatus = 'pending' | 'accepted' | 'declined'
export type BracketSide = 'W' | 'L' | 'GF'

export interface Pin { lat: number; lng: number }

export interface User {
  id: string
  name: string
  email: string
  role: Role
  gender: 'Male' | 'Female'
  dob: string
  faculty: string
  major: string
  year: number
  /**
   * FR-UM-05 — บัญชีที่ถูกระงับเข้าสู่ระบบไม่ได้ และไม่นับเป็นสมาชิกทีมที่ลงแข่งได้
   * schema มีคอลัมน์ users.is_suspended อยู่แล้ว ที่นี่เพิ่มให้ prototype เก็บได้ด้วย
   */
  suspended?: boolean
  suspendedReason?: string | null
}

export interface Team {
  id: string
  name: string
  code: string
  color: string
  leader: string
  members: string[]
  created: number
  disabled: boolean
  permanent: boolean
  sport?: string
  logo?: string
}

/** The Hard filter's conditions. `any` means the condition is not set — see CONTEXT.md. */
export interface Rules {
  gender: 'any' | 'Male' | 'Female'
  ageMin: number | 'any'
  ageMax: number | 'any'
  faculty: string
  major: string
  year: number | 'any'
}

export interface FilterChangeRequest {
  rules: Rules
  reason: string
  at: number
}

export interface Tournament {
  id: string
  name: string
  sport: string
  format: Format
  channel: Channel
  status: TourStatus
  date: string
  venue: string
  pin: Pin | null
  cap: number
  organizer: string
  referees: string[]
  rules: Rules
  entryNotes?: string
  drawn: boolean
  drawnAt?: number
  rounds: number
  champion: string | null
  filterChangeRequest?: FilterChangeRequest | null
}

export interface Registration {
  id: string
  tour: string
  team: string
  status: RegStatus
  at: number
  /** Squad list — the subset of the Team entered into this Tournament. */
  squad: string[]
  reason?: string
  withdrawRequested?: boolean
}

export interface PlayerStat {
  team: string
  goals: number
  assists: number
  x: Record<string, number>
}

export interface Lineup {
  starters: string[]
  subs: string[]
}

export interface Decider {
  a: number
  b: number
  kind: string
}

export interface Edge { m: string; side: 'a' | 'b' }

/** หลักฐานการเช็คอินหนึ่งคน — คู่กับ MatchCheckinDto ฝั่ง API */
export interface CheckinRecord {
  method: 'qr_onsite' | 'photo_online' | 'manual_by_referee'
  status: 'success' | 'rejected' | 'exception'
  /** รูปคู่บัตรที่ผู้เล่นส่ง — ของจริงเป็น S3 key ไม่ใช่ data URL (NF-SE-03) */
  documentUrl?: string | null
  documentType?: 'student_id' | 'national_id' | null
  rejectionReason?: string | null
  at: number
  /** กรรมการที่ตรวจ — ว่างแปลว่ายังไม่มีใครตรวจ */
  verifiedBy?: string | null
}

export interface Match {
  id: string
  tour: string
  round: number
  slot: number
  /** 'W' winners · 'L' losers · 'GF' grand final · 'RR' round robin matchday */
  bracket?: BracketSide | 'RR'
  /** the name the draw gave this match — the round arithmetic is only the single-elim fallback */
  stage?: string
  tag?: string
  depth?: number
  /** where the winner (and in double elimination, the loser) goes next */
  winTo?: Edge | null
  loseTo?: Edge | null
  a: string | null
  b: string | null
  sa: number | null
  sb: number | null
  status: MatchStatus
  channel: Channel
  enteredBy: string | null
  confirmedBy: string | null
  confirmedByOrg?: boolean
  disputedBy: string | null
  /** a Dispute is recorded against the Team, not the person who clicked */
  disputedTeam?: string | null
  note: string
  venue: string
  pin?: Pin | null
  roomCode?: string
  refs: string[]
  checkedIn: string[]
  /**
   * รายละเอียดการเช็คอินรายคน (FR-PV-03, FR-PV-04)
   *
   * `checkedIn` เก็บแค่ "ใครเข้าแล้ว" ซึ่งพอสำหรับ prototype เดิม แต่ไม่พอกับ
   * การยืนยันตัวตน: on-site สแกน QR ผ่านทันที ส่วน online ส่งรูปคู่บัตรแล้ว
   * ต้องรอกรรมการตรวจ (สถานะ exception) ซึ่งอาจถูกปฏิเสธพร้อมเหตุผล
   *
   * แถวใน seed ที่ไม่มีคีย์ตรงนี้ถือว่าผ่านแบบปกติ — ฝั่งอ่านเติมค่าเริ่มต้นให้
   */
  checkins?: Record<string, CheckinRecord>
  stats: Record<string, PlayerStat>
  teamStats?: Record<string, Record<string, number | string>>
  lineup?: Record<string, Lineup>
  decider?: Decider | null
  replay?: string
  kickoff: string
}

export interface Invite { id: string; team: string; user: string; status: InviteStatus }
export interface RefInvite { id: string; tour: string; user: string; status: InviteStatus }
export interface Announcement { id: string; tour: string; by: string; title: string; body: string; at: number }
export interface Notification { id: string; to: string; text: string; href: string; at: number; read: boolean }
export interface Pick { id: string; match: string; by: string; team: string }
export interface Vote { id: string; tour: string; by: string; player: string }
export interface Comment { id: string; match: string; by: string; text: string; at: number }
export interface Feedback { id: string; tour: string; by: string; rating: number; text: string; at: number }
export interface PermanentRequest { id: string; team: string; by: string; reason: string; at: number; status: 'pending' | 'approved' | 'declined' }

export interface State {
  seq: number
  session: string | null
  users: User[]
  teams: Team[]
  tournaments: Tournament[]
  registrations: Registration[]
  matches: Match[]
  invites: Invite[]
  refInvites: RefInvite[]
  announcements: Announcement[]
  notifications: Notification[]
  picks: Pick[]
  votes: Vote[]
  follows: string[]
  comments: Comment[]
  feedback: Feedback[]
  permanentRequests: PermanentRequest[]
}
