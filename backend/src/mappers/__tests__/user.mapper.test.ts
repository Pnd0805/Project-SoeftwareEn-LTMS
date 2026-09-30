import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/imageUrl.js', () => ({
  toPublicImageUrl: (key: string | null) => (key === null ? null : `https://cdn.test/${key}`),
}));

import { toMeDto, toUserRef, toPublicUserDto, toGetMyInvitation, toAdminUserDto } from '../user.mapper.js';
import type { AdminUserRow } from '../../repositories/user.repo.js';

const baseUserRow = {
  user_id: 1,
  full_name: 'Test User',
  email: 'test@example.com',
  password_hash: 'hashed',
  gender: 'male' as const,
  birth_date: '2000-01-01',
  user_type: 'student' as const,
  faculty_id: 2,
  department_id: 3,
  year: 2,
  profile_image_key: 'avatar.png',
  contact_info: '0812345678',
  address: '123 Main St',
  is_suspended: 0,
  suspended_reason: null,
  suspended_until: null,
  suspended_category: null,
  total_points: 150,
  notification_prefs: { email: true, push: false },
  profile_edit_log: null,
  created_at: new Date('2023-09-01T12:00:00Z'),
  updated_at: null,
};

describe('toMeDto', () => {
  it('maps every field of a full user row, including nested notification prefs', () => {
    const result = toMeDto(baseUserRow as any);

    expect(result).toEqual({
      id: 1,
      fullName: 'Test User',
      email: 'test@example.com',
      gender: 'male',
      birthDate: '2000-01-01',
      userType: 'student',
      facultyId: 2,
      departmentId: 3,
      year: 2,
      avatarUrl: 'https://cdn.test/avatar.png',
      contactInfo: '0812345678',
      address: '123 Main St',
      totalPoints: 150,
      notificationPrefs: { email: true, push: false },
      createdAt: '2023-09-01T12:00:00.000Z',
      adminScope: null,
    });
  });

  /**
   * FE-viewer-admin-scope-unknown — /me ต้องบอกสิทธิ์แอดมินของตัวผู้เรียกเอง
   * `facultyId` ข้างบนคือคณะที่ **สังกัด** ไม่ใช่ขอบเขตที่ดูแล — ฟอร์มสร้างทัวร์ใช้แทนกันไม่ได้
   */
  it('คนทั่วไปได้ adminScope เป็น null ไม่ใช่ไม่มีคีย์ — FE จะได้ไม่ต้องเช็ค undefined', () => {
    expect(toMeDto(baseUserRow as any)).toHaveProperty('adminScope', null);
  });

  it('แอดมินคณะได้ scope ของตัวเอง ไม่ใช่คณะที่สังกัด', () => {
    const admin = { admin_scope_id: 7, user_id: 1, scope_type: 'faculty' as const,
                    faculty_id: 9, created_at: new Date(), created_by: null };

    const out = toMeDto({ ...baseUserRow, faculty_id: 2 } as any, admin);

    expect(out.adminScope).toEqual({ id: 7, scopeType: 'faculty', facultyId: 9 });
    expect(out.facultyId).toBe(2);   // คนละค่า คนละความหมาย
  });

  it('university_wide และ root ได้ facultyId เป็น null', () => {
    for (const scope_type of ['university_wide', 'root'] as const) {
      const admin = { admin_scope_id: 1, user_id: 1, scope_type,
                      faculty_id: null, created_at: new Date(), created_by: null };
      expect(toMeDto(baseUserRow as any, admin).adminScope).toEqual({ id: 1, scopeType: scope_type, facultyId: null });
    }
  });

  it('passes through null values for optional fields rather than defaulting them', () => {
    const rowWithNulls = {
      ...baseUserRow,
      faculty_id: null,
      department_id: null,
      year: null,
      profile_image_key: null,
      contact_info: null,
      address: null,
      notification_prefs: null,
    };

    const result = toMeDto(rowWithNulls as any);

    expect(result.facultyId).toBeNull();
    expect(result.departmentId).toBeNull();
    expect(result.year).toBeNull();
    expect(result.avatarUrl).toBeNull();
    expect(result.contactInfo).toBeNull();
    expect(result.address).toBeNull();
    expect(result.notificationPrefs).toBeNull();
  });
});

describe('toUserRef', () => {
  it('maps only user_id, full_name, and profile_image_key', () => {
    const row = { user_id: 1, full_name: 'Test User', profile_image_key: 'avatar.png' };
    expect(toUserRef(row as any)).toEqual({
      id: 1,
      fullName: 'Test User',
      avatarUrl: 'https://cdn.test/avatar.png',
    });
  });

  it('maps a null avatar through as null rather than a placeholder string', () => {
    const row = { user_id: 1, full_name: 'Test User', profile_image_key: null };
    expect(toUserRef(row as any).avatarUrl).toBeNull();
  });
});

describe('toPublicUserDto', () => {
  it('maps the public-facing subset of user fields plus the provided team refs', () => {
    const teams = [{ id: 10, name: 'Dream Team', sportTypeId: 1 }];
    const result = toPublicUserDto(baseUserRow as any, teams as any);

    expect(result).toEqual({
      id: 1,
      fullName: 'Test User',
      avatarUrl: 'https://cdn.test/avatar.png',
      facultyId: 2,
      departmentId: 3,
      teams,
      followerCount: 0,
      isFollowing: false,
    });
  });

  it('does not leak private fields like email, contactInfo, or address', () => {
    const result = toPublicUserDto(baseUserRow as any, []);
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('contactInfo');
    expect(result).not.toHaveProperty('address');
  });

  it('passes an empty teams array through unchanged', () => {
    const result = toPublicUserDto(baseUserRow as any, []);
    expect(result.teams).toEqual([]);
  });

  it('includes followerCount and isFollowing when supplied', () => {
    const result = toPublicUserDto(baseUserRow as any, [], 12, true);
    expect(result).toMatchObject({ followerCount: 12, isFollowing: true });
  });
});

