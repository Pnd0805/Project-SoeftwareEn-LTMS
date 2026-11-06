import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * adminScope.service — paths the other adminScope.*.test.ts files don't reach:
 *   transfer-request queue (list / reject) · grant validation · revoke success path and user_type reset ·
 *   audit-log scope · user-report approve/reject success · listUsers/listScopes faculty pinning ·
 *   the "faculty has no admins left" warning after suspending a faculty admin
 */

vi.mock('../upload.service.js', async (orig) => ({
  isTeamOfficialDocumentKey: (await orig<typeof import('../upload.service.js')>()).isTeamOfficialDocumentKey,
  getPresignedDownloadUrl: vi.fn((key: string) => Promise.resolve(`https://s3/${key}?signed`)),
  presignAll: vi.fn((keys: string[] | null) => Promise.resolve((keys ?? []).map(k => `https://s3/${k}?signed`))),
}));
vi.mock('../../utils/imageUrl.js', () => ({
  toPublicImageUrl: (key: string | null) => (key === null ? null : `https://cdn.test/${key}`),
}));
vi.mock('../../utils/checkExist.js', () => ({ checkUser: vi.fn(), checkTeam: vi.fn() }));
vi.mock('../../repositories/adminScope.repo.js', () => ({
  findAllOfficialRequests: vi.fn(),
  findAllTransferRequests: vi.fn(),
  approveTransferRequest: vi.fn(() => Promise.resolve()),
  transferLeaderByAdmin: vi.fn(() => Promise.resolve()),
  rejectTeamOfficial: vi.fn(() => Promise.resolve()),
  findAdminByUserId: vi.fn(() => Promise.resolve(null)),
  findAdminScopeById: vi.fn(() => Promise.resolve(null)),
  findAllAdminScopes: vi.fn(() => Promise.resolve({ rows: [], totalItems: 0 })),
  createAdminScope: vi.fn(() => Promise.resolve(77)),
  deleteAdminScope: vi.fn(() => Promise.resolve(1)),
  countActiveUniversityWideAdmins: vi.fn(() => Promise.resolve(5)),
  countActiveFacultyAdmins: vi.fn(() => Promise.resolve(5)),
}));
vi.mock('../../repositories/team.repo.js', () => ({ findTransferRequestById: vi.fn(), isMemberOf: vi.fn() }));
vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
  searchUsersAdmin: vi.fn(() => Promise.resolve({ rows: [], totalItems: 0 })),
  suspendUser: vi.fn(() => Promise.resolve(1)),
  updateUserType: vi.fn(() => Promise.resolve()),
  hasActivePublicTournamentAsOrganizer: vi.fn(() => Promise.resolve(false)),
  hasApprovedApplicationAsLeader: vi.fn(() => Promise.resolve(false)),
}));
vi.mock('../../repositories/auditLog.repo.js', () => ({
  insertAuditLog: vi.fn(() => Promise.resolve(1)),
  findAuditLogs: vi.fn(() => Promise.resolve({ rows: [], totalItems: 0 })),
}));
vi.mock('../../repositories/faculty.repo.js', () => ({
  findFacultyById: vi.fn(() => Promise.resolve({ faculty_id: 2, name: 'วิศวกรรมศาสตร์' })),
}));
vi.mock('../../repositories/userReport.repo.js', () => ({
  findById: vi.fn(() => Promise.resolve(null)),
  findAllUserReports: vi.fn(() => Promise.resolve({ rows: [], totalItems: 0 })),
  updateStatus: vi.fn(() => Promise.resolve(1)),
}));

import * as Service from '../adminScope.service.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as UserRepo from '../../repositories/user.repo.js';
import * as AuditLogRepo from '../../repositories/auditLog.repo.js';
import * as FacultyRepo from '../../repositories/faculty.repo.js';
import * as UserReportRepo from '../../repositories/userReport.repo.js';
import { getPresignedDownloadUrl } from '../upload.service.js';
import { checkUser, checkTeam } from '../../utils/checkExist.js';
import type { AdminScopeRow, UserReportRow } from '../../types/db.js';

