/**
 * src/types/admin.dto.ts — Person 4 (Admin · Organizer approval · Referee)
 *
 * คู่กับ `team.dto.ts` แยกไฟล์ตามเหตุผลเดียวกัน — `dto.ts` เป็นของสไลซ์ 1
 * และห้ามเดา field สำหรับ endpoint ที่ยังไม่เห็นใน GUIDE/06
 *
 * ── ตารางที่อ่านข้ามสไลซ์ ─────────────────────────────────────────────────
 * คิวอนุมัติทัวร์นาเมนต์อ่าน `tournaments` ซึ่งเป็นตารางของสไลซ์ 2 และการระงับ
 * บัญชีอ่าน `users` ของสไลซ์ 1 — แต่ **การตัดสิน** เป็นของสไลซ์ 4 ทั้งคู่
 * (FR-TC-02, FR-UM-05) เจ้าของตารางคือคนที่ทำ CRUD ปกติ ไม่ใช่คนที่ตัดสิน
 */
import type {
  RefereeInvitationStatus,
  ExternalApprovalStatus,
  TournamentStatus,
} from "./enums";
import type { UserRefDto } from "./team.dto";

// ══════════════ คิวอนุมัติทัวร์นาเมนต์ — FR-TC-02 ══════════════

/**
 * คำขอจัดตั้งทัวร์นาเมนต์ที่รอ Admin ตัดสิน
 * อนุมัติแล้ว FR-TC-03 สั่งให้สร้างระเบียนสถานะ **Private** และตั้งผู้ยื่นเป็น Organizer
 * — ไม่ใช่ public ทันที การเปิดให้คนเห็นเป็นคนละขั้น
 */
