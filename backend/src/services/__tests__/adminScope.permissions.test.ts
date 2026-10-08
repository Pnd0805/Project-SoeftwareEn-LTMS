import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ตารางสิทธิ์ของ C2 — มติ 22 ก.ย. 2569 (3 ชั้น) ที่ "มองไม่เห็นจากการอ่านโค้ดครั้งเดียว"
 * (TASK-vimsd-outstanding.md B2) ไฟล์นี้คุมเฉพาะ "ใครทำอะไรกับใครได้" ไม่คุมทุก branch ของแต่ละฟังก์ชัน —
 * รายละเอียดของ suspend (days/category) อยู่ใน adminScope.suspend.test.ts แยกต่างหากแล้ว
 */

vi.mock('../upload.service.js', () => ({
  getPresignedDownloadUrl: vi.fn((key: string) => Promise.resolve(`https://s3/${key}?signed`)),
}));
vi.mock('../../utils/imageUrl.js', () => ({
  toPublicImageUrl: (key: string | null) => (key === null ? null : `https://cdn.test/${key}`),
}));
vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
  suspendUser: vi.fn(() => Promise.resolve(1)),
  hasActivePublicTournamentAsOrganizer: vi.fn(() => Promise.resolve(false)),
  hasApprovedApplicationAsLeader: vi.fn(() => Promise.resolve(false)),
  searchUsersAdmin: vi.fn(() => Promise.resolve({ rows: [], totalItems: 0 })),
}));
vi.mock('../../repositories/adminScope.repo.js', () => ({
  findAdminByUserId: vi.fn(() => Promise.resolve(null)),
  countActiveUniversityWideAdmins: vi.fn(() => Promise.resolve(5)),
  countActiveFacultyAdmins: vi.fn(() => Promise.resolve(5)),
  findAllAdminScopes: vi.fn(() => Promise.resolve({ rows: [], totalItems: 0 })),
  createAdminScope: vi.fn(() => Promise.resolve(99)),
  findAdminScopeById: vi.fn(),
  deleteAdminScope: vi.fn(() => Promise.resolve(1)),
}));
vi.mock('../../repositories/auditLog.repo.js', () => ({
  insertAuditLog: vi.fn(() => Promise.resolve(1)),
  findAuditLogs: vi.fn(() => Promise.resolve({ rows: [], totalItems: 0 })),
}));
vi.mock('../../repositories/faculty.repo.js', () => ({
  findFacultyById: vi.fn(() => Promise.resolve({ faculty_id: 3, name: 'วิศวกรรมศาสตร์' })),
}));
vi.mock('../../repositories/userReport.repo.js', () => ({
  findAllUserReports: vi.fn(() => Promise.resolve({ rows: [], totalItems: 0 })),
  findById: vi.fn(),
  updateStatus: vi.fn(() => Promise.resolve(1)),
}));

import {
  listUsers, suspendUser, listScopes, grantScope, revokeScope,
  listAuditLogs, listUserReports, approveUserReport, rejectUserReport,
} from '../adminScope.service.js';
import * as UserRepo from '../../repositories/user.repo.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as UserReportRepo from '../../repositories/userReport.repo.js';
import type { AdminScopeRow, UserRow, UserReportRow } from '../../types/db.js';

const mockedUserRepo = vi.mocked(UserRepo);
const mockedAdminRepo = vi.mocked(AdminRepo);
const mockedUserReportRepo = vi.mocked(UserReportRepo);

const NOW = new Date('2026-10-01T12:00:00Z');

const adminOf = (scope_type: AdminScopeRow['scope_type'], faculty_id: number | null = null): AdminScopeRow =>
  ({ admin_scope_id: 1, user_id: 1, scope_type, faculty_id: scope_type === 'faculty' ? (faculty_id ?? 3) : null,
     created_at: NOW, created_by: null });

const userOf = (overrides: Partial<UserRow> = {}): UserRow => ({
  user_id: 9, full_name: 'ผู้ใช้ทดสอบ', email: 't@ku.th', password_hash: 'h',
  gender: 'male', birth_date: '2000-01-01', user_type: 'student',
  faculty_id: 3, department_id: 1, year: 2, profile_image_key: null,
  contact_info: null, address: null, is_suspended: 0, suspended_reason: null,
  suspended_until: null, suspended_category: null,
  total_points: 0, notification_prefs: null, show_profile_stats: 1, profile_edit_log: null, email_verified: 0, token_version: 0,
  created_at: NOW, updated_at: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedUserRepo.findById.mockResolvedValue(userOf());
  mockedUserRepo.suspendUser.mockResolvedValue(1);
  mockedUserRepo.hasActivePublicTournamentAsOrganizer.mockResolvedValue(false);
  mockedUserRepo.hasApprovedApplicationAsLeader.mockResolvedValue(false);
  mockedUserRepo.searchUsersAdmin.mockResolvedValue({ rows: [], totalItems: 0 });
  mockedAdminRepo.findAdminByUserId.mockResolvedValue(null);
  mockedAdminRepo.countActiveUniversityWideAdmins.mockResolvedValue(5);
  mockedAdminRepo.countActiveFacultyAdmins.mockResolvedValue(5);
});

