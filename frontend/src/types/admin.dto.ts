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
  isExternal?: boolean;
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
