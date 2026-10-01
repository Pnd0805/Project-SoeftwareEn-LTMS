import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../upload.service.js', () => ({
  getPresignedDownloadUrl: vi.fn((key: string) => Promise.resolve(`https://s3/${key}?signed`)),
  presignAll: vi.fn((keys: string[] | null) =>
    Promise.resolve((keys ?? []).map((key) => `https://s3/${key}?signed`))),
}));

vi.mock('../../repositories/userReport.repo.js', () => ({
  findAllUserReports: vi.fn(),
}));
vi.mock('../../utils/imageUrl.js', () => ({
  toPublicImageUrl: (key: string | null) => (key === null ? null : `https://cdn.test/${key}`),
}));
vi.mock('../../repositories/adminScope.repo.js', () => ({
  findAllOfficialRequests: vi.fn(),
  approveTeamOfficial: vi.fn(),
  rejectTeamOfficial: vi.fn(),
}));

vi.mock('../../repositories/team.repo.js', () => ({
  findOfficialRequestById: vi.fn(),
  findById: vi.fn(),
  findOfficialMemberConflict: vi.fn(),
}));

import {
  getAllOfficialRequest,
  approveTeamRequest,
  rejectTeamOfficial,
  listUserReports,
} from '../adminScope.service.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as UserReportRepo from '../../repositories/userReport.repo.js';
import { AppError } from '../../utils/AppError.js';

const mockedAdminRepo = vi.mocked(AdminRepo);
const mockedTeamRepo = vi.mocked(TeamRepo);
const mockedUserReportRepo = vi.mocked(UserReportRepo);

// Note: this suite mocks only the repositories. The mappers (toGetOfficialRequest,
// toRequestApproveDto, toRequestRejectDto, toOfficialMemberConflictDto) and
// buildPagination are pure functions and are exercised for real, the same way
// team.service.test.ts / reference.service.test.ts do it.

const officialRequestRow = {
  team_admin_request_id: 1,
  team_admin_request_status: 'pending' as const,
  requested_at: new Date('2024-04-01T00:00:00Z'),
  team_id: 10,
  name: 'Dream Team',
  sport_type_id: 2,
  user_id: 5,
  full_name: 'สมชาย ใจดี',
  profile_image_key: 'avatar.png',
};

const teamRow = {
  team_id: 10,
  name: 'Dream Team',
  sport_type_id: 2,
  leader_id: 5,
  readiness_status: 'Ready' as const,
  official_status: 'Unofficial' as const,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: null,
  last_competed_at: null,
  deleted_at: null,
  deleted_reason: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adminScope.service getAllOfficialRequest()', () => {
  it('maps every row and returns a pagination block built from totalItems', async () => {
    mockedAdminRepo.findAllOfficialRequests.mockResolvedValue({
      rows: [officialRequestRow],
      totalItems: 1,
    } as any);

    const result = await getAllOfficialRequest(0, 1, 20);

    expect(mockedAdminRepo.findAllOfficialRequests).toHaveBeenCalledWith(0, 20);
    expect(result.items).toEqual([
      {
        id: 1,
        team: { id: 10, name: 'Dream Team', sportTypeId: 2 },
        requestedBy: { id: 5, fullName: 'สมชาย ใจดี', avatarUrl: 'https://cdn.test/avatar.png' },
        status: 'pending',
        supportingDocs: [],
        createdAt: '2024-04-01T00:00:00.000Z',
      },
    ]);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
  });

  /**
   * เอกสารประกอบเป็นเหตุผลทั้งหมดของคำขอ "ทีม Official" และบังคับให้ยื่น แต่คิวไม่เคย SELECT มา
   * แอดมินจึงตัดสินโดยไม่เห็นเอกสารเลย (แก้ 27 ก.ย.) · ออกเป็น presigned URL เสมอ ไม่ส่ง S3 key ดิบ
   */
  it('turns the submitted documents into presigned URLs and never returns the raw key', async () => {
    mockedAdminRepo.findAllOfficialRequests.mockResolvedValue({
      rows: [{ ...officialRequestRow, supporting_docs: ['team_docs/10/cert.png', 'team_docs/10/letter.png'] }],
      totalItems: 1,
    } as any);

    const result = await getAllOfficialRequest(0, 1, 20);

    expect(result.items[0]!.supportingDocs).toEqual([
      'https://s3/team_docs/10/cert.png?signed',
      'https://s3/team_docs/10/letter.png?signed',
    ]);
    expect(JSON.stringify(result.items)).not.toContain('"team_docs/10/cert.png"');
  });

  it('returns an empty items array and totalPages 0 when there are no requests', async () => {
    mockedAdminRepo.findAllOfficialRequests.mockResolvedValue({ rows: [], totalItems: 0 } as any);

    const result = await getAllOfficialRequest(0, 1, 20);

    expect(result.items).toEqual([]);
    expect(result.pagination.totalPages).toBe(0);
  });
});