// ============================= grantScope =============================

describe('grantScope — ลำดับชั้นแต่งตั้ง: แต่ละชั้นแต่งตั้งได้แค่ชั้นถัดลงมา ไม่ข้ามชั้น ไม่ชั้นเดียวกัน', () => {
  it('root → university_wide ผ่าน', async () => {
    mockedAdminRepo.findAdminScopeById.mockResolvedValue(
      { admin_scope_id: 99, user_id: 9, scope_type: 'university_wide', faculty_id: null, created_at: NOW, created_by: 1 });

    await expect(grantScope(adminOf('root'), 9, 'university_wide', undefined)).resolves.toMatchObject({ scopeType: 'university_wide' });
  });

  it('root → faculty ถูกปฏิเสธ — Root แตะชั้น faculty ตรงๆ ไม่ได้ (ต้องผ่าน university_wide เท่านั้น)', async () => {
    await expect(grantScope(adminOf('root'), 9, 'faculty', 3)).rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
    expect(mockedAdminRepo.createAdminScope).not.toHaveBeenCalled();
  });

  it('university_wide → faculty ผ่าน', async () => {
    mockedAdminRepo.findAdminScopeById.mockResolvedValue(
      { admin_scope_id: 99, user_id: 9, scope_type: 'faculty', faculty_id: 3, created_at: NOW, created_by: 1 });

    await expect(grantScope(adminOf('university_wide'), 9, 'faculty', 3)).resolves.toMatchObject({ scopeType: 'faculty' });
  });

  it('university_wide → university_wide ถูกปฏิเสธ — แต่งตั้งคนชั้นเดียวกับตัวเองไม่ได้ (เหตุผลหลักของดีไซน์ 3 ชั้น)', async () => {
    await expect(grantScope(adminOf('university_wide'), 9, 'university_wide', undefined))
      .rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
    expect(mockedAdminRepo.createAdminScope).not.toHaveBeenCalled();
  });

  it('faculty → แต่งตั้งใครไม่ได้เลย แม้จะเป็นระดับ faculty เหมือนกัน', async () => {
    await expect(grantScope(adminOf('faculty'), 9, 'faculty', 3)).rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
    expect(mockedAdminRepo.createAdminScope).not.toHaveBeenCalled();
  });
});

// ============================= revokeScope =============================

describe('revokeScope — กลับทิศของ grantScope บวกเงื่อนไขพิเศษ', () => {
  it('root ถอนไม่ได้เด็ดขาด ไม่ว่าใครเป็นคนขอ (ต้องมี root เหลืออย่างน้อย 1 คนเสมอ)', async () => {
    mockedAdminRepo.findAdminScopeById.mockResolvedValue(
      { admin_scope_id: 2, user_id: 5, scope_type: 'root', faculty_id: null, created_at: NOW, created_by: null });

    await expect(revokeScope(adminOf('root'), 2)).rejects.toMatchObject({ status: 403, code: 'CANNOT_REVOKE_ROOT_SCOPE' });
    await expect(revokeScope(adminOf('university_wide'), 2)).rejects.toMatchObject({ status: 403, code: 'CANNOT_REVOKE_ROOT_SCOPE' });
    expect(mockedAdminRepo.deleteAdminScope).not.toHaveBeenCalled();
  });

  it('ถอนสิทธิ์ของตัวเองไม่ได้', async () => {
    const admin = adminOf('university_wide');
    mockedAdminRepo.findAdminScopeById.mockResolvedValue(
      { admin_scope_id: 1, user_id: admin.user_id, scope_type: 'university_wide', faculty_id: null, created_at: NOW, created_by: null });

    await expect(revokeScope(admin, 1)).rejects.toMatchObject({ status: 403, code: 'CANNOT_REVOKE_OWN_SCOPE' });
    expect(mockedAdminRepo.deleteAdminScope).not.toHaveBeenCalled();
  });

  it('university_wide คนสุดท้ายถอนไม่ได้ — 409 ไม่ใช่ 403 (เป็นเรื่องสถานะ ไม่ใช่สิทธิ์)', async () => {
    mockedAdminRepo.findAdminScopeById.mockResolvedValue(
      { admin_scope_id: 2, user_id: 5, scope_type: 'university_wide', faculty_id: null, created_at: NOW, created_by: null });
    mockedAdminRepo.countActiveUniversityWideAdmins.mockResolvedValue(1);

    await expect(revokeScope(adminOf('root'), 2)).rejects.toMatchObject({ status: 409, code: 'LAST_UNIVERSITY_ADMIN' });
    expect(mockedAdminRepo.deleteAdminScope).not.toHaveBeenCalled();
  });

  it('faculty ถอนใครไม่ได้เลย', async () => {
    mockedAdminRepo.findAdminScopeById.mockResolvedValue(
      { admin_scope_id: 2, user_id: 5, scope_type: 'faculty', faculty_id: 3, created_at: NOW, created_by: null });

    await expect(revokeScope(adminOf('faculty'), 2)).rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
  });
});

