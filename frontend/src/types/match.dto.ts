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
  /**
   * ผู้เล่นที่ลงแมตช์นี้ได้ — server เป็นคนตัดสินว่าใครเข้าเกณฑ์
   *
   * ⚠️ CONTEXT.md นิยาม Squad list (ชุดที่ส่งลงทัวร์นาเมนต์) กับ Lineup
   *    (ชุดที่ลงแมตช์) ไว้ แต่ **ทั้งสองอย่างไม่มีตารางใน schema** —
   *    `tournament_applications` ไม่มีคอลัมน์รายชื่อ และไม่มีตาราง lineup เลย
   *    ที่มีคือ `team_members.position` ซึ่งเป็นตัวจริง/สำรอง **ระดับทีม**
   *    ตรงกับ SRS FR-TM-04 (Team Management) ไม่ใช่ระดับแมตช์
   *    ดู PLAN.md หัวข้อ Blocked — ต้องตัดสินใจก่อนสร้างหน้า Lineup ใหม่
   */
  players: PlayerRef[];
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

  // ── สิ่งที่หน้าแมตช์ต้องใช้ และ server รู้อยู่แล้ว ────────────────────────
  /** ทัวร์นาเมนต์ที่สังกัด — พอสำหรับ breadcrumb กับประโยค "ได้แชมป์" */
  tournament: {
    id: number;
    name: string;
    /** ทีมที่ได้แชมป์ — null ถ้ายังไม่จบ */
    championTeamId: number | null;
    /** ชนิดกีฬา — ตัวกำหนดว่าแมตช์นี้เก็บสถิติอะไรบ้าง */
    sportTypeId: number;
    sportName: string;
  };
  /**
   * ชื่อรอบที่อ่านออก server คำนวณให้
   * `stage` = "Quarter-final" · `tag` = "QF1" (มาจาก bracket_nodes.node_code)
   * frontend คำนวณเองไม่ได้ถ้าไม่ดึงทั้งสายมา — และมันเป็นข้อมูลของสไลซ์ 2
   */
  stage: string;
  tag: string;
  /** กรรมการที่ถูกมอบหมายให้แมตช์นี้ (match_referees) */
  referees: PlayerRef[];
  /**
   * กรรมการที่ตอบรับคำเชิญของทัวร์นาเมนต์นี้แล้ว = คนที่มอบหมายเข้าแมตช์ได้
   *
   * ต้นทางคือ `tournament_referees` ซึ่งเป็นตารางของสไลซ์ 4 — แต่หน้า Fixture
   * ต้องใช้ ให้ server join มาให้ในคำขอเดียว ดีกว่าให้ frontend ยิงข้ามโดเมนเอง
   * (แต่งตั้งให้ "มีสิทธิ์" · มอบหมายเข้าแมตช์ให้ "รับผิดชอบ" — คนละเรื่องกัน)
   */
  availableReferees: PlayerRef[];
  /** ห้องแข่งสำหรับโหมด online */
  roomCode: string | null;
  /**
   * โทเคนเช็คอินหน้างาน — server สร้างและหมุนทุก 60 วินาที
   *
   * prototype สร้างเองฝั่ง client จาก match id ซึ่งไม่มีความหมายเชิงความปลอดภัยเลย
   * ใครเปิด devtools ก็คำนวณได้ ของจริงต้องมาจาก server และ POST /checkin
   * ต้องเป็นฝ่ายตรวจ null เมื่อเป็นโหมด online หรือเรายังไม่มีสิทธิ์เห็น
   */
  checkinToken: string | null;
  /** ลิงก์วิดีโอย้อนหลัง */
  replayUrl: string | null;
  checkedIn: number;
  lineupSize: number;
  /** สิ่งที่คนที่กำลังดูอยู่ทำได้ */
  viewer: MatchViewerContext;
}