describe('adminScope.service approveTeamRequest()', () => {
  it('throws TEAM_REQUEST_NOT_FOUND when the request does not exist', async () => {
    mockedTeamRepo.findOfficialRequestById.mockResolvedValue(null as any);

    await expect(approveTeamRequest(1, 99)).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_REQUEST_NOT_FOUND',
    });
    expect(mockedTeamRepo.findById).not.toHaveBeenCalled();
    expect(mockedAdminRepo.approveTeamOfficial).not.toHaveBeenCalled();
  });

  it('throws ALREADY_DECIDED when the request status is not "pending"', async () => {
    mockedTeamRepo.findOfficialRequestById.mockResolvedValue({
      ...officialRequestRow,
      team_admin_request_status: 'approved',
    } as any);

    await expect(approveTeamRequest(1, 1)).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_DECIDED',
    });
    expect(mockedAdminRepo.approveTeamOfficial).not.toHaveBeenCalled();
  });

  it('throws MEMBER_CONFLICT with mapped conflicting members and never approves when a conflict exists', async () => {
    mockedTeamRepo.findOfficialRequestById.mockResolvedValue(officialRequestRow as any);
    mockedTeamRepo.findById.mockResolvedValue(teamRow as any);
    mockedTeamRepo.findOfficialMemberConflict.mockResolvedValue([
      { user_id: 7, full_name: 'สมหญิง', conflictingTeamName: 'Rival Team' },
    ] as any);

    const err = await approveTeamRequest(1, 1).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('MEMBER_CONFLICT');
    expect(err.extra).toEqual({
      conflictingMembers: [
        { userId: 7, fullName: 'สมหญิง', conflictingTeamName: 'Rival Team' },
      ],
    });
    expect(mockedAdminRepo.approveTeamOfficial).not.toHaveBeenCalled();
  });

  it('checks conflicts using the sport_type_id of the team, not the request row', async () => {
    mockedTeamRepo.findOfficialRequestById.mockResolvedValue(officialRequestRow as any);
    mockedTeamRepo.findById.mockResolvedValue(teamRow as any);
    mockedTeamRepo.findOfficialMemberConflict.mockResolvedValue([]);
    mockedAdminRepo.approveTeamOfficial.mockResolvedValue(undefined as any);
    mockedTeamRepo.findById.mockResolvedValueOnce(teamRow as any).mockResolvedValueOnce({
      ...teamRow,
      official_status: 'Official',
    } as any);

    await approveTeamRequest(1, 1);

    expect(mockedTeamRepo.findOfficialMemberConflict).toHaveBeenCalledWith(10, teamRow.sport_type_id);
  });

  it('approves the request and returns the refreshed team as a requestApproveDto when there is no conflict', async () => {
    mockedTeamRepo.findOfficialRequestById.mockResolvedValue(officialRequestRow as any);
    mockedTeamRepo.findOfficialMemberConflict.mockResolvedValue([]);
    mockedAdminRepo.approveTeamOfficial.mockResolvedValue(undefined as any);
    mockedTeamRepo.findById
      .mockResolvedValueOnce(teamRow as any) // pre-approval lookup for the conflict check
      .mockResolvedValueOnce({ ...teamRow, official_status: 'Official' } as any); // post-approval refetch

    const result = await approveTeamRequest(9, 1);

    expect(mockedAdminRepo.approveTeamOfficial).toHaveBeenCalledWith(9, 1, 10);
    expect(mockedTeamRepo.findById).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ teamId: 10, officialStatus: 'Official' });
  });
});

