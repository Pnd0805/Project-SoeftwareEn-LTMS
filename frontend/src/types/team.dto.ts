/**
 * src/types/team.dto.ts — Person 4 (Teams · Admin · Organizer approval · Referee)
 *
 * แยกไฟล์ตามเหตุผลเดียวกับ `match.dto.ts`: `dto.ts` เป็นของสไลซ์ 1 และห้ามเดา
 * field ล่วงหน้าสำหรับ endpoint ที่ยังไม่เห็นใน GUIDE/06 — ไฟล์นี้เจ้าของคนเดียว
 * แตะได้โดยไม่ต้องรอใคร แล้วค่อย reconcile รอบเดียวตอน GUIDE/06 ส่วน Team มาถึง
 *
 * ทุก field ถอดจาก `schema.sql` (teams · team_members · team_invitations ·
 * team_admin_requests · official_team_memberships · player_profile_stats)
 * แปลง snake_case เป็น camelCase ตามคอนเวนชันของ dto.ts
 */
import type {
  TeamReadinessStatus,
  TeamOfficialStatus,
  TeamInvitationStatus,
  TeamAdminRequestStatus,
} from "./enums";

// ══════════════ ตัวช่วยร่วม ══════════════

export interface UserRefDto {
  id: number;
  fullName: string;
  avatarUrl: string | null;
}

/** สมาชิกในทีม — `position` มาจาก team_members ซึ่งเป็น **ระดับทีม** ไม่ใช่ระดับแมตช์ */
export interface TeamMemberDto {
  user: UserRefDto;
  /** ตัวจริง / ตัวสำรอง — FR-TM-04 ให้หัวหน้าทีมเป็นคนกำหนด */
  position: "starter" | "substitute";
  joinedAt: string;
  /** หัวหน้าทีมคือ teams.leader_id ไม่ได้เก็บเป็น flag ในตารางสมาชิก */
  isLeader: boolean;
}

// ══════════════ Team — ตาราง `teams` ══════════════

export interface TeamDto {
  id: number;
  name: string;
  /** ยังไม่มีใน schema — teams ไม่มีคอลัมน์ code/color แต่ UI ทั้งแอปใช้
   *  TODO(schema): ทีมทุกที่ในแอปวาดด้วยตัวย่อกับสีประจำทีม
   *    ALTER TABLE teams ADD code VARCHAR(8) NULL, ADD color VARCHAR(9) NULL,
   *                      ADD logo_key VARCHAR(255) NULL;
   *    ตอนนี้ prototype เก็บไว้ในหน่วยความจำเท่านั้น พอต่อ backend จริงจะหาย */
  code: string | null;
  color: string | null;
  logoUrl: string | null;

  sportTypeId: number;
  sportName: string;
  leader: UserRefDto;
  members: TeamMemberDto[];

  /** Forming จนกว่าสมาชิกจะครบขั้นต่ำของกีฬานั้น แล้วจึงเป็น Ready */
  readinessStatus: TeamReadinessStatus;
  /** Unofficial จนกว่า Admin อนุมัติคำร้อง (FR-TM-06) */
  officialStatus: TeamOfficialStatus;

  createdAt: string;
  updatedAt: string | null;
  /** ใช้นับกฎ 6 เดือนของ FR-TM-07 */
  lastCompetedAt: string | null;
  deletedAt: string | null;
  /** NULL = ยังไม่ถูกลบ · ค่าอื่นบอกว่าใครหรืออะไรเป็นคนลบ */
  deletedReason: "no_registration" | "leader_deleted" | "inactive_6_months" | null;

  /**
   * สิ่งที่คนที่กำลังดูอยู่ทำได้ — server ตัดสิน แบบเดียวกับ MatchViewerContext
   * กฎพวกนี้ backend ต้องเช็คซ้ำอยู่แล้ว เขียนสองที่แล้วจะเพี้ยนจากกัน
   */
  viewer: {
    isLeader: boolean;
    isMember: boolean;
    can: {
      /** FR-TM-02 */
      invite: boolean;
      /** FR-TM-04 — เปลี่ยนชื่อทีมและตำแหน่งสมาชิก */
      edit: boolean;
      /** FR-TM-05 — ลบได้เฉพาะทีมที่ยังไม่เคยลงแข่ง */
      disband: boolean;
      /** FR-TM-08 — ทีม Official ต้องผ่าน Admin */
      transferLeader: boolean;
      /** FR-TM-06 — ยื่นขอเป็น Official */
      requestOfficial: boolean;
      kickMember: boolean;
    };
    /** เหตุผลที่ disband ไม่ได้ เช่น "กำลังแข่งอยู่" — FR-TM-05 สั่งให้บอกทางออก */
    disbandBlockedReason: string | null;
  };
}

