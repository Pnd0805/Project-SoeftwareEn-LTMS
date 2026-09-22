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
  checkinStatus?: MatchLineupCheckinStatus;
  checkedInAt?: string | null;
}

export type MatchLineupCheckinStatus = "checked_in" | "pending_verification" | "rejected" | null;

export interface BackendMatchLineupPlayerDto {
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  checkinStatus: MatchLineupCheckinStatus;
  checkedInAt: string | null;
}

export interface BackendMatchLineupTeamDto {
  teamId: number;
  players: BackendMatchLineupPlayerDto[];
}

export interface BackendMatchLineupsDto {
  matchId: number;
  teamA: BackendMatchLineupTeamDto | null;
  teamB: BackendMatchLineupTeamDto | null;
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
  scheduledEndTime?: string | null;
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
  /**
   * สถานะใบผลเท่าที่ M05 บอกทุกคน (B5) — ไม่ใช่ตัวใบผลเอง
   *
   * ใบผลจริง (S05) เปิดให้เฉพาะผู้จัด กรรมการของแมตช์ และหัวหน้าสองทีม คนอื่นได้ 404
   * ป้ายสถานะจึงต้องอ่านจากช่องนี้ ไม่งั้นผู้เล่นธรรมดาเห็นแมตช์ที่รอยืนยันผลอยู่
   * เป็นแค่ "เปิดเช็คอิน"
   */
  resultStatus: MatchResultStatus | null;
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
  /**
   * id ของผู้ที่กำลังดูอยู่ ในชุด id เดียวกับ `MatchTeamRef.players[].id`
   *
   * UC-04 บังคับว่าเช็คอินได้เฉพาะบัญชีตนเอง ("สแกนขณะเข้าสู่ระบบด้วยบัญชีตนเอง"
   * และ "ถ่ายภาพตนเองคู่บัตร") หน้าจอจึงต้องเทียบรายบุคคล ไม่ใช่เทียบว่าอยู่ทีมไหน
   * ให้ server เป็นคนบอก เพราะ id ของ `me` กับ id ในรายชื่อผู้เล่นอาจมาคนละทาง
   */
  myUserId: number | null;
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
    /**
     * ตัดสินการเช็คอินของคนอื่น — ยืนยัน/ปฏิเสธรูปบัตร (M14/M15) และเช็คอินแทนผู้เล่น (M19)
     * กรรมการ "ของแมตช์นี้" เท่านั้น (`requireReferee`) · ผู้จัดเปิด/ปิดเช็คอินได้แต่ตัดสินไม่ได้
     */
    verifyCheckin: boolean;
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
  /**
   * แมตช์ที่จบแล้วจบแบบไหน — มีเฉพาะโหมดจริง (backend B5) โหมด mock ไม่ได้ตั้ง
   * ถ้าไม่มีก็ตีความเหมือนเดิมทุกอย่าง จึงเป็น optional ไม่ใช่ null
   */
  outcome?: MatchOutcome | null;
}

/**
 * PATCH /matches/:id/schedule — จัดตาราง/สนาม
 * backend บังคับครบสามช่อง (เวลาเริ่ม เวลาจบ สนาม) และแก้ได้เฉพาะแมตช์ที่ยัง scheduled
 * Room code is written separately through PUT /matches/:id/room-code.
 */