const admin = (o: Partial<AdminScopeRow> = {}) =>
  ({ admin_scope_id: 1, user_id: 1, scope_type: 'university_wide', faculty_id: null, ...o }) as AdminScopeRow;
const uniAdmin = admin();
const rootAdmin = admin({ scope_type: 'root' });
const facultyAdmin = admin({ admin_scope_id: 2, user_id: 2, scope_type: 'faculty', faculty_id: 2 });

const user = (o: Record<string, unknown> = {}) => ({
  user_id: 9, full_name: 'ผู้ใช้ทดสอบ', email: 't@ku.th', user_type: 'student', faculty_id: 2,
  profile_image_key: null, is_suspended: 0, suspended_reason: null, suspended_until: null,
  suspended_category: null, ...o,
}) as never;

const scopeRow = (o: Record<string, unknown> = {}) => ({
  admin_scope_id: 40, user_id: 9, scope_type: 'faculty', faculty_id: 2,
  created_at: new Date('2026-10-01T00:00:00Z'), ...o,
}) as never;

const report = (o: Partial<UserReportRow> = {}): UserReportRow => ({
  user_report_id: 5, reported_by: 3, target_user_id: 9, reason: 'สแปมในคอมเมนต์', evidence: null,
  user_report_status: 'pending', reviewed_by: null, reviewed_at: null, rejection_reason: null,
  created_at: new Date('2026-10-01T00:00:00Z'), ...o,
});

async function rejected(p: Promise<unknown>) {
  return p.then(() => { throw new Error('expected rejection'); }, (e) => e);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkUser).mockResolvedValue(user());
  vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue(null);
});

// ───────────────────────── C3 transfer-request queue ─────────────────────────

describe('getAllTransferRequest', () => {
  it('maps rows to DTOs with current and proposed leader, plus pagination', async () => {
    vi.mocked(AdminRepo.findAllTransferRequests).mockResolvedValue({
      rows: [{
        team_admin_request_id: 11, team_admin_request_status: 'pending', requested_at: new Date('2026-10-02T00:00:00Z'),
        team_id: 30, name: 'ทีมแมว', sport_type_id: 1, logo_key: null,
        current_leader_id: 4, current_leader_full_name: 'หัวหน้าเดิม', current_leader_profile_image_key: null,
        proposed_leader_id: 5, proposed_leader_full_name: 'หัวหน้าใหม่', proposed_leader_profile_image_key: 'avatar/5/x.png',
      }],
      totalItems: 21,
    } as never);

    const result = await Service.getAllTransferRequest(10, 2, 10);

    expect(AdminRepo.findAllTransferRequests).toHaveBeenCalledWith(10, 10);
    expect(result.pagination).toEqual({ page: 2, pageSize: 10, totalItems: 21, totalPages: 3 });
    expect(result.items[0]).toMatchObject({
      id: 11, status: 'pending', createdAt: '2026-10-02T00:00:00.000Z',
      team: { id: 30, name: 'ทีมแมว' },
      currentLeader: { id: 4, fullName: 'หัวหน้าเดิม', avatarUrl: null },
      proposedLeader: { id: 5, fullName: 'หัวหน้าใหม่', avatarUrl: 'https://cdn.test/avatar/5/x.png' },
    });
  });

  it('empty queue → no items, zero pages', async () => {
    vi.mocked(AdminRepo.findAllTransferRequests).mockResolvedValue({ rows: [], totalItems: 0 } as never);
    await expect(Service.getAllTransferRequest(0, 1, 20)).resolves.toEqual({
      items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
  });
});

describe('rejectTransferRequest', () => {
  const pending = { team_admin_request_id: 11, team_id: 30, team_admin_request_status: 'pending', rejection_reason: null };

  it('rejects a pending transfer with the reason and returns the stored result', async () => {
    vi.mocked(TeamRepo.findTransferRequestById)
      .mockResolvedValueOnce(pending as never)
      .mockResolvedValueOnce({ ...pending, team_admin_request_status: 'rejected', rejection_reason: 'ไม่ได้รับความยินยอม' } as never);

    await expect(Service.rejectTransferRequest(1, 11, 'ไม่ได้รับความยินยอม'))
      .resolves.toEqual({ status: 'rejected', reason: 'ไม่ได้รับความยินยอม' });
    expect(AdminRepo.rejectTeamOfficial).toHaveBeenCalledWith(1, 11, 'ไม่ได้รับความยินยอม');
  });

  it('404 TEAM_REQUEST_NOT_FOUND for an unknown request', async () => {
    vi.mocked(TeamRepo.findTransferRequestById).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.rejectTransferRequest(1, 11, 'x'))).toMatchObject({ status: 404, code: 'TEAM_REQUEST_NOT_FOUND' });
    expect(AdminRepo.rejectTeamOfficial).not.toHaveBeenCalled();
  });

  it.each(['approved', 'rejected'])('409 ALREADY_DECIDED when the request is already %s', async (status) => {
    vi.mocked(TeamRepo.findTransferRequestById).mockResolvedValueOnce({ ...pending, team_admin_request_status: status } as never);
    expect(await rejected(Service.rejectTransferRequest(1, 11, 'x'))).toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
  });

  it('400 TEAM_REJECT_REASON_REQUIRED for an empty reason, after the status check', async () => {
    vi.mocked(TeamRepo.findTransferRequestById).mockResolvedValueOnce(pending as never);
    expect(await rejected(Service.rejectTransferRequest(1, 11, ''))).toMatchObject({ status: 400, code: 'TEAM_REJECT_REASON_REQUIRED' });
    expect(AdminRepo.rejectTeamOfficial).not.toHaveBeenCalled();
  });
});

