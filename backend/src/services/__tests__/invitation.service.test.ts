import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../repositories/invitation.repo.js', () => ({
  createAcceptInvite: vi.fn(),
  createRejectInvite: vi.fn(),
}));

vi.mock('../../repositories/team.repo.js', () => ({
  findInvitationsById: vi.fn(),
  countUnofficialTeamsByUser: vi.fn(),
  findById: vi.fn(),
}));

vi.mock('../../repositories/sportType.repo.js', () => ({
  // Imported by invitation.service.ts but not currently used by either
  // exported function; mocked for isolation only.
}));

vi.mock('../../utils/checkExist.js', () => ({
  checkTeam: vi.fn(),
}));

import * as invitationService from '../invitation.service.js';
import * as InviteRepo from '../../repositories/invitation.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import { AppError } from '../../utils/AppError.js';
import type { TeamInvitationRow, TeamRow } from '../../types/db.js';

const mockedInviteRepo = vi.mocked(InviteRepo);
const mockedTeamRepo = vi.mocked(TeamRepo);

function makeInvitation(overrides: Partial<TeamInvitationRow> = {}): TeamInvitationRow {
  return {
    team_invitation_id: 55,
    team_id: 10,
    invited_user_id: 8,
    invited_by_user_id: 5,
    team_invitation_status: 'pending',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    // 7 days after the fake "now" set in beforeEach below.
    expires_at: new Date('2026-01-08T00:00:00.000Z'),
    responded_at: null,
    ...overrides,
  };
}

function makeTeam(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    team_id: 10,
    name: 'Dream Team',
    sport_type_id: 1,
    leader_id: 5,
    readiness_status: 'Forming',
    official_status: 'Unofficial',
    created_at: new Date(),
    updated_at: null,
    last_competed_at: null,
    deleted_at: null,
    deleted_reason: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('acceptInvitation', () => {
  it('throws INVITATION_NOT_FOUND when the invitation does not exist', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(null);

    await expect(invitationService.acceptInvitation(55, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
    expect(mockedTeamRepo.countUnofficialTeamsByUser).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN when the invitation belongs to a different user', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(makeInvitation({ invited_user_id: 8 }));

    await expect(invitationService.acceptInvitation(55, 999)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(mockedTeamRepo.countUnofficialTeamsByUser).not.toHaveBeenCalled();
  });

  it('throws INVITATION_EXPIRED when the invitation has already expired', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(
      makeInvitation({ expires_at: new Date('2025-12-31T00:00:00.000Z') }),
    );

    await expect(invitationService.acceptInvitation(55, 8)).rejects.toMatchObject({
      status: 410,
      code: 'INVITATION_EXPIRED',
    });
    expect(mockedTeamRepo.countUnofficialTeamsByUser).not.toHaveBeenCalled();
  });

  it('throws INVITATION_ALREADY_ANSWERED when the invitation is no longer pending', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(
      makeInvitation({ team_invitation_status: 'accepted' }),
    );

    await expect(invitationService.acceptInvitation(55, 8)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
    expect(mockedTeamRepo.countUnofficialTeamsByUser).not.toHaveBeenCalled();
  });

  it('throws TEAM_QUOTA_EXCEEDED when the user already has 5 unofficial teams', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(makeInvitation());
    mockedTeamRepo.countUnofficialTeamsByUser.mockResolvedValue(5);

    await expect(invitationService.acceptInvitation(55, 8)).rejects.toMatchObject({
      status: 422,
      code: 'TEAM_QUOTA_EXCEEDED',
    });
    expect(mockedInviteRepo.createAcceptInvite).not.toHaveBeenCalled();
  });

  it('throws TEAM_NOT_FOUND when the team no longer exists after accepting', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(makeInvitation());
    mockedTeamRepo.countUnofficialTeamsByUser.mockResolvedValue(2);
    mockedTeamRepo.findById.mockResolvedValue(null);

    await expect(invitationService.acceptInvitation(55, 8)).rejects.toMatchObject({
      status: 404,
      code: 'TEAM_NOT_FOUND',
    });
    // The accept record is written before the team is re-fetched, so this
    // still happens even though the overall call ends up rejecting.
    expect(mockedInviteRepo.createAcceptInvite).toHaveBeenCalledWith(55, 10, 8);
  });

  it('accepts a valid pending invitation and returns the team status', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(makeInvitation());
    mockedTeamRepo.countUnofficialTeamsByUser.mockResolvedValue(2);
    mockedTeamRepo.findById.mockResolvedValue(makeTeam({ readiness_status: 'Forming' }));

    const result = await invitationService.acceptInvitation(55, 8);

    expect(mockedTeamRepo.countUnofficialTeamsByUser).toHaveBeenCalledWith(8);
    expect(mockedInviteRepo.createAcceptInvite).toHaveBeenCalledWith(55, 10, 8);
    expect(mockedTeamRepo.findById).toHaveBeenCalledWith(10);
    expect(result).toEqual({ teamId: 10, teamReadinessStatus: 'Forming' });
  });
});

describe('rejectInvitation', () => {
  it('throws INVITATION_NOT_FOUND when the invitation does not exist', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(null);

    await expect(invitationService.rejectInvitation(55, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
    expect(mockedInviteRepo.createRejectInvite).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN when the invitation belongs to a different user', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(makeInvitation({ invited_user_id: 8 }));

    await expect(invitationService.rejectInvitation(55, 999)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(mockedInviteRepo.createRejectInvite).not.toHaveBeenCalled();
  });

  it('throws INVITATION_ALREADY_ANSWERED when the invitation is no longer pending', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(
      makeInvitation({ team_invitation_status: 'rejected' }),
    );

    await expect(invitationService.rejectInvitation(55, 8)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
    expect(mockedInviteRepo.createRejectInvite).not.toHaveBeenCalled();
  });

  it('does not check invitation expiry before rejecting', async () => {
    // Unlike acceptInvitation, rejectInvitation has no expiry check at all —
    // an expired-but-still-pending invitation can still be rejected.
    mockedTeamRepo.findInvitationsById.mockResolvedValue(
      makeInvitation({ expires_at: new Date('2025-12-31T00:00:00.000Z') }),
    );

    await expect(invitationService.rejectInvitation(55, 8)).resolves.toBeUndefined();
    expect(mockedInviteRepo.createRejectInvite).toHaveBeenCalledWith(55, 8);
  });

  it('rejects a pending invitation', async () => {
    mockedTeamRepo.findInvitationsById.mockResolvedValue(makeInvitation());

    const result = await invitationService.rejectInvitation(55, 8);

    expect(mockedInviteRepo.createRejectInvite).toHaveBeenCalledWith(55, 8);
    expect(result).toBeUndefined();
  });
});
