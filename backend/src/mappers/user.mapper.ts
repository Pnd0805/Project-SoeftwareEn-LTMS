import type { MyInvitationRow, AdminUserRow, UserSearchRow } from '../repositories/user.repo.js';
import type { UserRow, AdminScopeRow } from '../types/db.js';
import type { TeamRef } from './team.mapper.js';
import { toTeamRef } from './team.mapper.js';
import { toPublicImageUrl } from '../utils/imageUrl.js';
import { isCurrentlySuspended , suspensionCategoryLabel } from '../utils/suspension.js';
import type { SuspensionCategory } from '../utils/suspension.js';

export type MeDto = {
  id: number;
  fullName: string;
  email : string,
  gender : 'male' | 'female' | 'other',
  birthDate : string,
  userType : 'student' | 'staff' | 'external',
  facultyId : number | null ,
  departmentId : number | null,
  year : number | null,
  avatarUrl : string | null,
  contactInfo : string | null,
  address : string | null,
  totalPoints : number,
  notificationPrefs : Record<string , boolean> | null,
  /** OD-46 — ค่าสวิตช์ของตัวเอง (หน้าตั้งค่าต้องรู้สถานะปัจจุบันเพื่อ render ปุ่ม) · แก้ผ่าน U02 */
  showProfileStats : boolean,
  /**
   * OD-53 — ยืนยันอีเมลแล้วหรือยัง · อยู่ใน /me (ของตัวเอง) ไม่ใช่ UserPublicDto โดยเจตนา
   * ไม่ใช่ข้อมูลที่คนอื่นควรเห็น และไม่ได้ให้สิทธิ์อะไรเพิ่ม ⇒ ใช้ขึ้นแบนเนอร์ชวนยืนยันเท่านั้น
   */
  emailVerified : boolean,
  createdAt : string,
  /**
   * FE-viewer-admin-scope-unknown — สิทธิ์แอดมินของ *ตัวผู้เรียกเอง* · null = ไม่ใช่แอดมิน
   *
   * `facultyId` ข้างบนคือคณะที่ผู้ใช้ **สังกัด** ซึ่งไม่เกี่ยวกับขอบเขตที่ดูแล — คนละเรื่องกัน
   * ฟอร์มสร้างทัวร์ต้องรู้ข้อนี้เพราะ `autoApproveIfOwnScope` ทำให้ผลของการกด Send
   * ต่างกันตามคนกด · ถ้าจอไม่รู้ ก็บอกผู้ใช้ล่วงหน้าไม่ได้ว่าจะได้ `private` หรือเข้าคิว
   */
  adminScope : AdminScopeRefDto | null
};

export type UserRefDto = {
  id: number;
  fullName: string;
  avatarUrl: string | null;
};

// C2 — GET /admin/users
export type AdminScopeRefDto = {
  id : number,
  scopeType : 'faculty' | 'university_wide' | 'root',
  facultyId : number | null
};

export type AdminUserDto = {
  id : number,
  fullName : string,
  email : string,
  userType : 'student' | 'staff' | 'external',
  facultyId : number | null,
  isSuspended : boolean,
  suspendedReason : string | null,
  // เพิ่ม 1 ต.ค. 2569 — null ทั้งที่ isSuspended = true แปลว่า "ระงับถาวร" ไม่ใช่ "ไม่มีข้อมูล"
  // ถ้า isSuspended = false แต่ช่องนี้มีค่าในอดีต แปลว่าเพิ่งพ้นโทษ (ธงในฐานยังไม่ถูกล้าง เพราะไม่มี cron)
  suspendedUntil : string | null,
  // ประเภทที่เจ้าตัวเห็น (migration 034) — null คือแถวที่ระงับก่อนจะมีชุดนี้
  // คนละอย่างกับ suspendedReason ที่เป็นข้อความอิสระของแอดมิน และไม่เคยส่งให้เจ้าตัวเห็น
  suspendedCategory : SuspensionCategory | null,
  suspendedCategoryLabel : string | null,
  adminScope : AdminScopeRefDto | null
};

export function toAdminUserDto(row : AdminUserRow) : AdminUserDto{
  const adminScope : AdminScopeRefDto | null = row.admin_scope_id === null ? null : {
    id : row.admin_scope_id,
    scopeType : row.admin_scope_type!,
    facultyId : row.admin_scope_faculty_id
  };
  return {
    id : row.user_id,
    fullName : row.full_name,
    email : row.email,
    userType : row.user_type,
    facultyId : row.faculty_id,
    isSuspended : isCurrentlySuspended(row),   // ไม่ใช่ row.is_suspended ดิบ — คนที่พ้นกำหนดแล้วต้องแสดงว่าใช้งานได้
    suspendedReason : row.suspended_reason,
    suspendedUntil : row.suspended_until?.toISOString() ?? null,
    suspendedCategory : row.suspended_category,
    suspendedCategoryLabel : suspensionCategoryLabel(row.suspended_category),
    adminScope : adminScope
  };
}

