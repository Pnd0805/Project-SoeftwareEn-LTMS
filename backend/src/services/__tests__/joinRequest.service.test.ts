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
    ['TEAM_CONFLICT_OF_INTEREST', () => vi.mocked(ApplicationRepo.findTeamTournamentConflictForUser).mockResolvedValueOnce({ tournament_id: 3, name: 'T', role: 'referee' }), 409],
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
