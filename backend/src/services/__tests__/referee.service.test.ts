import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/tournamentReferee.repo.js', () => ({
  findLatestByTournamentAndUser: vi.fn(),
  create: vi.fn(),
  findLatestPerUserByTournament: vi.fn(),
  findPendingInvitationsByUser: vi.fn(),
  findById: vi.fn(),
  accept: vi.fn(),
  decline: vi.fn(),
}));

vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../mappers/referee.mapper.js', () => ({
  toTournamentRefereeDto: vi.fn(),
  toMyRefereeInvitationDto: vi.fn(),
}));

import * as refereeService from '../referee.service.js';
import * as RefRepo from '../../repositories/tournamentReferee.repo.js';
import * as UserRepo from '../../repositories/user.repo.js';
import { toTournamentRefereeDto, toMyRefereeInvitationDto } from '../../mappers/referee.mapper.js';
import { AppError } from '../../utils/AppError.js';
import type { TournamentRefereeRow, UserRow } from '../../types/db.js';

const mockedRefRepo = vi.mocked(RefRepo);
const mockedUserRepo = vi.mocked(UserRepo);
const mockedToTournamentRefereeDto = vi.mocked(toTournamentRefereeDto);
const mockedToMyRefereeInvitationDto = vi.mocked(toMyRefereeInvitationDto);

// NOTE: InviteRefereeInput's exact shape lives in schemas/referee.schema.ts,
// which wasn't provided. This fixture only includes the fields
// referee.service.ts actually reads off it (userId, isExternal).
function makeInviteInput(overrides: Record<string, unknown> = {}) {
  return { userId: 8, isExternal: false, ...overrides };
}

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    user_id: 8,
    full_name: 'Referee Candidate',
    email: 'ref@example.com',
    password_hash: 'hashed-password',
    gender: 'other',
    birth_date: '1990-01-01',
    user_type: 'staff',
    faculty_id: null,
    department_id: null,
    year: null,
    profile_image_key: null,
    contact_info: null,
    address: null,
    is_suspended: 0,
    suspended_reason: null,
    total_points: 0,
    notification_prefs: null,
    profile_edit_log: null,
    created_at: new Date(),
    updated_at: null,
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<TournamentRefereeRow> = {}): TournamentRefereeRow {
  return {
    tournament_referee_id: 1,
    tournament_id: 20,
    user_id: 8,
    invited_by: 5,
    invitation_status: 'pending',
    is_external: 0,
    external_approval_status: 'not_required',
    approved_by: null,
    approved_at: null,
    created_at: new Date(),
    removed_at: null,
    removed_by: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('inviteReferee', () => {
  it('throws USER_NOT_FOUND when the invited user does not exist', async () => {
    mockedUserRepo.findById.mockResolvedValue(null);

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_FOUND',
    });
    expect(mockedRefRepo.findLatestByTournamentAndUser).not.toHaveBeenCalled();
  });

  it('throws REFEREE_INVITATION_PENDING when an active pending invitation already exists', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findLatestByTournamentAndUser.mockResolvedValue(
      makeInvitation({ invitation_status: 'pending', removed_at: null }),
    );

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).rejects.toMatchObject({
      status: 409,
      code: 'REFEREE_INVITATION_PENDING',
    });
    expect(mockedRefRepo.create).not.toHaveBeenCalled();
  });

  it('throws REFEREE_ALREADY_ACCEPTED when the user is already an active referee', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findLatestByTournamentAndUser.mockResolvedValue(
      makeInvitation({ invitation_status: 'accepted', removed_at: null }),
    );

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).rejects.toMatchObject({
      status: 409,
      code: 'REFEREE_ALREADY_ACCEPTED',
    });
    expect(mockedRefRepo.create).not.toHaveBeenCalled();
  });

  it('allows re-inviting when the latest invitation was already removed', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findLatestByTournamentAndUser.mockResolvedValue(
      makeInvitation({ invitation_status: 'accepted', removed_at: new Date() }),
    );
    mockedRefRepo.create.mockResolvedValue(99);

    const result = await refereeService.inviteReferee(20, 5, makeInviteInput());

    expect(mockedRefRepo.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 99, userId: 8, invitationStatus: 'pending', isExternal: false });
  });

  it('allows re-inviting when the latest active invitation was rejected', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findLatestByTournamentAndUser.mockResolvedValue(
      makeInvitation({ invitation_status: 'rejected', removed_at: null }),
    );
    mockedRefRepo.create.mockResolvedValue(99);

    await expect(refereeService.inviteReferee(20, 5, makeInviteInput())).resolves.toBeDefined();
    expect(mockedRefRepo.create).toHaveBeenCalled();
  });

  it('creates a new invitation with the correct payload when there is no prior invitation', async () => {
    mockedUserRepo.findById.mockResolvedValue(makeUser());
    mockedRefRepo.findLatestByTournamentAndUser.mockResolvedValue(null);
    mockedRefRepo.create.mockResolvedValue(100);

    const result = await refereeService.inviteReferee(20, 5, makeInviteInput({ userId: 8, isExternal: true }));

    expect(mockedRefRepo.create).toHaveBeenCalledWith({
      tournamentId: 20,
      userId: 8,
      invitedBy: 5,
      isExternal: true,
    });
    expect(result).toEqual({ id: 100, userId: 8, invitationStatus: 'pending', isExternal: true });
  });
});