describe('approveTransferRequest', () => {
  const pending = { team_admin_request_id: 11, team_id: 30, target_user_id: 5, team_admin_request_status: 'pending' };

  it('hands leadership to the proposed user and returns team and new leader', async () => {
    vi.mocked(TeamRepo.findTransferRequestById).mockResolvedValueOnce(pending as never);

    await expect(Service.approveTransferRequest(1, 11)).resolves.toEqual({ teamId: 30, newLeaderId: 5 });
    expect(AdminRepo.approveTransferRequest).toHaveBeenCalledWith(1, 11, 30, 5);
  });

  it('404 for an unknown request and 409 for a decided one, without transferring', async () => {
    vi.mocked(TeamRepo.findTransferRequestById).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.approveTransferRequest(1, 11))).toMatchObject({ status: 404, code: 'TEAM_REQUEST_NOT_FOUND' });

    vi.mocked(TeamRepo.findTransferRequestById).mockResolvedValueOnce({ ...pending, team_admin_request_status: 'approved' } as never);
    expect(await rejected(Service.approveTransferRequest(1, 11))).toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });

    expect(AdminRepo.approveTransferRequest).not.toHaveBeenCalled();
  });
});

describe('transferLeaderByAdmin', () => {
  it('transfers to an existing member', async () => {
    vi.mocked(TeamRepo.isMemberOf).mockResolvedValueOnce({} as never);

    await expect(Service.transferLeaderByAdmin(1, 30, 5)).resolves.toEqual({ teamId: 30, newLeaderId: 5 });
    expect(checkTeam).toHaveBeenCalledWith(30);
    expect(TeamRepo.isMemberOf).toHaveBeenCalledWith(30, 5);
    expect(AdminRepo.transferLeaderByAdmin).toHaveBeenCalledWith(1, 30, 5);
  });

  it('422 NOT_A_TEAM_MEMBER for someone outside the team', async () => {
    vi.mocked(TeamRepo.isMemberOf).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.transferLeaderByAdmin(1, 30, 5))).toMatchObject({ status: 422, code: 'NOT_A_TEAM_MEMBER' });
    expect(AdminRepo.transferLeaderByAdmin).not.toHaveBeenCalled();
  });

  it('propagates checkTeam failure (team does not exist)', async () => {
    const err = Object.assign(new Error('x'), { status: 404 });
    vi.mocked(checkTeam).mockRejectedValueOnce(err);
    expect(await rejected(Service.transferLeaderByAdmin(1, 30, 5))).toBe(err);
    expect(TeamRepo.isMemberOf).not.toHaveBeenCalled();
  });
});

