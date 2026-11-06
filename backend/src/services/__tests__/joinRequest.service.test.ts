import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/joinRequest.repo.js', () => ({
  findById: vi.fn(), findPendingByTeamAndUser: vi.fn(async () => null), create: vi.fn(async () => 77),
  findPendingByTeam: vi.fn(async () => []), findByUser: vi.fn(async () => []),
  settle: vi.fn(async () => true), approve: vi.fn(async () => true),
}));
vi.mock('../../repositories/team.repo.js', () => ({
  findById: vi.fn(), isMemberOf: vi.fn(async () => null), countUnofficialTeamsByUser: vi.fn(async () => 0), countMemberByTeamId: vi.fn(async () => 3),
}));
vi.mock('../../repositories/sportType.repo.js', () => ({ findSportTypeById: vi.fn(async () => ({ sport_type_id: 1, min_members: 5, max_members: 11 })) }));
vi.mock('../../repositories/application.repo.js', () => ({ findTeamTournamentConflictForUser: vi.fn(async () => null) }));
vi.mock('../../utils/checkExist.js', () => ({ checkTeam: vi.fn() }));

import * as Service from '../joinRequest.service.js';
import * as JoinRepo from '../../repositories/joinRequest.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as ApplicationRepo from '../../repositories/application.repo.js';
import { checkTeam } from '../../utils/checkExist.js';
import type { TeamRow, TeamJoinRequestRow } from '../../types/db.js';

const team = (o: Partial<TeamRow> = {}) => ({ team_id: 10, leader_id: 1, sport_type_id: 1, visibility: 'public', deleted_at: null, readiness_status: 'Forming', ...o }) as TeamRow;
const request = (o: Partial<TeamJoinRequestRow> = {}) => ({ team_join_request_id: 77, team_id: 10, user_id: 8, team_join_request_status: 'pending', ...o }) as TeamJoinRequestRow;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkTeam).mockResolvedValue(team());
  vi.mocked(TeamRepo.findById).mockResolvedValue(team({ readiness_status: 'Ready' }));
});

describe('createJoinRequest (T20)', () => {
  it('creates a pending request on a public team', async () => {
    await expect(Service.createJoinRequest(10, 8, 'รับผมด้วย')).resolves.toEqual({ id: 77, teamId: 10, status: 'pending' });
    expect(JoinRepo.create).toHaveBeenCalledWith(10, 8, 'รับผมด้วย');
  });
  it('409 TEAM_PRIVATE on a private team', async () => {
    vi.mocked(checkTeam).mockResolvedValue(team({ visibility: 'private' }));
    await expect(Service.createJoinRequest(10, 8, undefined)).rejects.toMatchObject({ status: 409, code: 'TEAM_PRIVATE' });
  });
  it.each([
    ['ALREADY_MEMBER', () => vi.mocked(TeamRepo.isMemberOf).mockResolvedValueOnce({} as never), 409],
    ['TEAM_CONFLICT_OF_INTEREST', () => vi.mocked(ApplicationRepo.findTeamTournamentConflictForUser).mockResolvedValueOnce({ tournament_id: 3, name: 'T', role: 'referee', invitation_status: 'accepted', expires_at: null }), 409],
    ['TEAM_QUOTA_EXCEEDED', () => vi.mocked(TeamRepo.countUnofficialTeamsByUser).mockResolvedValueOnce(5), 422],
    ['JOIN_REQUEST_PENDING', () => vi.mocked(JoinRepo.findPendingByTeamAndUser).mockResolvedValueOnce(request()), 409],
  ])('%s blocks the request', async (code, arrange, status) => {
    arrange();
    await expect(Service.createJoinRequest(10, 8, undefined)).rejects.toMatchObject({ status, code });
    expect(JoinRepo.create).not.toHaveBeenCalled();
  });
});