export interface TournamentRequestDto {
  id: number;
  name: string;
  sportName: string;
  requestedBy: UserRefDto;
  status: TournamentStatus;
  eventStartDate: string;
  eventEndDate: string | null;
  venue: string | null;
  maxTeams: number;
  minTeams: number;
  /** เงื่อนไขรับสมัครที่ยื่นมา — Hard filter ตั้งครั้งเดียวตอนสร้าง แก้ทีหลังต้องขอ */
  entryRules: {
    gender: "any" | "male" | "female";
    minAge: number | null;
    maxAge: number | null;
  };
  requestedAt: string;
  reviewedBy: UserRefDto | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

/** FR-TC-02: ไม่อนุมัติต้องระบุเหตุผล และส่งกลับถึงผู้ยื่น */
export interface ReviewTournamentRequest {
  approve: boolean;
  rejectionReason?: string;
}

// ══════════════ กรรมการ — ตาราง `tournament_referees` ══════════════

/**
 * แต่งตั้งเข้าทัวร์นาเมนต์ = "มีสิทธิ์" (FR-RM-01)
 * มอบหมายเข้าแมตช์    = "รับผิดชอบ" (สไลซ์ 3, ตาราง match_referees)
 * สองเรื่องคนละตาราง และคนละความหมาย
 *
 * ⚠️ `schema.sql:273` จงใจไม่ใส่ UNIQUE(tournament_id, user_id) — เชิญซ้ำได้
 *    ไม่จำกัด และทุก query ตรวจสิทธิ์ต้องดึงแถวล่าสุด แต่ `created_at` เป็น
 *    DATETIME ความละเอียดวินาที เชิญสองครั้งในวินาทีเดียวกันแล้วลำดับจะมั่ว
 *    ให้เรียงด้วย `tournament_referee_id DESC` แทน (รีวิว schema รอบแรกเจอ)
 */
export interface TournamentRefereeDto {
  id: number;
  tournamentId: number;
  user: UserRefDto;
  invitedBy: UserRefDto;
  invitationStatus: RefereeInvitationStatus;
  /** FR-RM-02 — บุคคลภายนอกต้องให้ Admin อนุมัติก่อนจึงมีสิทธิ์ */
  isExternal: boolean;
  externalApprovalStatus: ExternalApprovalStatus;
  approvedBy: UserRefDto | null;
  approvedAt: string | null;
  createdAt: string;
  removedAt: string | null;
  removedBy: UserRefDto | null;
  /**
   * มีสิทธิ์ทำหน้าที่จริงหรือยัง — ตอบรับแล้ว และถ้าเป็นคนนอกต้องอนุมัติแล้วด้วย
   * server ตัดสิน เพราะเป็นเงื่อนไขสองชั้นที่ FR-RM-01 กับ FR-RM-02 คุมคนละชั้น
   */
  isActive: boolean;
}

export interface AppointRefereeRequest {
  userId: number;
  /** backend บังคับช่องนี้ — ไม่ส่งถือว่า false ที่ชั้น api */
  isExternal?: boolean;
  /** แมตช์ที่เสนอให้คุมพร้อมคำเชิญ — ว่าง = เชิญเข้า pool เฉยๆ */
  matchIds?: number[];
}

export interface AnswerAppointmentRequest {
  accept: boolean;
}

/**
 * FR-RM-03 — on-site ที่บันทึกสถิติต้องมีกรรมการที่ตอบรับแล้วอย่างน้อย 2 คน
 * ถ้าไม่ครบ ระบบต้องไม่อนุญาตให้เริ่มบันทึกสถิติ
 *
 * ตัวนี้กระทบสไลซ์ 3 ด้วย: `MatchViewerContext.can.recordStats` ต้องเป็น false
 * เมื่อ `shortfall > 0` — เป็นกฎเดียวกัน คนละหน้าจอ
 */
export interface RefereeCoverageDto {
  tournamentId: number;
  required: number;
  accepted: number;
  /** ขาดอีกกี่คน — 0 แปลว่าครบ */
  shortfall: number;
  blocksStatRecording: boolean;
}

// ══════════════ สิทธิ์ผู้ดูแล — ตาราง `admin_scopes` ══════════════

/**
 * Admin ไม่ได้มีอำนาจเท่ากันหมด — `scope_type` แยกระดับคณะกับระดับมหาวิทยาลัย
 * ระดับคณะต้องมี `faculty_id` กำกับว่าคุมคณะไหน
 */
export interface AdminScopeDto {
  id: number;
  user: UserRefDto;
  scopeType: "faculty" | "university_wide";
  facultyId: number | null;
  facultyName: string | null;
  createdAt: string;
  createdBy: UserRefDto | null;
}

export interface GrantAdminScopeRequest {
  userId: number;
  scopeType: "faculty" | "university_wide";
  facultyId?: number;
}

// ══════════════ ระงับบัญชี — FR-UM-05 (คอลัมน์อยู่ใน `users`) ══════════════

/**
 * ผู้ใช้ที่ถูกระงับ **ต้องเข้าสู่ระบบไม่ได้ และไม่นับเป็นสมาชิกทีมที่มีสิทธิ์ลงแข่ง**
 * ข้อหลังสำคัญกว่าที่เห็น — มันเปลี่ยนจำนวนสมาชิกที่ใช้ได้ของทุกทีมที่คนนั้นอยู่
 */
export interface UserAdminViewDto {
  user: UserRefDto;
  email: string;
  userType: string;
  facultyName: string | null;
  isSuspended: boolean;
  suspendedReason: string | null;
  /** สิทธิ์ผู้ดูแลที่ถืออยู่ — ว่างแปลว่าเป็นผู้ใช้ทั่วไป */
  adminScopes: AdminScopeDto[];
  teamCount: number;
}

export interface SuspendUserRequest {
  suspend: boolean;
  reason?: string;
}

// ══════════════ Audit — ตาราง `audit_logs` ══════════════

/**
 * FR-TC-05 ให้ Admin เรียกดูและจัดการข้อมูลย้อนหลังก่อนถึงกำหนดลบ 4 ปี
 * `audit_logs` ไม่มี `updated_at` โดยเจตนา — เขียนครั้งเดียว ไม่มีการแก้
 */
export interface AuditLogDto {
  id: number;
  user: UserRefDto;
  actionType: string;
  entityType: string;
  entityId: number;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogQuery {
  entityType?: string;
  entityId?: number;
  userId?: number;
  limit?: number;
}

// ══════════════ คำร้องทีม Official — FR-TM-06, FR-TM-08 ══════════════

export interface OfficialTeamRequestDto {
  id: number;
  team: {
    id: number;
    name: string;
    sportTypeId?: number;
  };
  requestedBy: UserRefDto;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface ApproveTeamOfficialResponse {
  teamId: number;
  officialStatus: "Unofficial" | "Official";
}

export interface RejectTeamOfficialResponse {
  status: "pending" | "approved" | "rejected";
  reason: string | null;
}

// ══════════════ คำเชิญกรรมการส่วนตัว — GET /me/referee-invitations ══════════════

export interface TournamentRefSummaryDto {
  id: number;
  name: string;
  sportTypeId: number;
  eventStartDate: string;
}

export interface MyRefereeInvitationDto {
  id: number;
  tournament: TournamentRefSummaryDto;
  isExternal: boolean;
  createdAt: string;
}

// ══════════════ คำขอกรรมการภายนอก — FR-RM-02 ══════════════

/**
 * บุคคลภายนอกที่ตอบรับการแต่งตั้งแล้ว รอ Admin อนุมัติก่อนนับเป็นกรรมการของรายการ
 * เส้นจริงคือ GET /admin/referee-requests ซึ่งจัดกลุ่ม "ต่อคน" (ดู BackendExternalRefereeQueueItem)
 * api/admin.ts คลี่ให้เป็นแถวละ (คน × รายการ) และให้ id = userId ที่ใช้อนุมัติ/ปฏิเสธ
 */
export interface ExternalRefereeRequestDto {
  id: number;
  tournament: { id: number; name: string };
  referee: UserRefDto;
  /** null ในโหมดจริง — คิว AR01 ของ backend ไม่ได้บอกว่าใครเป็นผู้เชิญ */
  invitedBy: UserRefDto | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

/** ไม่อนุมัติต้องระบุเหตุผล (SDS 7.4 — ทุกการปฏิเสธต้องระบุเหตุผล) */
export interface ReviewExternalRefereeRequest {
  approve: boolean;
  reason?: string;
}


// ══════════════════════════════════════════════════════════════════════════
// รูปที่ backend ตอบจริง (BE_KN 98aa300) — กรรมการ / คิว Admin
// ══════════════════════════════════════════════════════════════════════════

/** GET /tournaments/:id/referees/coverage — F14 */
export interface BackendRefereeCoverageDto {
  matchesTotal: number;
  matchesCovered: number;
  uncovered: Array<{
    matchId: number;
    roundNumber: number | null;
    scheduledTime: string | null;
    /** ต้องมีกี่คน — on-site ที่เก็บสถิติ = 2 · อื่นๆ = 1 */
    needed: number;
    assigned: number;
  }>;
  /** กรรมการที่มีแมตช์เวลาซ้อนกัน — เตือนเฉยๆ ไม่บล็อก */
  conflicts: Array<{ userId: number; matchIds: number[] }>;
}

/** GET /tournaments/:id/referees — F02 */
export interface BackendTournamentRefereeDto {
  id: number;
  user: UserRefDto;
  invitationStatus: "pending" | "accepted" | "rejected";
  isExternal: boolean;
  externalApprovalStatus: "not_required" | "pending" | "needs_docs" | "approved" | "rejected";
  status: "pending" | "pending_admin" | "active" | "declined" | "rejected_by_admin" | "removed";
}

export interface BackendTournamentRefereeListDto {
  items: BackendTournamentRefereeDto[];
  acceptedCount: number;
  effectiveCount: number;
}

/** GET /me/referee-invitations — F04 */
export interface BackendMyRefereeInvitationDto {
  id: number;
  tournament: { id: number; name: string; sportTypeId: number; eventStartDate: string };
  isExternal: boolean;
  matches: Array<{
    id: number;
    roundNumber: number | null;
    scheduledTime: string | null;
    scheduledEndTime: string | null;
    venue: string | null;
    mode: "onsite" | "online";
    matchStatus: string;
    assignmentStatus: string;
  }>;
  createdAt: string;
}

/** GET /admin/referee-requests — AR01 (จัดกลุ่มต่อคน) */
export interface BackendExternalRefereeQueueItem {
  userId: number;
  user: UserRefDto & { email: string };
  /** S3 key ดิบ — ต้องขอ presign เองก่อนเปิดดู */
  docs: string[];
  tournaments: Array<{ id: number; name: string; tournamentRefereeId: number }>;
  submittedAt: string;
}

/** GET /me/referee-identity — U11 */
export interface BackendRefereeIdentityDto {
  status: "none" | "pending" | "needs_docs" | "approved" | "rejected";
  approvedAt: string | null;
  expiresAt: string | null;
  adminMessage: string | null;
  docsSubmitted: boolean;
  docsRequired: boolean;
  tournaments: Array<{
    id: number;
    name: string;
    tournamentRefereeId: number;
    externalApprovalStatus: string;
  }>;
}

/** คำขอย้าย/แลก/เพิ่มแมตช์ของกรรมการ — FR01–FR03 */
export interface BackendRefereeRequestDto {
  id: number;
  tournamentId: number;
  type: "ref_transfer" | "ref_swap" | "org_add_match" | "org_swap";
  requestedBy: number;
  refereeA: { tournamentRefereeId: number; user: UserRefDto; status: string };
  refereeB: { tournamentRefereeId: number; user: UserRefDto; status: string } | null;
  matchA: { id: number; roundNumber: number | null; scheduledTime: string | null; scheduledEndTime: string | null };
  matchB: { id: number; roundNumber: number | null; scheduledTime: string | null; scheduledEndTime: string | null } | null;
  status: "open" | "applied" | "declined" | "cancelled";
  createdAt: string;
  resolvedAt: string | null;
}