// ───────────────────────── official-request document links ─────────────────────────

describe('getAllOfficialRequest — supporting documents', () => {
  it('signs only this team\'s uploaded document keys and passes text/links through unchanged', async () => {
    const ownKey = 'team_official_document/30/11111111-1111-4111-8111-111111111111.pdf';
    const otherTeamKey = 'team_official_document/31/11111111-1111-4111-8111-111111111111.pdf';
    vi.mocked(AdminRepo.findAllOfficialRequests).mockResolvedValue({
      rows: [{
        team_admin_request_id: 1, team_admin_request_status: 'pending', requested_at: new Date('2026-10-01T00:00:00Z'),
        supporting_docs: [ownKey, 'https://drive.example/doc', otherTeamKey, 'หนังสือรับรองจากคณะ'],
        team_id: 30, name: 'ทีมแมว', sport_type_id: 1, logo_key: null, user_id: 4, full_name: 'หัวหน้า', profile_image_key: null,
      }],
      totalItems: 1,
    } as never);

    const { items } = await Service.getAllOfficialRequest(0, 1, 20);

    expect(items[0]!.supportingDocs).toEqual([
      `https://s3/${ownKey}?signed`, 'https://drive.example/doc', otherTeamKey, 'หนังสือรับรองจากคณะ',
    ]);
    expect(getPresignedDownloadUrl).toHaveBeenCalledTimes(1);
  });

  it('a request with no documents (null column) gets an empty list', async () => {
    vi.mocked(AdminRepo.findAllOfficialRequests).mockResolvedValue({
      rows: [{
        team_admin_request_id: 1, team_admin_request_status: 'pending', requested_at: new Date(),
        supporting_docs: null, team_id: 30, name: 'ทีม', sport_type_id: 1, logo_key: null,
        user_id: 4, full_name: 'หัวหน้า', profile_image_key: null,
      }],
      totalItems: 1,
    } as never);

    const { items } = await Service.getAllOfficialRequest(0, 1, 20);
    expect(items[0]!.supportingDocs).toEqual([]);
  });
});

// ───────────────────────── listUsers / listScopes / listAuditLogs ─────────────────────────

describe('listUsers — scope', () => {
  it('a faculty admin is pinned to their own faculty, whatever facultyId was asked for', async () => {
    await Service.listUsers(facultyAdmin, { q: 'ab', facultyId: 7 }, 0, 1, 20);
    expect(UserRepo.searchUsersAdmin).toHaveBeenCalledWith({ q: 'ab', facultyId: 2 }, 0, 20);
  });

  it('a university admin keeps the filters as given', async () => {
    await Service.listUsers(uniAdmin, { facultyId: 7, suspended: true }, 0, 1, 20);
    expect(UserRepo.searchUsersAdmin).toHaveBeenCalledWith({ facultyId: 7, suspended: true }, 0, 20);
  });

  it('root is refused (no daily operations)', async () => {
    expect(await rejected(Service.listUsers(rootAdmin, {}, 0, 1, 20))).toMatchObject({ status: 403, code: 'ROOT_NO_DAILY_OPERATIONS' });
  });
});

describe('listScopes — scope', () => {
  it('a faculty admin only sees their own faculty', async () => {
    await Service.listScopes(facultyAdmin, { facultyId: 7 }, 0, 1, 20);
    expect(AdminRepo.findAllAdminScopes).toHaveBeenCalledWith({ facultyId: 2 }, 0, 20);
  });

  it('root and university admins keep the filter', async () => {
    await Service.listScopes(rootAdmin, { facultyId: 7 }, 0, 1, 20);
    expect(AdminRepo.findAllAdminScopes).toHaveBeenCalledWith({ facultyId: 7 }, 0, 20);
  });
});