describe('approve / reject / cancel (T22 T23 T25)', () => {
  it('approve re-checks the join rules and adds the member', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValue(request());
    await expect(Service.approveJoinRequest(10, 77, 1)).resolves.toEqual({ id: 77, userId: 8, status: 'approved', teamReadinessStatus: 'Ready' });
    expect(JoinRepo.approve).toHaveBeenCalledWith(77, 10, 8, 1);
  });
  it('request of another team → 404; already answered → 409', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request({ team_id: 99 }));
    await expect(Service.rejectJoinRequest(10, 77, 1, undefined)).rejects.toMatchObject({ status: 404, code: 'JOIN_REQUEST_NOT_FOUND' });
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request({ team_join_request_status: 'approved' }));
    await expect(Service.rejectJoinRequest(10, 77, 1, undefined)).rejects.toMatchObject({ status: 409, code: 'JOIN_REQUEST_ALREADY_ANSWERED' });
  });
  it('only the requester can cancel, and only while pending', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request());
    await expect(Service.cancelJoinRequest(77, 9)).rejects.toMatchObject({ status: 404 });
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request());
    await Service.cancelJoinRequest(77, 8);
    expect(JoinRepo.settle).toHaveBeenCalledWith(77, 'cancelled', null, null);
  });
});

// ─────────────────────────── paths not covered above ───────────────────────────

const conflict = (o: Record<string, unknown> = {}) => ({
  tournament_id: 3, name: 'ลีกฤดูหนาว', role: 'referee', invitation_status: 'accepted', expires_at: null, ...o,
});

describe('createJoinRequest (T20) — more rules', () => {
  it('409 ALREADY_MEMBER when the leader asks to join their own team', async () => {
    await expect(Service.createJoinRequest(10, 1, undefined)).rejects.toMatchObject({ status: 409, code: 'ALREADY_MEMBER' });
    expect(TeamRepo.isMemberOf).not.toHaveBeenCalled();
    expect(JoinRepo.create).not.toHaveBeenCalled();
  });

  it('404 TEAM_NOT_FOUND for a soft-deleted team', async () => {
    vi.mocked(checkTeam).mockResolvedValue(team({ deleted_at: new Date() as never }));
    await expect(Service.createJoinRequest(10, 8, undefined)).rejects.toMatchObject({ status: 404, code: 'TEAM_NOT_FOUND' });
    expect(JoinRepo.create).not.toHaveBeenCalled();
  });

  it('stores a missing message as null', async () => {
    await Service.createJoinRequest(10, 8, undefined);
    expect(JoinRepo.create).toHaveBeenCalledWith(10, 8, null);
  });

  it('keeps an empty-string message as is (only undefined becomes null)', async () => {
    await Service.createJoinRequest(10, 8, '');
    expect(JoinRepo.create).toHaveBeenCalledWith(10, 8, '');
  });

  it('allows exactly 4 unofficial teams (quota is reached at 5)', async () => {
    vi.mocked(TeamRepo.countUnofficialTeamsByUser).mockResolvedValueOnce(4);
    await expect(Service.createJoinRequest(10, 8, undefined)).resolves.toMatchObject({ status: 'pending' });
  });

  it('checks team privacy before anything else', async () => {
    vi.mocked(checkTeam).mockResolvedValue(team({ visibility: 'private', deleted_at: new Date() as never }));
    await expect(Service.createJoinRequest(10, 8, undefined)).rejects.toMatchObject({ code: 'TEAM_PRIVATE' });
  });

  it('propagates checkTeam failures (team does not exist)', async () => {
    const err = Object.assign(new Error('x'), { status: 404, code: 'TEAM_NOT_FOUND' });
    vi.mocked(checkTeam).mockRejectedValueOnce(err);
    await expect(Service.createJoinRequest(10, 8, undefined)).rejects.toBe(err);
  });
});