describe('adminScope.service rejectTeamOfficial()', () => {
  it('throws TEAM_REQUEST_NOT_FOUND when the request does not exist', async () => {
    mockedTeamRepo.findOfficialRequestById.mockResolvedValue(null as any);

    await expect(rejectTeamOfficial(1, 99, 'x')).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_REQUEST_NOT_FOUND',
    });
    expect(mockedAdminRepo.rejectTeamOfficial).not.toHaveBeenCalled();
  });

  it('throws ALREADY_DECIDED when the request status is not "pending", even with a valid reason', async () => {
    mockedTeamRepo.findOfficialRequestById.mockResolvedValue({
      ...officialRequestRow,
      team_admin_request_status: 'rejected',
    } as any);

    await expect(rejectTeamOfficial(1, 1, 'x')).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_DECIDED',
    });
    expect(mockedAdminRepo.rejectTeamOfficial).not.toHaveBeenCalled();
  });

  it('throws TEAM_REJECT_REASON_REQUIRED for an empty reason and never calls the repo', async () => {
    mockedTeamRepo.findOfficialRequestById.mockResolvedValue(officialRequestRow as any);

    await expect(rejectTeamOfficial(1, 1, '')).rejects.toMatchObject({
      status: 400,
      code: 'TEAM_REJECT_REASON_REQUIRED',
    });
    expect(mockedAdminRepo.rejectTeamOfficial).not.toHaveBeenCalled();
  });

  it(
    'accepts a whitespace-only reason (e.g. " ") since the check is a strict === "" comparison, ' +
      'not a trimmed emptiness check — documenting current behavior rather than the likely intent',
    async () => {
      mockedTeamRepo.findOfficialRequestById.mockResolvedValue(officialRequestRow as any);
      mockedAdminRepo.rejectTeamOfficial.mockResolvedValue(undefined as any);
      mockedTeamRepo.findOfficialRequestById.mockResolvedValueOnce(officialRequestRow as any).mockResolvedValueOnce({
        ...officialRequestRow,
        team_admin_request_status: 'rejected',
        rejection_reason: ' ',
      } as any);

      await expect(rejectTeamOfficial(1, 1, ' ')).resolves.toBeDefined();
      expect(mockedAdminRepo.rejectTeamOfficial).toHaveBeenCalledWith(1, 1, ' ');
    },
  );

  it('rejects the request and returns the refreshed request as a requestRejectDto', async () => {
    mockedAdminRepo.rejectTeamOfficial.mockResolvedValue(undefined as any);
    mockedTeamRepo.findOfficialRequestById
      .mockResolvedValueOnce(officialRequestRow as any) // pre-check lookup
      .mockResolvedValueOnce({
        ...officialRequestRow,
        team_admin_request_status: 'rejected',
        rejection_reason: 'เอกสารไม่ครบ',
      } as any); // post-reject refetch

    const result = await rejectTeamOfficial(9, 1, 'เอกสารไม่ครบ');

    expect(mockedAdminRepo.rejectTeamOfficial).toHaveBeenCalledWith(9, 1, 'เอกสารไม่ครบ');
    expect(mockedTeamRepo.findOfficialRequestById).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ status: 'rejected', reason: 'เอกสารไม่ครบ' });
  });
});

