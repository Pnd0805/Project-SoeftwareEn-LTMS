import { describe, it, expect } from 'vitest';
import { toMeDto, toUserRef, toPublicUserDto } from '../user.mapper.js';

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
      avatarUrl: 'avatar.png',
      contactInfo: '0812345678',
      address: '123 Main St',
      totalPoints: 150,
      notificationPrefs: { email: true, push: false },
      createdAt: '2023-09-01T12:00:00.000Z',
    });
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
      avatarUrl: 'avatar.png',
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
      avatarUrl: 'avatar.png',
      facultyId: 2,
      departmentId: 3,
      teams,
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
});