describe('TEAM_CONFLICT_OF_INTEREST details', () => {
  it('carries tournamentId, role, invitationStatus and expiresAt=null for an accepted role', async () => {
    vi.mocked(ApplicationRepo.findTeamTournamentConflictForUser).mockResolvedValueOnce(conflict() as never);

    const err = await Service.createJoinRequest(10, 8, undefined).catch((e) => e);

    expect(err).toMatchObject({
      status: 409,
      code: 'TEAM_CONFLICT_OF_INTEREST',
      extra: { tournamentId: 3, role: 'referee', invitationStatus: 'accepted', expiresAt: null },
    });
    expect(err.message).toContain('ลีกฤดูหนาว');
    expect(err.message).toContain('กรรมการ');
  });

  it('serialises expiresAt to ISO for a pending invitation, and says it is still pending', async () => {
    const expires = new Date('2026-11-05T10:00:00Z');
    vi.mocked(ApplicationRepo.findTeamTournamentConflictForUser).mockResolvedValueOnce(
      conflict({ invitation_status: 'pending', expires_at: expires }) as never,
    );

    const err = await Service.createJoinRequest(10, 8, undefined).catch((e) => e);

    expect(err.extra).toMatchObject({ invitationStatus: 'pending', expiresAt: '2026-11-05T10:00:00.000Z' });
    expect(err.message).toContain('ยังไม่ได้ตอบรับ');
  });

  it('names the organizer role correctly', async () => {
    vi.mocked(ApplicationRepo.findTeamTournamentConflictForUser).mockResolvedValueOnce(conflict({ role: 'organizer' }) as never);
    const err = await Service.createJoinRequest(10, 8, undefined).catch((e) => e);
    expect(err.message).toContain('ผู้จัด');
    expect(err.extra.role).toBe('organizer');
  });

  it('is checked against the team and the joining user', async () => {
    await Service.createJoinRequest(10, 8, undefined);
    expect(ApplicationRepo.findTeamTournamentConflictForUser).toHaveBeenCalledWith(10, 8);
  });
});

describe('listJoinRequests (T21)', () => {
  it('maps every pending request of the team to a DTO', async () => {
    const createdAt = new Date('2026-10-01T03:00:00Z');
    vi.mocked(JoinRepo.findPendingByTeam).mockResolvedValueOnce([
      { ...request(), message: 'รับด้วย', created_at: createdAt, user_id: 8, full_name: 'ก', avatar_key: null },
      { ...request({ team_join_request_id: 78, user_id: 9 }), message: null, created_at: createdAt, full_name: 'ข', avatar_key: null },
    ] as never);

    const result = await Service.listJoinRequests(10);

    expect(JoinRepo.findPendingByTeam).toHaveBeenCalledWith(10);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: 77, message: 'รับด้วย', status: 'pending', createdAt: '2026-10-01T03:00:00.000Z' });
    expect(result.items[1]).toMatchObject({ id: 78, message: null });
  });

  it('returns an empty list when there is nothing pending', async () => {
    await expect(Service.listJoinRequests(10)).resolves.toEqual({ items: [] });
  });
});

describe('listMyJoinRequests (T24)', () => {
  it('maps the caller\'s requests, including team info and answered times', async () => {
    vi.mocked(JoinRepo.findByUser).mockResolvedValueOnce([
      {
        ...request({ team_join_request_status: 'rejected' }),
        team_name: 'ทีมแมว', sport_type_id: 2, message: null, reject_reason: 'เต็มแล้ว',
        created_at: new Date('2026-10-01T00:00:00Z'), responded_at: new Date('2026-10-02T00:00:00Z'),
      },
      {
        ...request({ team_join_request_id: 80 }),
        team_name: 'ทีมหมา', sport_type_id: 1, message: 'ขอเข้า', reject_reason: null,
        created_at: new Date('2026-10-03T00:00:00Z'), responded_at: null,
      },
    ] as never);

    const result = await Service.listMyJoinRequests(8);

    expect(JoinRepo.findByUser).toHaveBeenCalledWith(8);
    expect(result.items).toEqual([
      {
        id: 77, team: { id: 10, name: 'ทีมแมว', sportTypeId: 2 }, message: null, status: 'rejected',
        rejectReason: 'เต็มแล้ว', createdAt: '2026-10-01T00:00:00.000Z', respondedAt: '2026-10-02T00:00:00.000Z',
      },
      {
        id: 80, team: { id: 10, name: 'ทีมหมา', sportTypeId: 1 }, message: 'ขอเข้า', status: 'pending',
        rejectReason: null, createdAt: '2026-10-03T00:00:00.000Z', respondedAt: null,
      },
    ]);
  });

  it('returns an empty list when the user has no requests', async () => {
    await expect(Service.listMyJoinRequests(8)).resolves.toEqual({ items: [] });
  });
});