// ============================= C2 — GET /admin/user-reports =============================
// ชุดนี้ตรึงเรื่องเดียว: หลักฐานที่คืนให้แอดมินต้องเป็น presigned URL ไม่ใช่ S3 key ดิบ
// (เดิมคิวนี้ส่ง key ดิบ FE เปิดรูปไม่ได้ แอดมินจึงตัดสินโดยไม่เห็นหลักฐาน — แก้ 1 ต.ค. 2569)
describe('listUserReports', () => {
  const universityAdmin = { admin_scope_id: 1, user_id: 1, scope_type: 'university_wide', faculty_id: null } as any;

  function reportRow(overrides: Record<string, unknown> = {}) {
    return {
      user_report_id: 5,
      reason: 'ใช้ถ้อยคำไม่เหมาะสม',
      evidence: null,
      user_report_status: 'pending',
      created_at: new Date('2026-10-01T03:00:00Z'),
      reporter_id: 9001, reporter_name: 'สมชาย ใจดี', reporter_avatar_key: null,
      target_id: 9002, target_name: 'สมหญิง ตั้งใจ', target_faculty_id: 1,
      target_is_admin: 0, target_avatar_key: null,
      reviewed_by: null, reviewed_by_name: null, reviewed_at: null, rejection_reason: null,
      ...overrides,
    };
  }

  it('คืนหลักฐานเป็น presigned URL ไม่ใช่ S3 key ที่เก็บในฐาน', async () => {
    mockedUserReportRepo.findAllUserReports.mockResolvedValue({
      rows: [reportRow({ evidence: ['report_evidence/9001/a.png', 'report_evidence/9001/b.png'] })] as any,
      totalItems: 1,
    });

    const result = await listUserReports(universityAdmin, 0, 1, 20);

    expect(result.items[0]!.evidence).toEqual([
      'https://s3/report_evidence/9001/a.png?signed',
      'https://s3/report_evidence/9001/b.png?signed',
    ]);
  });

  it('คำร้องที่ไม่มีหลักฐานคืน array ว่าง ไม่ใช่ null', async () => {
    mockedUserReportRepo.findAllUserReports.mockResolvedValue({
      rows: [reportRow()] as any,
      totalItems: 1,
    });

    const result = await listUserReports(universityAdmin, 0, 1, 20);

    expect(result.items[0]!.evidence).toEqual([]);
  });

  // เซ็นทีละแถว ⇒ ถ้าเผลอเซ็นแถวแรกแถวเดียวแล้วใช้ซ้ำ เทสข้อนี้จะพัง
  it('เซ็นลิงก์แยกตามแถว ไม่ใช้ของแถวแรกซ้ำทุกแถว', async () => {
    mockedUserReportRepo.findAllUserReports.mockResolvedValue({
      rows: [
        reportRow({ user_report_id: 5, evidence: ['report_evidence/9001/a.png'] }),
        reportRow({ user_report_id: 6, evidence: ['report_evidence/9004/z.png'] }),
      ] as any,
      totalItems: 2,
    });

    const result = await listUserReports(universityAdmin, 0, 1, 20);

    expect(result.items[0]!.evidence).toEqual(['https://s3/report_evidence/9001/a.png?signed']);
    expect(result.items[1]!.evidence).toEqual(['https://s3/report_evidence/9004/z.png?signed']);
  });

  it('root แตะคิวนี้ไม่ได้ (assertNotRoot) และไม่ไปถึง repo', async () => {
    const root = { admin_scope_id: 9, user_id: 9, scope_type: 'root', faculty_id: null } as any;

    await expect(listUserReports(root, 0, 1, 20)).rejects.toMatchObject({ status: 403 });
    expect(mockedUserReportRepo.findAllUserReports).not.toHaveBeenCalled();
  });
});
