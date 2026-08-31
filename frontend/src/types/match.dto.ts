/**
 * src/types/match.dto.ts — Person 3 (Match + Results + Standings)
 *
 * ── ทำไมเป็นไฟล์แยก ไม่ไปเพิ่มใน dto.ts ────────────────────────────────────
 * dto.ts เขียนกำกับไว้ว่า "ขอบเขตไฟล์นี้: Auth + Users + Reference data" และ
 * "ห้ามเดา field ล่วงหน้าเองสำหรับ endpoint ที่ยังไม่เห็นใน GUIDE/06"
 * ไฟล์นั้นเป็นของ Person 1 — แก้ทีไรชนกับทุกคน
 *
 * ไฟล์นี้เลยแยกออกมา เจ้าของคือ Person 3 คนเดียว แตะได้โดยไม่ต้องรอใคร
 * พอ GUIDE/06 ส่วน Match มาถึง ค่อย reconcile เข้า dto.ts รอบเดียวจบ
 *
 * ── field มาจากไหน ────────────────────────────────────────────────────────
 * ทุก field ถอดจาก `schema.sql` (36 ตาราง) โดยตรง แปลง snake_case → camelCase
 * ตามคอนเวนชันของ dto.ts · enum import จาก types/enums.ts (gen จาก schema.sql แล้ว)
 * ไม่มี field ไหนที่คิดขึ้นเอง — ทุกตัวชี้กลับไปที่คอลัมน์จริงได้
 *
 * ⚠️ ยกเว้น 2 จุดที่ schema ยังไม่มีคอลัมน์รองรับ (ผมรีวิว schema.sql เจอ):
 *    - `livestreamUrl` — E12 ต้องใช้ แต่ `matches` ยังไม่มีคอลัมน์นี้
 *    - stat value เป็น number ตรงๆ — `player_match_stat_values` มีแค่ `value_int`
 *      ('decimal'/'boolean' ใน sport_stat_definitions.data_type ยังเก็บไม่ได้จริง)
 *    ทั้งคู่ mark ไว้ด้วย TODO(schema) ข้างล่าง อย่าลบจนกว่า schema จะแก้
 */
import type {
  MatchStatus,
  MatchResultStatus,
  MatchCheckinStatus,
  CheckinMethod,
  CheckinDocumentType,
  ResultSubmittedRole,
  Mode,
} from "./enums";

// ══════════════ ตัวช่วยที่ใช้ร่วมกันในไฟล์นี้ ══════════════

/**
 * ทีมในบริบทของแมตช์ — ต้องมี code/color สำหรับ scorebug ซึ่ง `TeamRef` ใน dto.ts
 * (placeholder id+name) ยังไม่มี พอ Person 4 ทำ Teams DTO จริง ค่อยยุบมาใช้ตัวเดียวกัน
 */
export interface MatchTeamRef {
  id: number;
  name: string;
  code: string;
  color: string | null;
  logoUrl: string | null;
}

export interface PlayerRef {
  id: number;
  fullName: string;
  avatarUrl: string | null;
}

// ══════════════ Match — ตาราง `matches` ══════════════

export interface MatchDto {
  id: number;
  tournamentId: number;
  bracketNodeId: number | null;
  /** source of truth ของ "ผู้ชนะไปแข่งต่อที่ไหน" — ไม่ใช่ bracket_nodes */
  nextMatchId: number | null;
  /** เฉพาะ Double Elimination */
  loserNextMatchId: number | null;
  roundNumber: number | null;
  teamA: MatchTeamRef | null;
  teamB: MatchTeamRef | null;
  /** ISO 8601 พร้อม timezone — DATETIME ใน DB ไม่มี tz, backend ต้อง normalize เป็น +07:00 */
  scheduledTime: string | null;
  venue: string | null;
  checkinOpenAt: string | null;
  status: MatchStatus;
  mode: Mode;
  createdAt: string;
  updatedAt: string | null;
  /** TODO(schema): `matches` ยังไม่มีคอลัมน์ livestream_url — E12 รอ schema แก้ก่อน */
  livestreamUrl?: string | null;
}

/**
 * ผู้ใช้คนหนึ่งสวมหลายหมวกพร้อมกันได้ — ตัดสินทัวร์นาเมนต์นึง ลงเล่นอีกทัวร์นาเมนต์
 * และเป็นผู้จัดอีกอัน หน้า /matches ต้องแยกกลุ่มตามหมวก ไม่ใช่ยำรวมกัน
 * server รู้อยู่แล้วว่าเราเกี่ยวข้องยังไง จึงส่งมาเลย แทนที่จะให้ frontend เดาจาก roster
 */
export type MatchViewerRole = "referee" | "player" | "organizer";

/**
 * แถวในหน้ารายการแมตช์ — denormalize มาให้พร้อมใช้ กัน N+1
 * ถ้าไม่มี tournamentName / score / checkedIn ติดมาด้วย หน้า list ต้องยิงเพิ่มอีก 3 request ต่อแถว
 */
export interface MatchListItemDto extends MatchDto {
  tournamentName: string;
  /** ทัวร์นาเมนต์นี้เล่นแบบไหน — RefCard ใช้ตัดสินว่าใครต้องขยับก่อน */
  tournamentMode: Mode;
  viewerRoles: MatchViewerRole[];
  /** สกอร์ถูกดึงขึ้นมาจาก match_results.score_data ให้แล้ว — null = ยังไม่มีผล */
  score: { a: number | null; b: number | null } | null;
  resultStatus: MatchResultStatus | null;
  checkedIn: number;
  /** จำนวนคนที่ต้องเช็คอินทั้งหมด (สองทีมรวมกัน) — ตัวหารของ "3 / 10" */
  lineupSize: number;
}