/**
 * ผู้ใช้คนหนึ่งสวมหลายหมวกพร้อมกันได้ — ตัดสินทัวร์นาเมนต์นึง ลงเล่นอีกทัวร์นาเมนต์
 * และเป็นผู้จัดอีกอัน หน้า /matches ต้องแยกกลุ่มตามหมวก ไม่ใช่ยำรวมกัน
 * server รู้อยู่แล้วว่าเราเกี่ยวข้องยังไง จึงส่งมาเลย แทนที่จะให้ frontend เดาจาก roster
 */
export type MatchViewerRole = "referee" | "player" | "organizer";

/**
 * สิ่งที่ "คนที่กำลังดูอยู่" ทำได้กับแมตช์นี้ — ตัดสินโดย server
 *
 * โค้ดเดิมคำนวณเองทั้งหมด: ไล่ดูว่าอยู่ใน `m.refs` ไหม, เป็น organizer ของ
 * ทัวร์นาเมนต์ไหม, เป็นหัวหน้าของทีมที่ชนะไหม แล้วเอามาผสมกับสถานะแมตช์
 * เป็นต้นไม้เงื่อนไข — ซึ่งมีปัญหาสองข้อ
 *
 *   1. backend ต้องเช็คซ้ำอยู่ดี (ห้ามเชื่อ client) กติกาเดียวกันจึงถูกเขียนสองที่
 *      และจะเพี้ยนจากกันวันใดวันหนึ่ง
 *   2. frontend ต้องโหลด roster ทุกทีม + รายชื่อกรรมการ มาตอบคำถามที่ server
 *      ตอบได้อยู่แล้วในคำสั่งเดียว
 *
 * ที่นี่ server บอกว่าทำอะไรได้ · UI แค่วาดตาม
 * ⚠️ ยังไม่ยืนยันกับ GUIDE/06 — ดู TODO(guide) ใน api/match.ts
 */
export interface MatchViewerContext {
  roles: MatchViewerRole[];
  /** ทีมของเราในแมตช์นี้ — null ถ้าไม่ได้ลงเล่น */
  myTeamId: number | null;
  /** เป็นหัวหน้าทีมของทีมที่ลงแมตช์นี้ */
  isTeamLeader: boolean;
  can: {
    /** กรอกผล (S01) — onsite = กรรมการ · online = หัวหน้าทีมที่ชนะ */
    submitResult: boolean;
    /** ยืนยันผลที่คนอื่นส่ง — สลับกับข้างบนตามโหมด */
    verifyResult: boolean;
    /** ค้านผล — เฉพาะ onsite, online ใช้การตรวจของกรรมการแทน */
    disputeResult: boolean;
    /** ตัดสินข้อพิพาท — organizer/admin เท่านั้น */
    resolveDispute: boolean;
    /** แก้เวลา สนาม กรรมการ */
    editFixture: boolean;
    /** บันทึกสถิติผู้เล่น */
    recordStats: boolean;
    /** เปิดคอนโซลเช็คอิน */
    manageCheckin: boolean;
  };
}

/**
 * แถวในหน้ารายการแมตช์ — denormalize มาให้พร้อมใช้ กัน N+1
 * ถ้าไม่มี tournamentName / score / checkedIn ติดมาด้วย หน้า list ต้องยิงเพิ่มอีก 3 request ต่อแถว
 */
export interface MatchListItemDto extends MatchDto {
  /**
   * สกอร์ถูกดึงขึ้นมาจาก match_results.score_data ให้แล้ว — null = ยังไม่มีผล
   * หน้า list ต้องการแค่ตัวเลข ไม่ต้องการ MatchResultDto ทั้งก้อน
   */
  score: { a: number | null; b: number | null } | null;
  resultStatus: MatchResultStatus | null;
}

