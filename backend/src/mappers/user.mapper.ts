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