describe('listAuditLogs', () => {
  it('a faculty admin is refused with 403 INSUFFICIENT_ADMIN_SCOPE', async () => {
    expect(await rejected(Service.listAuditLogs(facultyAdmin, {}, 0, 1, 20))).toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
    expect(AuditLogRepo.findAuditLogs).not.toHaveBeenCalled();
  });

  it.each([['university', uniAdmin], ['root', rootAdmin]])('a %s admin reads the log, mapped to DTOs', async (_l, who) => {
    vi.mocked(AuditLogRepo.findAuditLogs).mockResolvedValueOnce({
      rows: [{ audit_log_id: 1, actor_user_id: 1, actor_full_name: 'แอดมิน', action_type: 'user_suspended',
               entity_type: 'user', entity_id: 9, details: { reason: 'x' }, created_at: new Date('2026-10-01T00:00:00Z') }],
      totalItems: 1,
    } as never);

    const result = await Service.listAuditLogs(who, { entityType: 'user' }, 0, 1, 20);

    expect(AuditLogRepo.findAuditLogs).toHaveBeenCalledWith({ entityType: 'user' }, 0, 20);
    expect(result.items[0]).toEqual({
      id: 1, actor: { id: 1, fullName: 'แอดมิน' }, actionType: 'user_suspended',
      entityType: 'user', entityId: 9, details: { reason: 'x' }, createdAt: '2026-10-01T00:00:00.000Z',
    });
  });
});

// ───────────────────────── grantScope validation ─────────────────────────

describe('grantScope — validation and rules', () => {
  it('400 when a faculty scope has no facultyId', async () => {
    const err = await rejected(Service.grantScope(uniAdmin, 9, 'faculty', undefined));
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_FAILED', extra: { fields: { facultyId: expect.any(String) } } });
  });

  it('400 when a university_wide scope is given a facultyId', async () => {
    const err = await rejected(Service.grantScope(rootAdmin, 9, 'university_wide', 2));
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
  });

  it('404 FACULTY_NOT_FOUND for an unknown faculty', async () => {
    vi.mocked(FacultyRepo.findFacultyById).mockResolvedValueOnce(null as never);
    expect(await rejected(Service.grantScope(uniAdmin, 9, 'faculty', 99))).toMatchObject({ status: 404, code: 'FACULTY_NOT_FOUND' });
  });

  it('422 EXTERNAL_ACCOUNT_CANNOT_BE_ADMIN for a non-university email', async () => {
    vi.mocked(checkUser).mockResolvedValue(user({ email: 'someone@gmail.com' }));
    expect(await rejected(Service.grantScope(uniAdmin, 9, 'faculty', 2))).toMatchObject({ status: 422, code: 'EXTERNAL_ACCOUNT_CANNOT_BE_ADMIN' });
    expect(AdminRepo.createAdminScope).not.toHaveBeenCalled();
  });

  it('422 ADMIN_FACULTY_MISMATCH when the user is not in that faculty, with both ids', async () => {
    vi.mocked(checkUser).mockResolvedValue(user({ faculty_id: 5 }));
    expect(await rejected(Service.grantScope(uniAdmin, 9, 'faculty', 2))).toMatchObject({
      status: 422, code: 'ADMIN_FACULTY_MISMATCH', extra: { userFacultyId: 5, requestedFacultyId: 2 },
    });
  });

  it('a university_wide grant by root does not require faculty membership', async () => {
    vi.mocked(checkUser).mockResolvedValue(user({ faculty_id: 5 }));
    vi.mocked(AdminRepo.findAdminScopeById).mockResolvedValueOnce(scopeRow({ scope_type: 'university_wide', faculty_id: null }));

    const dto = await Service.grantScope(rootAdmin, 9, 'university_wide', undefined);

    expect(AdminRepo.createAdminScope).toHaveBeenCalledWith(9, 'university_wide', null, 1);
    expect(dto).toMatchObject({ id: 40, scopeType: 'university_wide', facultyId: null, user: { id: 9 } });
  });

  it('a faculty grant makes the user staff and writes an audit entry', async () => {
    vi.mocked(AdminRepo.findAdminScopeById).mockResolvedValueOnce(scopeRow());

    await Service.grantScope(uniAdmin, 9, 'faculty', 2);

    expect(UserRepo.updateUserType).toHaveBeenCalledWith(9, 'staff');
    expect(AuditLogRepo.insertAuditLog).toHaveBeenCalledWith(1, 'admin_scope_granted', 'admin_scope', 77,
      { targetUserId: 9, scopeType: 'faculty', facultyId: 2 });
  });

  it.each([
    ['faculty admin grants anything', facultyAdmin, 'faculty'],
    ['root grants faculty', rootAdmin, 'faculty'],
    ['university admin grants university_wide', uniAdmin, 'university_wide'],
  ] as const)('403 when %s', async (_l, who, type) => {
    expect(await rejected(Service.grantScope(who, 9, type, type === 'faculty' ? 2 : undefined)))
      .toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
  });
});