export type PublicUserDto = {
  id : number,
  fullName : string,
  avatarUrl : string | null,
  facultyId : number | null,
  departmentId : number | null,
  teams: TeamRef[],
  followerCount: number,
  isFollowing: boolean,
  /**
   * OD-46 — เจ้าของโปรไฟล์ปิดสถิติไว้ และคนที่ดูอยู่ไม่ใช่เจ้าตัว/แอดมิน
   * มีในหน้าโปรไฟล์ด้วยเพื่อให้ FE รู้ตั้งแต่ request แรกว่าจะซ่อนแท็บสถิติ/ประวัติแมตช์เลยดีไหม
   * ไม่ต้องยิงไปอีกสามเส้นแล้วค่อยพบว่าว่างทั้งหมด
   */
  statsHidden: boolean
}

export function toMeDto(row: UserRow , admin : AdminScopeRow | null = null): MeDto {
  return {
    adminScope : admin === null ? null
               : { id : admin.admin_scope_id , scopeType : admin.scope_type , facultyId : admin.faculty_id },
    id: row.user_id,
    fullName: row.full_name,
    email: row.email,
    gender: row.gender,
    birthDate: row.birth_date,
    userType: row.user_type,
    facultyId: row.faculty_id,
    departmentId: row.department_id,
    year: row.year,
    avatarUrl: toPublicImageUrl(row.profile_image_key),
    contactInfo: row.contact_info,
    address: row.address,
    totalPoints: row.total_points,
    notificationPrefs: row.notification_prefs,
    showProfileStats: row.show_profile_stats === 1,
    emailVerified: row.email_verified === 1,
    createdAt: row.created_at.toISOString()
  };
}

export function toUserRef(row: Pick<UserRow , 'user_id' | 'full_name' | 'profile_image_key'>): UserRefDto {
  return{
    id : row.user_id,
    fullName : row.full_name,
    avatarUrl : toPublicImageUrl(row.profile_image_key)
  };
}


/**
 * 🆕 BE-19 / FE-11 (7 ต.ค. 2569 · มติ ⑫ ก) — DTO ของ "ผลค้นหาผู้ใช้" เท่านั้น
 *
 * ★ ตั้งใจ**ไม่**เติมฟิลด์เข้า `UserRefDto` — ตัวนั้นถูกใช้ซ้ำทั่วระบบ (ผู้จัด · ผู้เชิญ ·
 *   ผู้ส่งผล · ผู้ยื่นคำขอ ฯลฯ) ถ้าเติมที่นั่น คณะและชั้นปีจะไปโผล่ใน response อีกหลายสิบที่
 *   ที่ไม่มีใครขอ และกลายเป็นการเปิดข้อมูลโดยไม่ได้ตั้งใจ
 * ★ `facultyName` ไม่ใช่ `facultyId` — คนเลือกจากจอ ไม่ได้เลือกจากเลข และ FE จะได้
 *   ไม่ต้องยิง /faculties มาเทียบเองทุกครั้ง
 */
export type UserSearchDto = UserRefDto & {
  facultyName : string | null;
  year : number | null;
};

export function toUserSearchDto(row : UserSearchRow): UserSearchDto {
  return {
    ...toUserRef(row),
    facultyName : row.faculty_name,
    year : row.year
  };
}

export function toPublicUserDto(
  row: UserRow,
  team: TeamRef[],
  followerCount = 0,
  isFollowing = false,
  statsHidden = false
): PublicUserDto {
  return {
    id: row.user_id,
    fullName: row.full_name,
    avatarUrl: toPublicImageUrl(row.profile_image_key),
    facultyId: row.faculty_id,
    departmentId: row.department_id,
    teams: team,
    followerCount,
    isFollowing,
    statsHidden,
  };
}

export type getMyInvitationDto = {
  id : number,
  team : TeamRef,
  invitedBy : UserRefDto,
  expiresAt : string
};

export function toGetMyInvitation(rows : MyInvitationRow) : getMyInvitationDto{
  // OD-61 — ใช้ toTeamRef ไม่ประกอบเอง เพื่อให้ logoUrl มาจากที่เดียวกับที่อื่น
  const team:TeamRef = toTeamRef(rows);
  const user:UserRefDto = {id : rows.user_id , fullName : rows.full_name , avatarUrl : toPublicImageUrl(rows.profile_image_key),}

  return{
    id : rows.team_invitation_id,
    team : team,
    invitedBy : user,
    expiresAt : rows.expires_at.toISOString()
  }
}