/** FR-TM-01 — ชื่อซ้ำในกีฬาเดียวกันไม่ได้ (teams มี UNIQUE(name, sport_type_id)) */
export interface CreateTeamRequest {
  name: string;
  sportTypeId: number;
  code?: string;
  color?: string;
}

/** FR-TM-04 — แก้ชื่อ และตำแหน่งสมาชิก */
export interface UpdateTeamRequest {
  name?: string;
  code?: string;
  color?: string;
}

export interface SetMemberPositionRequest {
  userId: number;
  position: "starter" | "substitute";
}

// ══════════════ Invitations — ตาราง `team_invitations` ══════════════

export interface TeamInvitationDto {
  id: number;
  team: { id: number; name: string; code: string | null; color: string | null };
  invitedUser: UserRefDto;
  invitedBy: UserRefDto;
  status: TeamInvitationStatus;
  createdAt: string;
  respondedAt: string | null;
  /**
   * TODO(schema): `team_invitations` ไม่มีคอลัมน์ `expires_at`
   *   แต่ FR-TM-02 สั่งให้แสดงสถานะ "หมดอายุ" และ FR-TM-03 ระบุว่าคำเชิญที่
   *   หมดอายุแล้วตอบรับไม่ได้ — และ enum ก็มีค่า 'expired' รออยู่แล้ว
   *   `schema.sql:143` เขียนเตือนตัวเองไว้ด้วยว่า API (T09/T12/T13) ต้องใช้
   *
   *   ALTER TABLE team_invitations ADD expires_at DATETIME NULL;
   */
  expiresAt: string | null;
}

export interface InviteMemberRequest {
  /** ค้นจากชื่อหรืออีเมลก่อน แล้วส่ง id ที่เลือก (FR-TM-02) */
  userId: number;
}

// ══════════════ คำร้องถึง Admin — ตาราง `team_admin_requests` ══════════════

/**
 * สองเรื่องที่ต้องให้ Admin ตัดสิน เดินทางเดียวกัน
 *   official_status  FR-TM-06 — ขอเป็นทีม Official
 *   leader_transfer  FR-TM-08 — เปลี่ยนหัวหน้าทีม Official
 */
export interface TeamAdminRequestDto {
  id: number;
  team: { id: number; name: string; code: string | null; color: string | null };
  requestType: "official_status" | "leader_transfer";
  requestedBy: UserRefDto;
  /** ผู้รับตำแหน่งใหม่ — เฉพาะ leader_transfer */
  targetUser: UserRefDto | null;
  status: TeamAdminRequestStatus;
  requestedAt: string;
  reviewedBy: UserRefDto | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  /**
   * FR-TM-06: อนุมัติได้ต่อเมื่อสมาชิกทุกคนไม่สังกัดทีม Official อื่นในกีฬาเดียวกัน
   * ถ้าติด ต้องบอกว่าใครติด — server ตรวจให้ เพราะเป็นกฎที่ DB บังคับอยู่แล้ว
   * (`official_team_memberships` มี UNIQUE(user_id, sport_type_id))
   */
  blockingMembers: UserRefDto[];
}

export interface RequestOfficialStatusRequest {
  reason: string;
}

export interface TransferLeaderRequest {
  targetUserId: number;
}

export interface ReviewTeamRequestRequest {
  approve: boolean;
  rejectionReason?: string;
}

// ══════════════ สถิติสะสมรายคน — ตาราง `player_profile_stats` ══════════════

export interface PlayerProfileDto {
  user: UserRefDto;
  facultyId: number;
  departmentId: number;
  teams: Array<{ id: number; name: string; code: string | null; color: string | null; sportName: string }>;
  /** หนึ่งแถวต่อหนึ่งชนิดกีฬา — ตาราง player_profile_stats มี UNIQUE(user, sport) */
  bySport: Array<{
    sportTypeId: number;
    sportName: string;
    matchesPlayed: number;
    wins: number;
    losses: number;
    championships: number;
  }>;
}