export interface UpdateMatchRequest {
  scheduledTime?: string | null;
  scheduledEndTime?: string | null;
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
  /** ข้อความอธิบายคำตัดสิน — ส่งเป็น resolutionNote ของ backend */
  resolution: string;
  /**
   * ยืนผลเดิม (uphold) · ถอนผลทิ้งให้ส่งใหม่ (reject) · เขียนผลที่ถูกต้องเอง (amend)
   * ไม่ระบุ = uphold · `amend` ต้องมาคู่กับ winnerTeamId และ scoreData เสมอ (B4)
   */
  decision?: "uphold" | "reject" | "amend";
  winnerTeamId?: number | null;
  /** key เป็น a/b ตามภาษา prototype — ชั้น api แปลงเป็น teamId ให้ก่อนส่ง */
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
  /**
   * เหตุผลที่กรรมการอนุโลมเช็คอินให้ด้วยมือ (M19) — คนละเรื่องกับ `rejectionReason`
   *
   * เดิม backend เก็บสองอย่างนี้ในคอลัมน์เดียวกัน แถวที่เช็คอินสำเร็จจึงมีข้อความอยู่ใน
   * ช่อง "เหตุผลที่ถูกปฏิเสธ" · แยกคอลัมน์แล้วตั้งแต่ `75ffb0a` (migration 015)
   */
  note: string | null;
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
  /** manual_by_referee เท่านั้น — เหตุผลที่ต้องยืนยันด้วยมือ เก็บเป็นหลักฐานแทนรูป */
  note?: string;
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

// ══════════════════════════════════════════════════════════════════════════
// รูปที่ backend ตอบจริง (BE_KN 98aa300)
//
// ของเดิมข้างบนเป็น DTO ของ prototype ซึ่ง "รวยกว่า" ที่ backend มีจริงมาก
// (viewer context, stage/tag, รายชื่อผู้เล่น, checkinToken ฯลฯ ยังไม่มีในฝั่ง server)
// ชุดข้างล่างนี้ถอดจาก mappers ของ backend ตรงๆ — ฟังก์ชันที่ลงท้ายด้วย Backend
// ใน api/match.ts คืนรูปนี้ ไม่ใช่รูป prototype
// ══════════════════════════════════════════════════════════════════════════

export interface BackendTeamRef {
  id: number;
  name: string;
  sportTypeId: number;
}

export interface BackendPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface BackendPaged<T> {
  items: T[];
  pagination: BackendPagination;
}

/** GET /tournaments/:id/matches */
/**
 * แมตช์ที่ `completed` จบลงได้สี่แบบ ซึ่งวาดไม่เหมือนกัน (B5, `7d25994`)
 *
 *   played   แข่งจริงและยืนยันผลแล้ว        → โชว์สกอร์
 *   walkover คู่ถอนหรือไม่มา (ยังมีสองทีม)   → โชว์ W/O
 *   bye      ช่องอีกฝั่งว่างถาวร ทีมเดียวผ่าน → เขียน "BYE" ตรงช่องว่าง ไม่ใช่ "TBD"
 *   void     ไม่มีใครผ่าน (แพ้ทั้งคู่ / ถอนทั้งคู่ / แมตช์ตาย) → "No contest"
 *
 * `outcome: null` บนแมตช์ที่ยังไม่จบ = ยังรอผลรอบก่อน ช่องว่างคือ "TBD" ตามเดิม
 */
export type MatchOutcomeKind = "played" | "walkover" | "bye" | "void";

export interface MatchOutcome {
  kind: MatchOutcomeKind;
  winnerTeamId: number | null;
  loserTeamId: number | null;
}

/**
 * ผลสรุปที่ backend แนบมาทุกแถวของ M04/M05 ตั้งแต่ `7d25994`
 *
 * ⚠️ `score` มาเฉพาะผลที่ `verified` หรือ `walkover` เท่านั้น — ใบผลที่ยังไม่ยืนยัน
 *    (submitted/disputed/rejected) ยังต้องอ่านผ่าน S05 ตามสิทธิ์เดิม ดู `fillScores()`
 */
export interface BackendMatchResultSummary {
  nextMatchId: number | null;
  loserNextMatchId: number | null;
  /** สถานะใบผล "ล่าสุด" ของแมตช์ · null = ยังไม่มีใครส่งผล */
  resultStatus: MatchResultStatus | null;
  /** key เป็น teamId (สตริง) เหมือน S05 */
  score: Record<string, number> | null;
  outcome: MatchOutcome | null;
}

export interface BackendMatchListItemDto extends BackendMatchResultSummary {
  id: number;
  round: number | null;
  teamA: BackendTeamRef | null;
  teamB: BackendTeamRef | null;
  scheduledTime: string | null;
  scheduledEndTime: string | null;
  venue: string | null;
  status: MatchStatus;
}

/**
 * GET /me/referee-matches (B7) — แมตช์ที่เรารับเป็นกรรมการ ครบทุกทัวร์ในคำขอเดียว
 *
 * `?upcoming=true` ตัดแมตช์ที่จบแล้วออก · ไม่มี pagination
 * ⚠️ แถวนี้ไม่มีผลสรุปแบบ M04 (`resultStatus`/`score`/`outcome`) และทีมไม่มี `sportTypeId`
 *    ชนิดกีฬาอยู่ที่ `tournament.sportTypeId` แทน
 */
export interface BackendRefereeMatchDto {
  id: number;
  tournament: { id: number; name: string; sportTypeId: number };
  round: number | null;
  teamA: { id: number; name: string } | null;
  teamB: { id: number; name: string } | null;
  scheduledTime: string | null;
  scheduledEndTime: string | null;
  venue: string | null;
  mode: Mode;
  status: MatchStatus;
}

/** GET /matches/:id — ฟิลด์ผลสรุปชุดเดียวกับ M04 */
export interface BackendMatchDetailDto extends BackendMatchListItemDto {
  tournamentId: number;
  checkinOpenAt: string | null;
  mode: Mode;
  roomCode: string | null;
  /**
   * ⚠️ M05 **ยังไม่ส่งช่องนี้** — คอลัมน์ `matches.livestream_url` มีอยู่จริงและ E12 เขียนลง
   * ไปได้ แต่ไม่มี endpoint ไหนอ่านคืนมา (`grep livestream_url` ที่ backend เจอแค่ UPDATE
   * ของ E12) ผู้จัดจึงบันทึกลิงก์ย้อนหลังได้แต่ไม่มีใครเห็นลิงก์นั้นอีก · ประกาศไว้ optional
   * เพื่อให้หน้าจอขึ้นเองทันทีที่ backend เติมมา (ดู FE-replay-link-write-only)
   */
  livestreamUrl?: string | null;
}

/** PUT /matches/:id/livestream (E12) — คืนแค่สองช่องนี้ ไม่ใช่แมตช์ทั้งใบ */
export interface BackendLivestreamDto {
  matchId: number;
  youtubeUrl: string | null;
}

/** PATCH /matches/:id/schedule — ⚠️ backend รับเฉพาะรูปแบบ Z (z.iso.datetime ไม่มี offset) */
export interface ScheduleMatchRequest {
  scheduledTime: string;
  scheduledEndTime: string;
  venue: string;
}

/** GET /matches/:id/checkins — id ของแถวนี้คือ :cid ที่ใช้ verify/reject */
export interface BackendCheckinDto {
  id: number;
  userId: number;
  fullName: string;
  method: CheckinMethod;
  /** คำที่ backend ใช้ตอบ ไม่ตรงกับ MatchCheckinStatus ของ prototype */
  status: "checked_in" | "pending_verification" | "rejected";
  documentType: CheckinDocumentType | null;
  /** presigned URL — กรรมการของแมตช์เท่านั้นที่เห็น (ผู้จัดได้ null ตาม PDPA) */
  documentUrl: string | null;
  /** เหตุผลที่กรรมการอนุโลมเช็คอินให้ด้วยมือ (M19) — มาเป็นฟิลด์ของตัวเองตั้งแต่ `75ffb0a` */
  note: string | null;
  checkedInAt: string;
}

/** GET /matches/:id/checkin-qr — ผู้จัดหรือกรรมการของแมตช์ และต้องเปิดเช็คอินแล้ว */
export interface BackendCheckinQrDto {
  qrPayload: string;
  expiresAt: string;
}

/** POST /matches/:id/checkins */
export type BackendCheckinRequest =
  | { method: "qr_onsite"; qrPayload: string }
  | { method: "photo_online"; documentType: CheckinDocumentType; documentS3Key: string };

export interface BackendSubmittedCheckinDto {
  id: number;
  status: BackendCheckinDto["status"];
  checkedInAt: string;
}

/**
 * POST /matches/:id/checkins/manual (M19) — กรรมการของแมตช์เช็คอินแทนผู้เล่น
 * เมื่อกล้อง/เน็ต/QR ใช้ไม่ได้ (UC-04 E2b) ได้สถานะ `exception` ซึ่งนับว่าเช็คอินแล้ว
 */
export interface BackendManualCheckinRequest {
  userId: number;
  note?: string;
}

export interface BackendManualCheckinDto {
  id: number;
  userId: number;
  method: "manual_by_referee";
  status: BackendCheckinDto["status"];
  checkedInAt: string;
}

/**
 * GET /matches/:id/checkins/me — แถวของตัวเอง
 * รายการทั้งแมตช์เปิดให้เฉพาะกรรมการกับผู้จัด เส้นนี้จึงเป็นทางเดียวที่ผู้เล่นรู้ว่าตัวเองผ่านหรือยัง
 */
export interface BackendMyCheckinDto {
  checkin: {
    id: number;
    method: CheckinMethod;
    status: BackendCheckinDto["status"];
    rejectionReason: string | null;
    /** เหตุผลที่กรรมการอนุโลมให้ (M19) — แยกคอลัมน์แล้วตั้งแต่ migration 015 */
    note: string | null;
    checkedInAt: string;
    verifiedAt: string | null;
  } | null;
}

/** POST /matches/:id/result */
export interface BackendSubmitResultRequest {
  winnerTeamId: number;
  /** key เป็น teamId (สตริง) ไม่ใช่ "a"/"b" แบบ prototype */
  scoreData: Record<string, number>;
}

export interface BackendSubmittedResultDto {
  id: number;
  matchId: number;
  status: MatchResultStatus;
  submittedBy: number;
}

export interface BackendVerifiedResultDto {
  matchId: number;
  status: MatchResultStatus;
  winnerTeamId: number | null;
  nextMatchId: number | null;
}

/** GET /matches/:id/result — 404 ระหว่างที่ผลถูกโต้แย้ง */
export interface BackendResultDto {
  matchId: number;
  winnerTeamId: number | null;
  scoreData: Record<string, number> | null;
  isAmended: boolean | null;
  amendedAt: string | null;
  amendReason: string | null;
  verifiedAt: string | null;
  /** A7 — สถานะจริงของผล ไม่ใช่เดาว่า verified เสมอ (submitted/disputed ก็อ่านได้แล้ว) */
  status: MatchResultStatus;
  isWalkover: boolean;
}

export interface BackendDisputeRequest {
  reason: string;
}

/** POST /matches/:id/result/resolve — ผู้จัดเท่านั้น */
export interface BackendResolveRequest {
  resolution: "uphold" | "reject";
  resolutionNote: string;
}

/** POST /matches/:id/stats — อ้างด้วย statDefinitionId ไม่ใช่ statKey */
export interface RecordMatchStatsRequest {
  playerStats: Array<{
    userId: number;
    values: Array<{ statDefinitionId: number; value: number }>;
  }>;
}

export interface BackendPlayerStatDto {
  userId: number;
  fullName: string;
  stats: Array<{ statKey: string; statLabelTh: string; value: number }>;
}

/** POST /tournaments/:id/bracket */
export interface CreateBracketRequest {
  seedingMethod: "random" | "manual";
  manualSeeds?: number[];
  replace?: boolean;
}

export interface CreateBracketResponse {
  matchCount: number;
  bracketFormat: string;
  nodeCount: number;
  replaced: boolean;
}

export interface BackendBracketNodeDto {
  nodeId: number;
  bracketType: "winners" | "losers" | "grand_final";
  round: number | null;
  matchNumber: number;
  /** ⚠️ backend ยังไม่เขียนทีมที่เลื่อนสายลง bracket_nodes — รอบหลังจึงเป็น null เสมอ */
  teamA: BackendTeamRef | null;
  teamB: BackendTeamRef | null;
  matchId: number | null;
  matchStatus: MatchStatus | null;
  advancesToNodeId: number | null;
}

export interface BackendBracketDto {
  bracketFormat: string;
  nodes: BackendBracketNodeDto[];
}

/** GET /tournaments/:id/standings */
export interface BackendStandingDto {
  team: BackendTeamRef;
  played: number;
  wins: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  rank: number;
}

/** GET /tournaments/:id/dashboard */
export interface BackendTournamentDashboardDto {
  teamCount: number;
  playerCount: number;
  matchCount: number;
  matchesCompleted: number;
}

/** GET /tournaments/:id/winner — 404 จนกว่าทัวร์นาเมนต์จะมีสถานะ completed */
export interface BackendTournamentWinnerDto {
  championTeam: BackendTeamRef;
  runnerUpTeam: BackendTeamRef | null;
  summary: Record<string, unknown>;
}

/** GET /matches/:id/referees — สาธารณะ */
export interface BackendMatchRefereeDto {
  tournamentRefereeId: number;
  referee: { id: number; fullName: string; avatarUrl: string | null };
}

/**
 * POST /matches/:id/forfeit (M17) — ผลการตัดสินทีมไม่มาตามนัด
 *
 * `kind` บอกว่าลงเอยแบบไหน: ฝั่งเดียวไม่มา (อีกฝั่งชนะบาย) หรือไม่มาทั้งคู่
 * `checkedIn` คีย์ด้วย teamId เป็นสตริง — ใช้บอกผู้จัดว่าตอนตัดสินแต่ละทีมมากี่คน
 */
export interface BackendForfeitResultDto {
  id: number;
  status: "completed";
  kind: string;
  minMembers: number;
  checkedIn: Record<string, number>;
  walkovers: unknown;
}
