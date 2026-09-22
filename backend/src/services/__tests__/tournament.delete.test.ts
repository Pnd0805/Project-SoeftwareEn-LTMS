import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/tournament.repo.js', () => ({
  countApplicationsByTournament: vi.fn(async () => 0),
  softDeleteTournament: vi.fn(async () => true),
}));
vi.mock('../../repositories/match.repo.js', () => ({ countMatchesByTournament: vi.fn(async () => 0) }));
vi.mock('../matchResult.service.js', () => ({}));
vi.mock('../../repositories/adminScope.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../referee.service.js', () => ({}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn() }));
vi.mock('../../middlewares/requireOrganizer.js', () => ({ isRequesterOf: vi.fn() }));

import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as Service from '../tournament.service.js';
import type { TournamentRow } from '../../types/db.js';

const tournament = (status: TournamentRow['tournament_status']) => ({
  tournament_id: 50,
  tournament_status: status,
}) as TournamentRow;

beforeEach(() => vi.clearAllMocks());

describe('deleteTournament (DELETE /tournaments/:id)', () => {
  it.each(['pending_approval', 'rejected', 'private'] as const)('soft-deletes an unused %s tournament', async (status) => {
    await expect(Service.deleteTournament(tournament(status), 9)).resolves.toBeUndefined();
    expect(TournamentRepo.softDeleteTournament).toHaveBeenCalledWith(50, 9);
  });

  it('requires public tournaments to be unpublished first', async () => {
    await expect(Service.deleteTournament(tournament('public'), 9)).rejects.toMatchObject({
      status: 409,
      code: 'TOURNAMENT_MUST_BE_UNPUBLISHED',
    });
    expect(TournamentRepo.softDeleteTournament).not.toHaveBeenCalled();
  });

  it('never deletes completed tournaments', async () => {
    await expect(Service.deleteTournament(tournament('completed'), 9)).rejects.toMatchObject({
      status: 409,
      code: 'TOURNAMENT_COMPLETED',
    });
  });

  it('blocks deletion after applications or matches exist', async () => {
    vi.mocked(TournamentRepo.countApplicationsByTournament).mockResolvedValueOnce(2);
    vi.mocked(MatchRepo.countMatchesByTournament).mockResolvedValueOnce(3);
    await expect(Service.deleteTournament(tournament('private'), 9)).rejects.toMatchObject({
      status: 409,
      code: 'TOURNAMENT_HAS_ACTIVITY',
      extra: { applications: 2, matches: 3 },
    });
    expect(TournamentRepo.softDeleteTournament).not.toHaveBeenCalled();
  });

  it('fails safely if the row changed before the soft-delete update', async () => {
    vi.mocked(TournamentRepo.softDeleteTournament).mockResolvedValueOnce(false);
    await expect(Service.deleteTournament(tournament('private'), 9)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATUS_TRANSITION',
    });
  });
});