describe('approveJoinRequest (T22) — more paths', () => {
  it('404 when the request does not exist', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(null as never);
    await expect(Service.approveJoinRequest(10, 77, 1)).rejects.toMatchObject({ status: 404, code: 'JOIN_REQUEST_NOT_FOUND' });
    expect(JoinRepo.approve).not.toHaveBeenCalled();
  });

  it('re-checks the rules for the requester at approval time (quota filled since asking)', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValue(request());
    vi.mocked(TeamRepo.countUnofficialTeamsByUser).mockResolvedValueOnce(5);

    await expect(Service.approveJoinRequest(10, 77, 1)).rejects.toMatchObject({ status: 422, code: 'TEAM_QUOTA_EXCEEDED' });
    expect(TeamRepo.countUnofficialTeamsByUser).toHaveBeenCalledWith(8);
    expect(JoinRepo.approve).not.toHaveBeenCalled();
  });

  it('re-checks membership (requester joined by invitation meanwhile)', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValue(request());
    vi.mocked(TeamRepo.isMemberOf).mockResolvedValueOnce({} as never);

    await expect(Service.approveJoinRequest(10, 77, 1)).rejects.toMatchObject({ code: 'ALREADY_MEMBER' });
    expect(TeamRepo.isMemberOf).toHaveBeenCalledWith(10, 8);
  });

  it('409 ALREADY_ANSWERED when the request was answered concurrently (approve affected 0 rows)', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValue(request());
    vi.mocked(JoinRepo.approve).mockResolvedValueOnce(false as never);

    await expect(Service.approveJoinRequest(10, 77, 1)).rejects.toMatchObject({ status: 409, code: 'JOIN_REQUEST_ALREADY_ANSWERED' });
    expect(TeamRepo.findById).not.toHaveBeenCalled();
  });

  it('409 ALREADY_ANSWERED for a request that is no longer pending', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request({ team_join_request_status: 'cancelled' }));
    await expect(Service.approveJoinRequest(10, 77, 1)).rejects.toMatchObject({ code: 'JOIN_REQUEST_ALREADY_ANSWERED' });
  });
});

describe('rejectJoinRequest (T23) — more paths', () => {
  it('rejects with the leader id and reason, returns the new status', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request());

    await expect(Service.rejectJoinRequest(10, 77, 1, 'ตำแหน่งเต็ม')).resolves.toEqual({ id: 77, status: 'rejected' });
    expect(JoinRepo.settle).toHaveBeenCalledWith(77, 'rejected', 1, 'ตำแหน่งเต็ม');
  });

  it('stores a missing reason as null', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request());
    await Service.rejectJoinRequest(10, 77, 1, undefined);
    expect(JoinRepo.settle).toHaveBeenCalledWith(77, 'rejected', 1, null);
  });

  it('does not re-check the join rules (rejecting is always allowed)', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request());
    await Service.rejectJoinRequest(10, 77, 1, undefined);
    expect(TeamRepo.isMemberOf).not.toHaveBeenCalled();
    expect(checkTeam).not.toHaveBeenCalled();
  });

  it('409 ALREADY_ANSWERED when settle affected 0 rows (race)', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request());
    vi.mocked(JoinRepo.settle).mockResolvedValueOnce(false as never);
    await expect(Service.rejectJoinRequest(10, 77, 1, undefined)).rejects.toMatchObject({ status: 409, code: 'JOIN_REQUEST_ALREADY_ANSWERED' });
  });

  it('404 when the request does not exist', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(null as never);
    await expect(Service.rejectJoinRequest(10, 77, 1, undefined)).rejects.toMatchObject({ status: 404 });
  });
});

describe('cancelJoinRequest (T25) — more paths', () => {
  it('404 when the request does not exist', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(null as never);
    await expect(Service.cancelJoinRequest(77, 8)).rejects.toMatchObject({ status: 404, code: 'JOIN_REQUEST_NOT_FOUND' });
    expect(JoinRepo.settle).not.toHaveBeenCalled();
  });

  it.each(['approved', 'rejected', 'cancelled'])('409 when the request is already %s', async (status) => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request({ team_join_request_status: status as never }));
    await expect(Service.cancelJoinRequest(77, 8)).rejects.toMatchObject({ status: 409, code: 'JOIN_REQUEST_ALREADY_ANSWERED' });
    expect(JoinRepo.settle).not.toHaveBeenCalled();
  });

  it('resolves to undefined on success', async () => {
    vi.mocked(JoinRepo.findById).mockResolvedValueOnce(request());
    await expect(Service.cancelJoinRequest(77, 8)).resolves.toBeUndefined();
  });
});
