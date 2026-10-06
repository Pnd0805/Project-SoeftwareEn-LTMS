import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ด่านของ C2 (ตั้ง/ถอนสิทธิ์แอดมิน + คิวคำร้องผู้ใช้) ที่เดิม **ไม่มีเทสไหนเอ่ยถึงเลย**
 * — จากการไล่ตรวจ 6 ต.ค. 2569 ว่า error code ตัวไหนใน production ไม่เคยถูกเทสเรียกให้เด้ง
 *
 * ★ ที่ต้องมีเทส ไม่ใช่เพราะกลัวคนลบด่านทิ้ง แต่เพราะ "ด่านมีอยู่" กับ "ด่านทำงาน" ไม่ใช่เรื่องเดียวกัน
 *   ถ้าลำดับการเช็คสลับ หรือมีใครเพิ่ม early return ข้างบน ด่านจะเงียบไปโดยไม่มีเทสไหนแดง
 *
 * ครอบ: ADMIN_SCOPE_ALREADY_EXISTS · ADMIN_SCOPE_NOT_FOUND · USER_REPORT_NOT_FOUND
 */

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(), notifyTeamMembers: vi.fn(),
  notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../upload.service.js', () => ({
  getPresignedDownloadUrl: vi.fn((key: string) => Promise.resolve(`https://s3/${key}?signed`)),
  presignAll: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../utils/imageUrl.js', () => ({
  toPublicImageUrl: (key: string | null) => (key === null ? null : `https://cdn.test/${key}`),
}));

vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
  suspendUser: vi.fn(() => Promise.resolve(1)),
  hasActivePublicTournamentAsOrganizer: vi.fn(() => Promise.resolve(false)),
  hasApprovedApplicationAsLeader: vi.fn(() => Promise.resolve(false)),
}));
vi.mock('../../repositories/adminScope.repo.js', () => ({
  findAdminByUserId: vi.fn(() => Promise.resolve(null)),
  findAdminScopeById: vi.fn(() => Promise.resolve(null)),
  createAdminScope: vi.fn(() => Promise.resolve(77)),
  deleteAdminScope: vi.fn(() => Promise.resolve(1)),
  countActiveUniversityWideAdmins: vi.fn(() => Promise.resolve(5)),
  countActiveFacultyAdmins: vi.fn(() => Promise.resolve(5)),
}));
vi.mock('../../repositories/faculty.repo.js', () => ({
  findFacultyById: vi.fn(() => Promise.resolve({ faculty_id: 2, name: 'วิศวกรรมศาสตร์' })),
}));
vi.mock('../../repositories/userReport.repo.js', () => ({
  findById: vi.fn(() => Promise.resolve(null)),
  updateStatus: vi.fn(() => Promise.resolve(1)),
}));
vi.mock('../../repositories/auditLog.repo.js', () => ({
  insertAuditLog: vi.fn(() => Promise.resolve(1)),
}));

import { grantScope, revokeScope, approveUserReport, rejectUserReport } from '../adminScope.service.js';
import * as UserRepo from '../../repositories/user.repo.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as UserReportRepo from '../../repositories/userReport.repo.js';
import * as AuditLogRepo from '../../repositories/auditLog.repo.js';
import type { AdminScopeRow } from '../../types/db.js';

const mockedUserRepo = vi.mocked(UserRepo);
const mockedAdminRepo = vi.mocked(AdminRepo);
const mockedReportRepo = vi.mocked(UserReportRepo);
const mockedAudit = vi.mocked(AuditLogRepo);

const admin = { admin_scope_id: 1, user_id: 1, scope_type: 'university_wide', faculty_id: null } as AdminScopeRow;

const target = {
  user_id: 9, full_name: 'ผู้ใช้ทดสอบ', email: 't@ku.th', password_hash: 'h',
  gender: 'male' as const, birth_date: '2000-01-01', user_type: 'student' as const,
  faculty_id: 2, department_id: 3, year: 2, profile_image_key: null,
  contact_info: null, address: null, is_suspended: 0, suspended_reason: null,
  suspended_until: null, suspended_category: null, total_points: 0, notification_prefs: null,
  show_profile_stats: 1, profile_edit_log: null, email_verified: 0,
  created_at: new Date('2026-10-01T00:00:00Z'), updated_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUserRepo.findById.mockResolvedValue(target);
  mockedAdminRepo.findAdminByUserId.mockResolvedValue(null);
  mockedAdminRepo.findAdminScopeById.mockResolvedValue(null);
  mockedAdminRepo.createAdminScope.mockResolvedValue(77);
  mockedAdminRepo.countActiveUniversityWideAdmins.mockResolvedValue(5);
  mockedReportRepo.findById.mockResolvedValue(null);
});