// ───────────────────────── revokeScope success path ─────────────────────────

describe('revokeScope — success path', () => {
  it('deletes the scope, resets a KU user back to student, and audits it', async () => {
    vi.mocked(AdminRepo.findAdminScopeById).mockResolvedValueOnce(scopeRow());
    vi.mocked(UserRepo.findById).mockResolvedValueOnce(user({ email: 'b6x@ku.th' }));

    await expect(Service.revokeScope(uniAdmin, 40)).resolves.toEqual({ id: 40 });

    expect(AdminRepo.deleteAdminScope).toHaveBeenCalledWith(40);
    expect(UserRepo.updateUserType).toHaveBeenCalledWith(9, 'student');
    expect(AuditLogRepo.insertAuditLog).toHaveBeenCalledWith(1, 'admin_scope_revoked', 'admin_scope', 40,
      { targetUserId: 9, scopeType: 'faculty' });
  });

  it('resets a non-KU account to external', async () => {
    vi.mocked(AdminRepo.findAdminScopeById).mockResolvedValueOnce(scopeRow());
    vi.mocked(UserRepo.findById).mockResolvedValueOnce(user({ email: 'x@gmail.com' }));

    await Service.revokeScope(uniAdmin, 40);

    expect(UserRepo.updateUserType).toHaveBeenCalledWith(9, 'external');
  });

  it('keeps user_type when the user still holds another admin scope', async () => {
    vi.mocked(AdminRepo.findAdminScopeById).mockResolvedValueOnce(scopeRow());
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValueOnce(scopeRow({ admin_scope_id: 41 }));

    await Service.revokeScope(uniAdmin, 40);

    expect(UserRepo.updateUserType).not.toHaveBeenCalled();
    expect(AuditLogRepo.insertAuditLog).toHaveBeenCalled();
  });

  it('skips the user_type reset if the user row is gone', async () => {
    vi.mocked(AdminRepo.findAdminScopeById).mockResolvedValueOnce(scopeRow());
    vi.mocked(UserRepo.findById).mockResolvedValueOnce(null as never);

    await expect(Service.revokeScope(uniAdmin, 40)).resolves.toEqual({ id: 40 });
    expect(UserRepo.updateUserType).not.toHaveBeenCalled();
  });

  it('root can revoke a university admin while more than one remains', async () => {
    vi.mocked(AdminRepo.findAdminScopeById).mockResolvedValueOnce(scopeRow({ scope_type: 'university_wide', faculty_id: null }));
    vi.mocked(AdminRepo.countActiveUniversityWideAdmins).mockResolvedValueOnce(2);
    vi.mocked(UserRepo.findById).mockResolvedValueOnce(user());

    await expect(Service.revokeScope(rootAdmin, 40)).resolves.toEqual({ id: 40 });
    expect(AdminRepo.deleteAdminScope).toHaveBeenCalledWith(40);
  });

  it('409 LAST_UNIVERSITY_ADMIN when only one university admin is left', async () => {
    vi.mocked(AdminRepo.findAdminScopeById).mockResolvedValueOnce(scopeRow({ scope_type: 'university_wide', faculty_id: null }));
    vi.mocked(AdminRepo.countActiveUniversityWideAdmins).mockResolvedValueOnce(1);

    expect(await rejected(Service.revokeScope(rootAdmin, 40))).toMatchObject({ status: 409, code: 'LAST_UNIVERSITY_ADMIN' });
    expect(AdminRepo.deleteAdminScope).not.toHaveBeenCalled();
  });

  it('403 CANNOT_REVOKE_ROOT_SCOPE and CANNOT_REVOKE_OWN_SCOPE', async () => {
    vi.mocked(AdminRepo.findAdminScopeById).mockResolvedValueOnce(scopeRow({ scope_type: 'root' }));
    expect(await rejected(Service.revokeScope(rootAdmin, 40))).toMatchObject({ code: 'CANNOT_REVOKE_ROOT_SCOPE' });

    vi.mocked(AdminRepo.findAdminScopeById).mockResolvedValueOnce(scopeRow({ user_id: 1 }));
    expect(await rejected(Service.revokeScope(uniAdmin, 40))).toMatchObject({ code: 'CANNOT_REVOKE_OWN_SCOPE' });
  });
});