describe('listTournamentReferees', () => {
  it('returns mapped referees along with a count of accepted ones', async () => {
    const rows = [makeInvitation({ tournament_referee_id: 1 }), makeInvitation({ tournament_referee_id: 2 })];
    mockedRefRepo.findLatestPerUserByTournament.mockResolvedValue(rows);
    mockedToTournamentRefereeDto
      .mockReturnValueOnce({ id: 1, invitationStatus: 'accepted' } as any)
      .mockReturnValueOnce({ id: 2, invitationStatus: 'pending' } as any);

    const result = await refereeService.listTournamentReferees(20);

    expect(mockedRefRepo.findLatestPerUserByTournament).toHaveBeenCalledWith(20);
    expect(result).toEqual({
      items: [
        { id: 1, invitationStatus: 'accepted' },
        { id: 2, invitationStatus: 'pending' },
      ],
      acceptedCount: 1,
    });
  });

  it('returns acceptedCount 0 when none of the referees have accepted', async () => {
    const rows = [makeInvitation({ tournament_referee_id: 1 })];
    mockedRefRepo.findLatestPerUserByTournament.mockResolvedValue(rows);
    mockedToTournamentRefereeDto.mockReturnValue({ id: 1, invitationStatus: 'pending' } as any);

    const result = await refereeService.listTournamentReferees(20);

    expect(result.acceptedCount).toBe(0);
  });

  it('returns an empty items array and acceptedCount 0 when there are no referees', async () => {
    mockedRefRepo.findLatestPerUserByTournament.mockResolvedValue([]);

    const result = await refereeService.listTournamentReferees(20);

    expect(result).toEqual({ items: [], acceptedCount: 0 });
  });
});

describe('listMyRefereeInvitations', () => {
  it('returns every pending invitation for the user mapped to a DTO', async () => {
    const rows = [makeInvitation({ tournament_referee_id: 1 }), makeInvitation({ tournament_referee_id: 2 })];
    mockedRefRepo.findPendingInvitationsByUser.mockResolvedValue(rows);
    mockedToMyRefereeInvitationDto
      .mockReturnValueOnce({ id: 1 } as any)
      .mockReturnValueOnce({ id: 2 } as any);

    const result = await refereeService.listMyRefereeInvitations(8);

    expect(mockedRefRepo.findPendingInvitationsByUser).toHaveBeenCalledWith(8);
    expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] });
  });

  it('returns an empty items array when the user has no pending invitations', async () => {
    mockedRefRepo.findPendingInvitationsByUser.mockResolvedValue([]);

    const result = await refereeService.listMyRefereeInvitations(8);

    expect(result).toEqual({ items: [] });
  });
});

describe('acceptRefereeInvitation', () => {
  it('throws INVITATION_NOT_FOUND when the invitation does not exist', async () => {
    mockedRefRepo.findById.mockResolvedValue(null);

    await expect(refereeService.acceptRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_NOT_FOUND when the invitation has been removed', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ removed_at: new Date() }));

    await expect(refereeService.acceptRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_NOT_FOUND when the invitation belongs to a different user', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ user_id: 999 }));

    await expect(refereeService.acceptRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_ALREADY_ANSWERED when the invitation is no longer pending', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'accepted' }));

    await expect(refereeService.acceptRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
    expect(mockedRefRepo.accept).not.toHaveBeenCalled();
  });

  it('throws INVITATION_ALREADY_ANSWERED when accept() fails a race with a concurrent response', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'pending' }));
    mockedRefRepo.accept.mockResolvedValue(false as any);

    await expect(refereeService.acceptRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
  });

  it('accepts a pending invitation and flags admin approval for external referees', async () => {
    mockedRefRepo.findById.mockResolvedValue(
      makeInvitation({ invitation_status: 'pending', is_external: 1 }),
    );
    mockedRefRepo.accept.mockResolvedValue(true as any);

    const result = await refereeService.acceptRefereeInvitation(1, 8);

    expect(mockedRefRepo.accept).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1, invitationStatus: 'accepted', requiresAdminApproval: true });
  });

  it('accepts a pending invitation without admin approval for internal referees', async () => {
    mockedRefRepo.findById.mockResolvedValue(
      makeInvitation({ invitation_status: 'pending', is_external: 0 }),
    );
    mockedRefRepo.accept.mockResolvedValue(true as any);

    const result = await refereeService.acceptRefereeInvitation(1, 8);

    expect(result).toEqual({ id: 1, invitationStatus: 'accepted', requiresAdminApproval: false });
  });
});

describe('declineRefereeInvitation', () => {
  it('throws INVITATION_NOT_FOUND when the invitation does not exist', async () => {
    mockedRefRepo.findById.mockResolvedValue(null);

    await expect(refereeService.declineRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_NOT_FOUND when the invitation has been removed', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ removed_at: new Date() }));

    await expect(refereeService.declineRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_NOT_FOUND when the invitation belongs to a different user', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ user_id: 999 }));

    await expect(refereeService.declineRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('throws INVITATION_ALREADY_ANSWERED when the invitation is no longer pending', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'rejected' }));

    await expect(refereeService.declineRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
    expect(mockedRefRepo.decline).not.toHaveBeenCalled();
  });

  it('throws INVITATION_ALREADY_ANSWERED when decline() fails a race with a concurrent response', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'pending' }));
    mockedRefRepo.decline.mockResolvedValue(false as any);

    await expect(refereeService.declineRefereeInvitation(1, 8)).rejects.toMatchObject({
      status: 409,
      code: 'INVITATION_ALREADY_ANSWERED',
    });
  });

  it('declines a pending invitation', async () => {
    mockedRefRepo.findById.mockResolvedValue(makeInvitation({ invitation_status: 'pending' }));
    mockedRefRepo.decline.mockResolvedValue(true as any);

    const result = await refereeService.declineRefereeInvitation(1, 8);

    expect(mockedRefRepo.decline).toHaveBeenCalledWith(1);
    expect(result).toBeUndefined();
  });
});