// ============================= root ถูกกันออกจากงานประจำวันทุกจุด =============================

describe('root ไม่ทำงานประจำวัน — 403 ROOT_NO_DAILY_OPERATIONS ทุกจุดที่ไม่ใช่แต่งตั้ง/ถอน/อ่าน', () => {
  it('listUsers', async () => {
    await expect(listUsers(adminOf('root'), {}, 0, 1, 20)).rejects.toMatchObject({ status: 403, code: 'ROOT_NO_DAILY_OPERATIONS' });
  });

  it('suspendUser', async () => {
    await expect(suspendUser(adminOf('root'), 9, true, 'เหตุผล', undefined, 'other'))
      .rejects.toMatchObject({ status: 403, code: 'ROOT_NO_DAILY_OPERATIONS' });
  });

  it('listUserReports', async () => {
    await expect(listUserReports(adminOf('root'), 0, 1, 20)).rejects.toMatchObject({ status: 403, code: 'ROOT_NO_DAILY_OPERATIONS' });
  });

  it('approveUserReport / rejectUserReport', async () => {
    await expect(approveUserReport(adminOf('root'), 1, undefined, 'other')).rejects.toMatchObject({ status: 403, code: 'ROOT_NO_DAILY_OPERATIONS' });
    await expect(rejectUserReport(adminOf('root'), 1, 'เหตุผล')).rejects.toMatchObject({ status: 403, code: 'ROOT_NO_DAILY_OPERATIONS' });
    // ต้องชนด่าน root ก่อนแม้แต่จะไปเปิดคำร้องดู — ไม่เรียก repo เลย
    expect(mockedUserReportRepo.findById).not.toHaveBeenCalled();
  });

  it('แต่ listScopes / listAuditLogs ไม่กัน root — เป็นงานของ root โดยตรง (ดู/แต่งตั้งเท่านั้น)', async () => {
    await expect(listScopes(adminOf('root'), {}, 0, 1, 20)).resolves.toBeDefined();
    await expect(listAuditLogs(adminOf('root'), {}, 0, 1, 20)).resolves.toBeDefined();
  });
});

// ============================= suspendUser / assertCanActOnUser =============================

describe('suspendUser — แตะใครได้บ้าง', () => {
  it('ระงับตัวเองไม่ได้', async () => {
    const admin = adminOf('university_wide');
    mockedUserRepo.findById.mockResolvedValue(userOf({ user_id: admin.user_id }));

    await expect(suspendUser(admin, admin.user_id, true, 'เหตุผล', undefined, 'other'))
      .rejects.toMatchObject({ status: 403, code: 'CANNOT_SUSPEND_SELF' });
  });

  it('แอดมินคณะระงับแอดมินคนอื่นไม่ได้ แม้จะคณะเดียวกัน', async () => {
    const admin = adminOf('faculty', 3);
    mockedUserRepo.findById.mockResolvedValue(userOf({ user_id: 9, faculty_id: 3 }));
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(
      { admin_scope_id: 7, user_id: 9, scope_type: 'faculty', faculty_id: 3, created_at: NOW, created_by: null });

    await expect(suspendUser(admin, 9, true, 'เหตุผล', undefined, 'other'))
      .rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
  });

  it('แอดมินคณะระงับคนนอกคณะตัวเองไม่ได้', async () => {
    const admin = adminOf('faculty', 3);
    mockedUserRepo.findById.mockResolvedValue(userOf({ user_id: 9, faculty_id: 7 }));

    await expect(suspendUser(admin, 9, true, 'เหตุผล', undefined, 'other'))
      .rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
  });

  it('แอดมินคณะระงับคนธรรมดาในคณะตัวเองได้ตามปกติ', async () => {
    const admin = adminOf('faculty', 3);
    mockedUserRepo.findById.mockResolvedValue(userOf({ user_id: 9, faculty_id: 3 }));

    await expect(suspendUser(admin, 9, true, 'เหตุผล', undefined, 'other')).resolves.toBeDefined();
  });

  it('university_wide ระงับแอดมินคณะได้ (ชั้นบนแตะชั้นล่างได้เสมอ)', async () => {
    const admin = adminOf('university_wide');
    mockedUserRepo.findById.mockResolvedValue(userOf({ user_id: 9, faculty_id: 3 }));
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(
      { admin_scope_id: 7, user_id: 9, scope_type: 'faculty', faculty_id: 3, created_at: NOW, created_by: null });

    await expect(suspendUser(admin, 9, true, 'เหตุผล', undefined, 'other')).resolves.toBeDefined();
  });
});