/** PATCH /matches/:id — จัดตาราง/สนาม/เวลาเปิดเช็คอิน */
export interface UpdateMatchRequest {
  scheduledTime?: string | null;
  venue?: string | null;
  checkinOpenAt?: string | null;
}

// ══════════════ Result — ตาราง `match_results` ══════════════

export interface MatchResultDto {
  id: number;
  matchId: number;
  winnerTeamId: number | null;
  /** โครงสร้างคงที่ ไม่แตกตารางเหมือน player stats — shape ขึ้นกับชนิดกีฬา */
  scoreData: Record<string, unknown> | null;
  submittedBy: PlayerRef;
  submittedRole: ResultSubmittedRole;
  status: MatchResultStatus;

  disputeReason: string | null;
  disputeRaisedBy: PlayerRef | null;
  /** ใช้เช็ค tournaments.dispute_window_hours (BR-14) */
  disputeRaisedAt: string | null;
  disputeResolvedBy: PlayerRef | null;
  disputeResolution: string | null;
  disputeResolvedAt: string | null;

  verifiedBy: PlayerRef | null;
  verifiedAt: string | null;

  amendedBy: PlayerRef | null;
  amendReason: string | null;
  /** isAmended = (amendedAt !== null) — ไม่มี boolean แยก */
  amendedAt: string | null;

  createdAt: string;
}

/**
 * S01 POST /matches/:id/result — endpoint เดียวที่ยืนยันแล้วจาก schema.sql:403
 * idempotent: match_results.match_id เป็น UNIQUE → ส่งซ้ำ = UPDATE แถวเดิม
 */
export interface SubmitResultRequest {
  winnerTeamId: number | null;
  scoreData: Record<string, unknown> | null;
}

export interface VerifyResultRequest {
  /** ผู้ตรวจไม่ต้องส่งอะไร นอกจากยืนยัน — backend อ่าน user จาก token */
  note?: string;
}

export interface DisputeResultRequest {
  reason: string;
  /** dispute บันทึกใส่ "ทีม" ไม่ใช่คนกด — ตาม schema.sql */
  teamId: number;
}

export interface ResolveDisputeRequest {
  resolution: string;
  /** แก้สกอร์ตอนตัดสินข้อพิพาทได้ — ถ้าไม่ส่ง = ยืนหยัดผลเดิม */
  winnerTeamId?: number | null;
  scoreData?: Record<string, unknown> | null;
}

// ══════════════ Check-in — ตาราง `match_checkins` ══════════════

export interface MatchCheckinDto {
  id: number;
  matchId: number;
  user: PlayerRef;
  method: CheckinMethod;
  status: MatchCheckinStatus;
  rejectionReason: string | null;
  documentType: CheckinDocumentType | null;
  /** S3 key — ไม่ใช่ URL ตรง ต้องขอ presigned ก่อนแสดง */
  documentS3Key: string | null;
  /** ★ ชี้ไป users ไม่ใช่ tournament_referees (ตาม schema.sql) */
  verifiedByReferee: PlayerRef | null;
  checkedInAt: string;
  verifiedAt: string | null;
}

export interface CheckinRequest {
  method: CheckinMethod;
  /** qr_onsite เท่านั้น — token จาก QR ที่กรรมการโชว์ */
  qrToken?: string;
  /** photo_online เท่านั้น */
  documentType?: CheckinDocumentType;
  documentS3Key?: string;
  /** manual_by_referee เท่านั้น — กรรมการเช็คอินแทนผู้เล่น */
  userId?: number;
}

export interface VerifyCheckinRequest {
  status: Extract<MatchCheckinStatus, "success" | "rejected">;
  rejectionReason?: string;
}

// ══════════════ Player stats — 3 ตาราง (definitions / stats / values) ══════════════

export interface PlayerMatchStatDto {
  id: number;
  matchId: number;
  player: PlayerRef;
  teamId: number;
  /** ★ ชี้ไป users ไม่ใช่ tournament_referees */
  recordedByReferee: PlayerRef;
  /**
   * key = sport_stat_definitions.statKey ('goals', 'assists', ...)
   * TODO(schema): value เป็น number เพราะ player_match_stat_values มีแค่ value_int
   *   ถ้า schema เพิ่ม value_decimal/value_bool ค่อยเปลี่ยนเป็น union
   */
  values: Record<string, number>;
  createdAt: string;
}

/** PUT /matches/:id/stats — กรรมการบันทึกสถิติทั้งแมตช์ทีเดียว */
export interface SaveMatchStatsRequest {
  entries: Array<{
    userId: number;
    teamId: number;
    values: Record<string, number>;
  }>;
}

// ══════════════ Standings — ตาราง `tournament_standings` ══════════════

/**
 * ตาราง `tournament_standings` เก็บแค่ played/won/lost/points
 * ไม่มี drawn / goalsFor / goalsAgainst — แต่ UI ที่ port มา (rules.ts `BoardRow`)
 * ใช้ gf/ga/gd/form ในการจัดอันดับ round robin
 *
 * ⚠️ ช่องว่างนี้ต้องคุยกับทีม: จะให้ backend คำนวณส่งมา หรือ frontend คำนวณจาก
 *    รายการแมตช์เอง ดูหัวข้อ "ของค้างที่ต้องตัดสินใจ" ในแผนงาน
 */
export interface TournamentStandingDto {
  tournamentId: number;
  team: MatchTeamRef;
  played: number;
  won: number;
  lost: number;
  points: number;
  updatedAt: string;
  /** อันดับที่ backend คำนวณให้ — ทีมที่คะแนนเท่ากันได้ rank เดียวกัน */
  rank: number;
}