/** PATCH /matches/:id — จัดตาราง/สนาม/เวลาเปิดเช็คอิน */
export interface UpdateMatchRequest {
  scheduledTime?: string | null;
  venue?: string | null;
  checkinOpenAt?: string | null;
  /** โหมด online — เลขห้องจาก game client ที่กรรมการกรอกให้ทั้งสองทีมเห็น */
  roomCode?: string | null;
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
 * ── ตารางอันดับ ────────────────────────────────────────────────────────────
 *
 * FRONTEND-SPEC กำหนดว่าสามฟอร์แมตอ่านคนละแบบ และนั่นคือเหตุผลที่ต้องมี wrapper
 * ไม่ใช่แค่ array ของแถว — UI ต้องรู้ฟอร์แมตก่อนถึงจะรู้ว่าคอลัมน์ไหนมีความหมาย
 *
 *   single elimination  จัดอันดับตามรอบที่ตกรอบ · ทีมที่ตกรอบเดียวกันได้อันดับเท่ากัน
 *                       **ไม่มีคอลัมน์ Lost** เพราะมันเป็น 0 หรือ 1 เสมอ ไม่บอกอะไร
 *   double elimination  จัดอันดับตามรอบที่แพ้ครั้งที่สอง · Lost เป็น 0 หรือ 2 เสมอ ตัดออกเหมือนกัน
 *   round robin         ตารางเต็ม · Lost กับ Level มีความหมายจริงเพราะมันแปรผัน
 *
 * SRS FR-RS-05 ให้ backend คำนวณใหม่ทุกครั้งที่ผลถูกยืนยัน frontend อ่านอย่างเดียว
 * (FRONTEND-SPEC เขียนว่า "derived, never stored" — หมายถึงฝั่ง client ไม่เก็บ
 *  ส่วน `tournament_standings` เป็น cache ที่ backend คำนวณลงไป)
 */
export type StandingsFormat = "single_elimination" | "double_elimination" | "round_robin";

/** ผลนัดล่าสุด — elimination มีแค่ W/L · round robin มี D ด้วย */
export type FormResult = "W" | "D" | "L";

export interface StandingRowDto {
  team: MatchTeamRef;
  /** ทีมที่คะแนนเท่ากันได้อันดับเดียวกัน */
  rank: number;
  played: number;
  won: number;
  lost: number;
  points: number;

  /**
   * ── round robin เท่านั้น ────────────────────────────────────────────────
   * ⚠️ TODO(schema): `tournament_standings` มีแค่ played / won / lost / points
   *    สามตัวนี้ยังไม่มีคอลัมน์รองรับ ต้องเพิ่ม:
   *      ALTER TABLE tournament_standings
   *        ADD level          INT NOT NULL DEFAULT 0,
   *        ADD scored_for     INT NOT NULL DEFAULT 0,
   *        ADD scored_against INT NOT NULL DEFAULT 0;
   *
   *    ตั้งใจไม่ตั้งชื่อว่า goals — FRONTEND-SPEC ระบุว่า "a scoreline is not
   *    always goals" วอลเลย์บอลนับเซ็ต หมากรุกนับผล เรียก goals คือฝังฟุตบอล
   *    ลงไปใน schema ถาวร · scoreDifference ไม่ต้องเป็นคอลัมน์ คำนวณจากสองตัวข้างบน
   */
  level: number;
  scoredFor: number;
  scoredAgainst: number;
  scoreDifference: number;

  /**
   * ผลห้านัดหลัง เรียงเก่า→ใหม่ — คำนวณจากประวัติแมตช์ ไม่ใช่คอลัมน์ในตาราง
   * backend คำนวณส่งมา ไม่ควรให้ frontend ดึงทุกแมตช์มานับเอง
   */
  form: FormResult[];

  /**
   * ── elimination เท่านั้น ────────────────────────────────────────────────
   * ป้ายบอกว่าจบตรงไหน เช่น "Quarter-final" หรือ "Champion"
   * server เป็นคนตั้งชื่อรอบ เพราะต้องรู้ว่าสายมีกี่รอบ
   */
  outLabel: string;
}

export interface StandingsDto {
  tournamentId: number;
  format: StandingsFormat;
  /** ชื่อสิ่งที่นับ — Goals / Points / Sets / Games / Rounds / Result */
  scoreUnit: string;
  updatedAt: string;
  rows: StandingRowDto[];
}
