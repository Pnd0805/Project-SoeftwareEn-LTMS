import type {
  BracketFormat,
  EligibilityRuleType,
  ExternalApprovalStatus,
  GenderRequirement,
  RefereeInvitationStatus,
  TournamentApplicationStatus,
  TournamentScopeType,
  TournamentStatus,
} from "./enums";
import type { TeamRef, UserRef } from "./dto";

export interface TournamentDto {
  id: number;
  name: string;
  sportTypeId: number;
  bracketFormat: BracketFormat | null;
  scopeType: TournamentScopeType;
  organizingFacultyId: number | null;
  organizingDepartmentId: number | null;
  requestedByUserId: number;
  status: TournamentStatus;
  registrationOpen: boolean;
  registrationStart: string | null;
  registrationEnd: string | null;
  eventStartDate: string;
  eventEndDate: string | null;
  maxTeams: number;
  minTeams: number;
  venue: string | null;
  disputeWindowHours: number;
  genderRequirement: GenderRequirement;
  minAge: number | null;
  maxAge: number | null;
  rejectionReason: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface TournamentDetailDto extends TournamentDto {
  eligibilityRules: EligibilityRuleDto[];
  referees: TournamentRefereeDto[];
  applications: TournamentApplicationDto[];
  /** มากับ GET /tournaments/:id ของ backend — โหมด mock ไม่มีให้ */
  organizer?: UserRef;
  approvedTeamCount?: number;
  /** C14b: populated when the organizer explicitly closes the tournament. */
  championTeamId: number | null;
  completedAt: string | null;
}

export interface EligibilityRuleDto {
  id: number;
  tournamentId: number;
  ruleType: EligibilityRuleType;
  ruleValue: number;
}

export interface TournamentRefereeDto {
  id: number;
  tournamentId: number;
  userId: number;
  user: UserRef;
  matchId: number | null;
  invitedBy: number;
  invitationStatus: RefereeInvitationStatus;
  isExternal: boolean;
  externalApprovalStatus: ExternalApprovalStatus;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface TournamentApplicationDto {
  id: number;
  tournamentId: number;
  teamId: number;
  team: TeamRef;
  hardFilterPassed: boolean | null;
  hardFilterDetails: Record<string, unknown> | null;
  softFilterDocuments: Record<string, unknown> | null;
  status: TournamentApplicationStatus;
  reviewedBy: number | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  appliedAt: string;
}

/** Organizer response from GET /tournaments/:id/applications on origin/backend. */
export interface BackendTournamentApplicationDto {
  id: number;
  team: TeamRef;
  status: TournamentApplicationStatus;
  hardFilterPassed: boolean;
  softFilterDocuments: unknown;
  appliedAt: string;
}

export interface BackendTournamentApplicationsResponse {
  items: BackendTournamentApplicationDto[];
}

/** Public response from GET /tournaments/:id/teams on origin/backend. */
export interface BackendTournamentTeamDto {
  id: number;
  name: string;
  sportTypeId: number;
}

export interface BackendTournamentTeamsResponse {
  items: BackendTournamentTeamDto[];
}

/** Team-leader response from GET /me/applications on origin/backend. */
export interface BackendMyApplicationDto {
  id: number;
  tournament: { id: number; name: string };
  team: TeamRef;
  status: TournamentApplicationStatus;
  rejectionReason: string | null;
  appliedAt: string;
}

export interface BackendMyApplicationsResponse {
  items: BackendMyApplicationDto[];
}

export interface TournamentListResponse {
  items: TournamentDto[];
}

export interface CreateTournamentRequest {
  name: string;
  sportTypeId: number;
  bracketFormat?: BracketFormat | null;
  /** MVP รับแค่สองค่านี้ — 'university' ยังรอ Change Management */
  scopeType: Exclude<TournamentScopeType, "university">;
  organizingFacultyId?: number | null;
  organizingDepartmentId?: number | null;
  /** ISO 8601 พร้อมโซนเวลา — backend บังคับ และต้องเรียง เปิด < ปิด < วันแข่งวันแรก */
  registrationStart: string;
  registrationEnd: string;
  eventStartDate: string;
  eventEndDate: string;
  maxTeams: number;
  minTeams: number;
  venue: string;
  disputeWindowHours?: number;
  genderRequirement?: GenderRequirement;
  minAge?: number | null;
  maxAge?: number | null;
  /**
   * คณะและชั้นปีที่เปิดรับ (C01 · `66d5cfc`) — ไม่ส่งหรือส่งลิสต์ว่าง = ไม่จำกัด
   *
   * หนึ่งทัวร์ระบุได้หลายคณะ และเป็นตัวตัดสินว่าใครอนุมัติคำขอนี้: จำกัดเฉพาะคณะของ
   * แอดมินคณะคนนั้น → เขาอนุมัติเอง · นอกนั้น (หลายคณะ หรือไม่จำกัด) ต้องแอดมิน
   * ระดับมหาวิทยาลัย ไม่งั้น `403 ELIGIBILITY_OUT_OF_SCOPE` (OD-15 Q2-ข)
   */
  eligibilityRules?: BackendEligibilityRuleInput[];
}

/**
 * รูปที่ "เขียน" กฎคุณสมบัติ — คนละชื่อช่องกับตอนอ่าน (`BackendEligibilityRuleDto`
 * ใช้ `ruleType`/`ruleValue`) ต้องแปลงกันทุกครั้ง ไม่ใช่ส่งของที่อ่านมากลับไปตรงๆ
 */
export interface BackendEligibilityRuleInput {
  type: EligibilityRuleType;
  value: number;
}

export type UpdateTournamentRequest = Partial<CreateTournamentRequest> & {
  registrationOpen?: boolean;
  registrationStart?: string | null;
  registrationEnd?: string | null;
};

export interface CreateEligibilityRuleRequest {
  ruleType: EligibilityRuleType;
  ruleValue: number;
}

/**
 * POST /tournaments/:id/amendment-requests (C09) — ขอแก้ทัวร์ที่อนุมัติไปแล้ว
 *
 * รับเฉพาะช่องใน `allowedAmendmentFields` ของ backend · ช่องอื่นตอบ
 * `400 AMENDMENT_FIELD_NOT_ALLOWED` พร้อมชื่อช่องที่ไม่รับ
 * ⚠️ ไม่มีที่ให้ผู้จัดเขียนเหตุผล — ตาราง `tournament_amendment_requests` มีแต่
 *    `rejection_reason` ซึ่งเป็นของแอดมิน แอดมินจึงเห็นแค่ "ขอเปลี่ยนเป็นอะไร"
 */
export interface AmendmentRequestPayload {
  name?: string;
  registrationStart?: string;
  registrationEnd?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  minTeams?: number;
  maxTeams?: number;
  genderRequirement?: GenderRequirement;
  minAge?: number | null;
  maxAge?: number | null;
  eligibilityRules?: BackendEligibilityRuleInput[];
}

export interface InviteTournamentRefereeRequest {
  userId: number;
  /** backend บังคับช่องนี้ — ไม่ส่งถือว่า false ที่ชั้น api */
  isExternal?: boolean;
  /** แมตช์ที่เสนอให้คุมพร้อมคำเชิญ — ว่าง = เชิญเข้า pool เฉยๆ */
  matchIds?: number[];
}

export interface ApplyToTournamentRequest {
  teamId: number;
  /**
   * รายชื่อผู้ลงแข่งของนัดนี้ — ไม่ส่งมาก็ถือว่าทั้งทีม
   * Hard filter ตรวจรายคนจากรายชื่อนี้ ไม่ใช่จากสมาชิกทั้งทีม (FR-PV-01)
   * โหมด prototype เท่านั้น เพราะเป็น id ของ store
   */
  squad?: string[];
  /**
   * ของจริง (P01 · migration 018): ต้องส่งรายชื่อที่ลงแข่งมาเสมอ ห้ามว่างและห้ามซ้ำ
   * จำนวนต้องอยู่ใน [sportType.minMembers, maxMembers] และหนึ่งคนมีชื่อได้ทีมเดียว
   * ต่อหนึ่งทัวร์ — ไม่ส่งมาแล้ว backend ตอบ VALIDATION_FAILED ไม่ใช่เอาทั้งทีมให้
   */
  playerIds?: number[];
}

export interface ReviewTournamentApplicationRequest {
  status: Extract<TournamentApplicationStatus, "approved" | "rejected">;
  rejectionReason?: string | null;
}

export interface TournamentAnnouncementDto {
  id: number;
  tournamentId: number;
  authorId: number;
  title: string;
  body: string;
  createdAt: string;
}

export interface TournamentAnnouncementListResponse {
  items: TournamentAnnouncementDto[]
}

export interface CreateTournamentAnnouncementRequest {
  title: string;
  body: string;
}

export interface TournamentFeedbackDto {
  id: number;
  tournamentId: number;
  userId: number;
  rating: number;
  text: string;
  createdAt: string;
}

export interface SubmitTournamentFeedbackRequest {
  rating: number;
  text: string;
}

export interface DrawTournamentRequest {
  teamIds?: number[];
  /** M01/OD-22: atomically replace an unused bracket. */
  replace?: boolean;
}

export interface DrawTournamentResponse {
  matchCount: number;
  bracketFormat: string;
  nodeCount: number;
  replaced: boolean;
}

export interface CompleteTournamentResponse {
  id: number;
  status: "completed";
  championTeamId: number | null;
}

/** C09b — organizer-visible amendment history, newest first. */
export interface TournamentAmendmentHistoryItemDto {
  id: number;
  requestedChanges: Record<string, unknown>;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: UserRef | null;
  rejectionReason: string | null;
}

// ══════════════════════════════════════════════════════════════════════════
// รูปที่ backend ตอบจริง (BE_KN 98aa300) สำหรับเส้นที่ frontend เพิ่งต่อเพิ่ม
// ══════════════════════════════════════════════════════════════════════════

/**
 * GET /tournaments/:id/eligibility-rules — backend ส่งมาแค่สองช่องนี้
 * (ไม่มี id / tournamentId เหมือน EligibilityRuleDto ของ prototype)
 */
export interface BackendEligibilityRuleDto {
  ruleType: EligibilityRuleType;
  ruleValue: number;
}

/** GET /me/tournament-requests — คำขอจัดทัวร์นาเมนต์ของฉัน */
export interface BackendMyTournamentRequestDto {
  id: number;
  name: string;
  status: TournamentStatus;
  rejectionReason: string | null;
  createdAt: string;
}

/** GET /admin/tournament-requests — คิวที่รอ Admin อนุมัติ */
export interface BackendPendingTournamentRequestDto {
  id: number;
  name: string;
  requestedBy: UserRef;
  sportTypeId: number;
  eventStartDate: string;
  createdAt: string;
}

/** GET /admin/amendment-requests — คำขอแก้ไขทัวร์นาเมนต์ที่รอ Admin */
export interface BackendAmendmentRequestDto {
  id: number;
  tournamentId: number;
  tournamentName: string;
  requestedBy: UserRef;
  requestedChanges: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
}

/** GET /applications/:id — ผู้จัดหรือหัวหน้าทีมของใบสมัครนั้นเท่านั้น */
export interface BackendApplicationDetailDto {
  id: number;
  tournamentId: number;
  team: { id: number; name: string; sportTypeId: number };
  status: TournamentApplicationStatus;
  /** ผลตรวจ hard filter รายคน */
  hardFilterDetails: unknown[];
  /** presigned URL ไม่ใช่ S3 key ดิบ */
  softFilterDocuments: string[];
  /** รายชื่อที่ใบสมัครส่งลงแข่ง; ว่างเมื่อใบสมัครถูกยกเลิก/ปฏิเสธ/ถอนแล้ว */
  players: Array<{
    userId: number;
    fullName: string;
    avatarUrl: string | null;
  }>;
}

/** POST /uploads/presign — ขอที่อัปโหลดรูป (JPEG/PNG เท่านั้น) */
export interface PresignUploadRequest {
  purpose: "checkin_document" | "soft_filter_document" | "referee_identity";
  contentType: "image/jpeg" | "image/png";
  matchId?: number;
  tournamentId?: number;
}

export interface PresignUploadResponse {
  uploadUrl: string;
  /** ชื่อช่องของ backend คือ objectKey — เอาค่านี้ไปส่งต่อเป็น documentS3Key */
  objectKey: string;
  expiresIn: number;
}