describe('grantScope — ADMIN_SCOPE_ALREADY_EXISTS', () => {
  /**
   * ★ ถ้าด่านนี้เงียบ จะได้แถว admin_scopes สองแถวของคนเดียว
   *   แล้ว findAdminByUserId (ที่ middleware ใช้หาสิทธิ์ตอนล็อกอิน) จะคืนแถวไหนก็ได้
   *   ⇒ สิทธิ์ของคนคนนั้นเปลี่ยนไปมาแบบที่อธิบายไม่ได้ · เป็นเหตุผลว่าทำไมต้อง "ถอนก่อนตั้งใหม่"
   */
  // ★ ใช้ university_wide แต่งตั้ง faculty — ตามกฎ assertCanGrant (uw ตั้งได้แค่ faculty · root ตั้งได้แค่ uw)
  //   ถ้าเลือกคู่ผิด จะได้ 403 INSUFFICIENT_ADMIN_SCOPE ก่อนถึงด่านที่เทสนี้ต้องการ
  it('ผู้ใช้มีสิทธิ์แอดมินอยู่แล้ว = 409 และไม่สร้างแถวใหม่', async () => {
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(
      { admin_scope_id: 5, user_id: 9, scope_type: 'faculty', faculty_id: 2 } as AdminScopeRow);

    await expect(grantScope(admin, 9, 'faculty', 2)).rejects.toMatchObject({
      status: 409, code: 'ADMIN_SCOPE_ALREADY_EXISTS',
    });
    expect(mockedAdminRepo.createAdminScope).not.toHaveBeenCalled();
    expect(mockedAudit.insertAuditLog).not.toHaveBeenCalled();
  });

  it('ยังไม่มีสิทธิ์เดิม = สร้างได้ และลง audit log', async () => {
    mockedAdminRepo.findAdminScopeById.mockResolvedValue(
      { admin_scope_id: 77, user_id: 9, scope_type: 'faculty', faculty_id: 2,
        created_at: new Date('2026-10-06T00:00:00Z') } as AdminScopeRow);

    await grantScope(admin, 9, 'faculty', 2);

    expect(mockedAdminRepo.createAdminScope).toHaveBeenCalledWith(9, 'faculty', 2, 1);
    expect(mockedAudit.insertAuditLog).toHaveBeenCalledWith(
      1, 'admin_scope_granted', 'admin_scope', 77, { targetUserId: 9, scopeType: 'faculty', facultyId: 2 });
  });
});

describe('revokeScope — ADMIN_SCOPE_NOT_FOUND', () => {
  it('ไม่พบสิทธิ์ที่จะถอน = 404 และไม่ลบอะไรเลย', async () => {
    mockedAdminRepo.findAdminScopeById.mockResolvedValue(null);

    await expect(revokeScope(admin, 404)).rejects.toMatchObject({
      status: 404, code: 'ADMIN_SCOPE_NOT_FOUND',
    });
    expect(mockedAdminRepo.deleteAdminScope).not.toHaveBeenCalled();
  });

  /**
   * ★ ต้องเช็ค "มีอยู่ไหม" ก่อนเช็คอย่างอื่น ไม่ใช่หลัง
   *   ของเดิมเช็คก่อนอยู่แล้ว เทสนี้ล็อกลำดับไว้ — ถ้าสลับไปอ่าน scope.scope_type ก่อน
   *   จะกลายเป็น TypeError 500 แทน 404 แล้ว FE แยกไม่ออกว่า "ไม่มี" กับ "พัง"
   */
  it('เช็คว่ามีอยู่ก่อน ไม่นับจำนวนแอดมินก่อน', async () => {
    mockedAdminRepo.findAdminScopeById.mockResolvedValue(null);

    await expect(revokeScope(admin, 404)).rejects.toMatchObject({ code: 'ADMIN_SCOPE_NOT_FOUND' });
    expect(mockedAdminRepo.countActiveUniversityWideAdmins).not.toHaveBeenCalled();
  });
});

describe('คิวคำร้องผู้ใช้ — USER_REPORT_NOT_FOUND', () => {
  it('อนุมัติคำร้องที่ไม่มีอยู่ = 404 และไม่ระงับใครเลย', async () => {
    mockedReportRepo.findById.mockResolvedValue(null);

    await expect(approveUserReport(admin, 999, 7, 'abusive_language')).rejects.toMatchObject({
      status: 404, code: 'USER_REPORT_NOT_FOUND',
    });
    // 🔴 ข้อสำคัญของเทสนี้: ต้องไม่มีการระงับเกิดขึ้นเลย
    expect(mockedUserRepo.suspendUser).not.toHaveBeenCalled();
    expect(mockedReportRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('ปฏิเสธคำร้องที่ไม่มีอยู่ = 404 และไม่เขียนสถานะ', async () => {
    mockedReportRepo.findById.mockResolvedValue(null);

    await expect(rejectUserReport(admin, 999, 'หลักฐานไม่พอ')).rejects.toMatchObject({
      status: 404, code: 'USER_REPORT_NOT_FOUND',
    });
    expect(mockedReportRepo.updateStatus).not.toHaveBeenCalled();
  });
});