// ============================= listUsers — faculty ถูก scope บังคับ =============================

describe('listUsers — แอดมินคณะถูกบังคับ facultyId เป็นของตัวเองเสมอ', () => {
  it('ไม่ว่าจะส่ง facultyId อะไรมา (หรือไม่ส่งเลย) ระบบใส่ facultyId ของตัวเองทับให้เสมอ', async () => {
    const admin = adminOf('faculty', 3);

    await listUsers(admin, { facultyId: 999 }, 0, 1, 20);
    expect(mockedUserRepo.searchUsersAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ facultyId: 3 }), 0, 20);

    mockedUserRepo.searchUsersAdmin.mockClear();
    await listUsers(admin, {}, 0, 1, 20);
    expect(mockedUserRepo.searchUsersAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ facultyId: 3 }), 0, 20);
  });

  it('university_wide ไม่ถูกบังคับ facultyId — เห็นได้ตามที่ขอ (หรือไม่กรองเลย)', async () => {
    await listUsers(adminOf('university_wide'), {}, 0, 1, 20);
    expect(mockedUserRepo.searchUsersAdmin).toHaveBeenCalledWith(
      expect.not.objectContaining({ facultyId: expect.anything() }), 0, 20);
  });
});

// ============================= approveUserReport — ห้ามตัดสินเรื่องของตัวเอง =============================

describe('approveUserReport / rejectUserReport — แอดมินที่ถูกแจ้งตัดสินคำร้องเรื่องตัวเองไม่ได้', () => {
  const reportOf = (overrides: Partial<UserReportRow> = {}): UserReportRow => ({
    user_report_id: 1, reported_by: 9, target_user_id: 1, reason: 'ใช้คำหยาบ', evidence: null,
    user_report_status: 'pending', reviewed_by: null, reviewed_at: null, rejection_reason: null,
    created_at: NOW,
    ...overrides,
  });

  it('approve: เป้าหมายของคำร้องคือตัวผู้อนุมัติเอง → 403 CANNOT_REVIEW_OWN_REPORT', async () => {
    const admin = adminOf('university_wide');
    mockedUserReportRepo.findById.mockResolvedValue(reportOf({ target_user_id: admin.user_id }));

    await expect(approveUserReport(admin, 1, undefined, 'other')).rejects.toMatchObject({ status: 403, code: 'CANNOT_REVIEW_OWN_REPORT' });
    expect(mockedUserReportRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('reject: เป้าหมายของคำร้องคือตัวผู้ปฏิเสธเอง → 403 CANNOT_REVIEW_OWN_REPORT', async () => {
    const admin = adminOf('university_wide');
    mockedUserReportRepo.findById.mockResolvedValue(reportOf({ target_user_id: admin.user_id }));

    await expect(rejectUserReport(admin, 1, 'เหตุผล')).rejects.toMatchObject({ status: 403, code: 'CANNOT_REVIEW_OWN_REPORT' });
    expect(mockedUserReportRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('approve: คำร้องที่ถูกพิจารณาไปแล้ว → 409 ไม่ว่าจะเป็นใครพิจารณาก็ตาม', async () => {
    mockedUserReportRepo.findById.mockResolvedValue(reportOf({ user_report_status: 'approved' }));

    await expect(approveUserReport(adminOf('university_wide'), 1, undefined, 'other')).rejects.toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
  });

  it('approve: target เป็นแอดมินคณะ + ผู้อนุมัติเป็นแอดมินคณะ (คนละคน) → ยังโดน INSUFFICIENT_ADMIN_SCOPE เหมือน suspendUser ตรงๆ', async () => {
    const admin = adminOf('faculty', 3);
    mockedUserReportRepo.findById.mockResolvedValue(reportOf({ target_user_id: 9 }));
    mockedUserRepo.findById.mockResolvedValue(userOf({ user_id: 9, faculty_id: 3 }));
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(
      { admin_scope_id: 7, user_id: 9, scope_type: 'faculty', faculty_id: 3, created_at: NOW, created_by: null });

    await expect(approveUserReport(admin, 1, undefined, 'other')).rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
  });
});