// ───────────────────────── suspension warning ─────────────────────────

describe('suspendUser — faculty left without an admin', () => {
  beforeEach(() => {
    vi.mocked(checkUser).mockResolvedValue(user({ user_id: 9, faculty_id: 2 }));
  });

  it('warns when the suspended user was the last active admin of their faculty', async () => {
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue(scopeRow({ admin_scope_id: 40, user_id: 9, scope_type: 'faculty', faculty_id: 2 }));
    vi.mocked(AdminRepo.countActiveFacultyAdmins).mockResolvedValueOnce(0);

    const result = await Service.suspendUser(uniAdmin, 9, true, 'ละเมิดกฎ', 7, 'cheating');

    expect(AdminRepo.countActiveFacultyAdmins).toHaveBeenCalledWith(2);
    expect(result.warning).toContain('ไม่เหลือแอดมิน');
    expect(result.adminScope).toEqual({ id: 40, scopeType: 'faculty', facultyId: 2 });
  });

  it('no warning while other faculty admins remain', async () => {
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue(scopeRow({ admin_scope_id: 40, user_id: 9, scope_type: 'faculty', faculty_id: 2 }));
    vi.mocked(AdminRepo.countActiveFacultyAdmins).mockResolvedValueOnce(1);

    const result = await Service.suspendUser(uniAdmin, 9, true, 'ละเมิดกฎ', 7, 'cheating');
    expect(result.warning).toBeNull();
  });

  it('no faculty count at all for a non-admin target', async () => {
    const result = await Service.suspendUser(uniAdmin, 9, true, 'ละเมิดกฎ', undefined, 'cheating');
    expect(AdminRepo.countActiveFacultyAdmins).not.toHaveBeenCalled();
    expect(result.warning).toBeNull();
    expect(result.adminScope).toBeNull();
  });
});

// ───────────────────────── user reports ─────────────────────────

describe('listUserReports', () => {
  it('a faculty admin only sees reports of their faculty; evidence comes back signed', async () => {
    vi.mocked(UserReportRepo.findAllUserReports).mockResolvedValueOnce({
      rows: [{
        user_report_id: 5, reporter_id: 3, reporter_name: 'ผู้แจ้ง', reporter_avatar_key: null,
        target_id: 9, target_name: 'ผู้ถูกแจ้ง', target_avatar_key: null, target_is_admin: 0,
        reason: 'x', evidence: ['report_evidence/3/a.png'], user_report_status: 'pending',
        created_at: new Date('2026-10-01T00:00:00Z'), reviewed_by: null, reviewed_by_name: null, reviewed_at: null, rejection_reason: null,
      }],
      totalItems: 1,
    } as never);

    const { items } = await Service.listUserReports(facultyAdmin, 0, 1, 20);

    expect(UserReportRepo.findAllUserReports).toHaveBeenCalledWith(2, 0, 20);
    expect(items[0]!.evidence).toEqual(['https://s3/report_evidence/3/a.png?signed']);
    expect(items[0]!.target.isAdmin).toBe(false);
  });

  it('a university admin sees all faculties (undefined filter)', async () => {
    await Service.listUserReports(uniAdmin, 0, 1, 20);
    expect(UserReportRepo.findAllUserReports).toHaveBeenCalledWith(undefined, 0, 20);
  });
});