describe('toGetMyInvitation', () => {
  it('maps the invitation row into nested team and invitedBy refs, with ISO expiresAt', () => {
    const row = {
      team_invitation_id: 1,
      team_id: 10,
      name: 'Dream Team',
      sport_type_id: 1,
      user_id: 9,
      full_name: 'Inviter Name',
      profile_image_key: 'avatar.png',
      expires_at: new Date('2024-03-01T00:00:00Z'),
    };

    expect(toGetMyInvitation(row as any)).toEqual({
      id: 1,
      team: { id: 10, name: 'Dream Team', sportTypeId: 1 },
      invitedBy: { id: 9, fullName: 'Inviter Name', avatarUrl: 'https://cdn.test/avatar.png' },
      expiresAt: '2024-03-01T00:00:00.000Z',
    });
  });

  it('maps a null inviter avatar through as null', () => {
    const row = {
      team_invitation_id: 1,
      team_id: 10,
      name: 'Dream Team',
      sport_type_id: 1,
      user_id: 9,
      full_name: 'Inviter Name',
      profile_image_key: null,
      expires_at: new Date('2024-03-01T00:00:00Z'),
    };

    expect(toGetMyInvitation(row as any).invitedBy.avatarUrl).toBeNull();
  });
});

// ============ AdminUserDto — สถานะระงับที่คิดเวลาแล้ว (migration 033) ============
describe('toAdminUserDto', () => {
  function adminRow(overrides : Partial<AdminUserRow> = {}) : AdminUserRow{
    return {
      user_id : 1, full_name : 'Test User', email : 'test@example.com',
      user_type : 'student', faculty_id : 2,
      is_suspended : 0, suspended_reason : null, suspended_until : null, suspended_category : null,
      admin_scope_id : null, admin_scope_type : null, admin_scope_faculty_id : null,
      ...overrides,
    };
  }

  it('ไม่ถูกระงับ: isSuspended false และไม่มีกำหนดพ้น', () => {
    expect(toAdminUserDto(adminRow())).toMatchObject({ isSuspended : false, suspendedUntil : null });
  });

  // migration 034 — เหตุผลที่แอดมินพิมพ์กับประเภทที่เจ้าตัวเห็นเป็นคนละช่อง และต้องคืนมาทั้งคู่ในคิวของแอดมิน
  it('คืนประเภทพร้อมถ้อยคำไทย ไม่ให้ FE ต้อง map เอง', () => {
    const dto = toAdminUserDto(adminRow({ is_suspended : 1 , suspended_reason : 'ด่าในคอมเมนต์แมตช์ 88' ,
                                           suspended_category : 'abusive_language' }));
    expect(dto.suspendedCategory).toBe('abusive_language');
    expect(dto.suspendedCategoryLabel).toBe('ใช้ถ้อยคำไม่เหมาะสมหรือคุกคามผู้อื่น');
    expect(dto.suspendedReason).toBe('ด่าในคอมเมนต์แมตช์ 88');   // บันทึกภายใน — แอดมินเห็นได้ แต่เจ้าตัวไม่ได้เห็นทางนี้
  });

  it('แถวเก่าที่ระงับก่อนมีชุดประเภท: ทั้งสองช่องเป็น null', () => {
    const dto = toAdminUserDto(adminRow({ is_suspended : 1 , suspended_reason : 'ก่อกวน' }));
    expect(dto.suspendedCategory).toBeNull();
    expect(dto.suspendedCategoryLabel).toBeNull();
  });

  it('ระงับถาวร: isSuspended true แต่ suspendedUntil เป็น null — null แปลว่าถาวร ไม่ใช่ไม่มีข้อมูล', () => {
    const dto = toAdminUserDto(adminRow({ is_suspended : 1, suspended_reason : 'ก่อกวน' }));
    expect(dto).toMatchObject({ isSuspended : true, suspendedReason : 'ก่อกวน', suspendedUntil : null });
  });

  it('ระงับแบบมีกำหนดที่ยังไม่ถึงเวลา: ยังถูกระงับ และคืนกำหนดพ้นเป็น ISO', () => {
    const until = new Date('2026-12-01T00:00:00Z');
    const dto = toAdminUserDto(adminRow({ is_suspended : 1, suspended_until : until }));
    expect(dto).toMatchObject({ isSuspended : true, suspendedUntil : '2026-12-01T00:00:00.000Z' });
  });

  /**
   * ลิสต์ของแอดมินอ่านจากคอลัมน์ดิบไม่ได้ เพราะไม่มี cron มาล้างธงหลังหมดกำหนด
   * ถ้าตรงนี้ตอบ true แอดมินจะเห็นคนที่พ้นโทษแล้วเป็น "ถูกระงับ" และกดปลดซ้ำโดยไม่จำเป็น
   */
  it('ระงับแบบมีกำหนดที่เลยเวลาแล้ว: isSuspended false ทั้งที่ธงในฐานยังเป็น 1', () => {
    const dto = toAdminUserDto(adminRow({ is_suspended : 1, suspended_until : new Date(Date.now() - 1000) }));
    expect(dto.isSuspended).toBe(false);
    expect(dto.suspendedUntil).not.toBeNull();   // ยังคืนเวลาไว้ เพื่อให้จอบอกได้ว่า "เพิ่งพ้นเมื่อ..."
  });
});
