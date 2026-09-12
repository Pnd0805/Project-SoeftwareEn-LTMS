import { describe, it, expect, vi, beforeEach } from 'vitest';

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
} from '../adminScope.service.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import { AppError } from '../../utils/AppError.js';

const mockedAdminRepo = vi.mocked(AdminRepo);
const mockedTeamRepo = vi.mocked(TeamRepo);

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
        requestedBy: { id: 5, fullName: 'สมชาย ใจดี', avatarUrl: 'avatar.png' },
        status: 'pending',
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