describe('approveUserReport — success', () => {
  it('suspends the target using the report reason, then marks the report approved', async () => {
    vi.mocked(UserReportRepo.findById).mockResolvedValueOnce(report());

    const result = await Service.approveUserReport(uniAdmin, 5, 3, 'abusive_language');

    expect(UserRepo.suspendUser).toHaveBeenCalledWith(9, true, 'สแปมในคอมเมนต์', expect.any(Date), 'abusive_language');
    expect(UserReportRepo.updateStatus).toHaveBeenCalledWith(5, 'approved', 1, null);
    expect(AuditLogRepo.insertAuditLog).toHaveBeenCalledWith(1, 'user_report_approved', 'user_report', 5, { targetUserId: 9 });
    expect(result).toMatchObject({ id: 9, warning: null });
  });

  it('does not mark the report approved if the suspension is refused', async () => {
    vi.mocked(UserReportRepo.findById).mockResolvedValueOnce(report());
    vi.mocked(UserRepo.hasApprovedApplicationAsLeader).mockResolvedValueOnce(true);

    expect(await rejected(Service.approveUserReport(uniAdmin, 5, 3, 'abusive_language')))
      .toMatchObject({ status: 409, code: 'USER_HAS_ACTIVE_OBLIGATIONS' });
    expect(UserReportRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('403 CANNOT_REVIEW_OWN_REPORT when the admin is the target', async () => {
    vi.mocked(UserReportRepo.findById).mockResolvedValueOnce(report({ target_user_id: 1 }));
    expect(await rejected(Service.approveUserReport(uniAdmin, 5, 3, 'abusive_language'))).toMatchObject({ code: 'CANNOT_REVIEW_OWN_REPORT' });
  });

  it('409 ALREADY_DECIDED for a report that is no longer pending', async () => {
    vi.mocked(UserReportRepo.findById).mockResolvedValueOnce(report({ user_report_status: 'rejected' }));
    expect(await rejected(Service.approveUserReport(uniAdmin, 5, 3, 'abusive_language'))).toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
  });
});

describe('rejectUserReport — success and scope', () => {
  it('marks the report rejected with the reason and audits it, without touching the user', async () => {
    vi.mocked(UserReportRepo.findById).mockResolvedValueOnce(report());

    await expect(Service.rejectUserReport(uniAdmin, 5, 'หลักฐานไม่พอ'))
      .resolves.toEqual({ id: 5, status: 'rejected', reason: 'หลักฐานไม่พอ' });

    expect(UserReportRepo.updateStatus).toHaveBeenCalledWith(5, 'rejected', 1, 'หลักฐานไม่พอ');
    expect(AuditLogRepo.insertAuditLog).toHaveBeenCalledWith(1, 'user_report_rejected', 'user_report', 5,
      { targetUserId: 9, reason: 'หลักฐานไม่พอ' });
    expect(UserRepo.suspendUser).not.toHaveBeenCalled();
  });

  it('a faculty admin cannot reject a report about someone from another faculty', async () => {
    vi.mocked(UserReportRepo.findById).mockResolvedValueOnce(report());
    vi.mocked(checkUser).mockResolvedValue(user({ faculty_id: 5 }));

    expect(await rejected(Service.rejectUserReport(facultyAdmin, 5, 'x'))).toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
    expect(UserReportRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('root is refused', async () => {
    expect(await rejected(Service.rejectUserReport(rootAdmin, 5, 'x'))).toMatchObject({ code: 'ROOT_NO_DAILY_OPERATIONS' });
    expect(UserReportRepo.findById).not.toHaveBeenCalled();
  });
});
