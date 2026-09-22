import type { MyInvitationRow, AdminUserRow } from '../repositories/user.repo.js';
import type { UserRow } from '../types/db.js';
import type { TeamRef } from './team.mapper.js';

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
  createdAt : string
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
    isSuspended : row.is_suspended === 1,
    suspendedReason : row.suspended_reason,
    adminScope : adminScope
  };
}

export type PublicUserDto = {
  id : number,
  fullName : string,
  avatarUrl : string | null,
  facultyId : number | null,
  departmentId : number | null,
  teams: TeamRef[]
}

export function toMeDto(row: UserRow): MeDto {
  return {
    id: row.user_id,
    fullName: row.full_name,
    email: row.email,
    gender: row.gender,
    birthDate: row.birth_date,
    userType: row.user_type,
    facultyId: row.faculty_id,
    departmentId: row.department_id,
    year: row.year,
    avatarUrl: row.profile_image_key,
    contactInfo: row.contact_info,
    address: row.address,
    totalPoints: row.total_points,
    notificationPrefs: row.notification_prefs,
    createdAt: row.created_at.toISOString()
  };
}

export function toUserRef(row: Pick<UserRow , 'user_id' | 'full_name' | 'profile_image_key'>): UserRefDto {
  return{
    id : row.user_id,
    fullName : row.full_name,
    avatarUrl : row.profile_image_key
  };
}


export function toPublicUserDto(row :UserRow , team: TeamRef[]) : PublicUserDto{
  return {
    id : row.user_id,
    fullName : row.full_name,
    avatarUrl : row.profile_image_key,
    facultyId : row.faculty_id,
    departmentId : row.department_id,
    teams : team
  }
}

export type getMyInvitationDto = {
  id : number,
  team : TeamRef,
  invitedBy : UserRefDto,
  expiresAt : string
};

export function toGetMyInvitation(rows : MyInvitationRow) : getMyInvitationDto{
  const team:TeamRef = {id : rows.team_id , name : rows.name , sportTypeId : rows.sport_type_id};
  const user:UserRefDto = {id : rows.user_id , fullName : rows.full_name , avatarUrl : rows.profile_image_key,}

  return{
    id : rows.team_invitation_id,
    team : team,
    invitedBy : user,
    expiresAt : rows.expires_at.toISOString()
  }
}