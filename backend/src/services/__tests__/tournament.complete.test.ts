import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
  findUnfinishedMatchIds: vi.fn(async () => []),
  completeTournament: vi.fn(async () => true),
}));
vi.mock('../../repositories/match.repo.js', () => ({ countMatchesByTournament: vi.fn(async () => 7) }));
vi.mock('../matchResult.service.js', () => ({ resolveChampionTeamId: vi.fn(async () => 11) }));
vi.mock('../../repositories/adminScope.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../referee.service.js', () => ({}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn() }));

import * as Service from '../tournament.service.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as MatchResultService from '../matchResult.service.js';
import type { TournamentRow } from '../../types/db.js';

const tournament = (o: Partial<TournamentRow> = {}) => ({
  tournament_id: 50, sport_type_id: 1, bracket_format: 'single_elimination', tournament_status: 'public', ...o,
}) as unknown as TournamentRow;

beforeEach(() => vi.clearAllMocks());

// B1 (มติ 21 ก.ย.): 1-ข ORG กดปิด · 2-ง ผลข้างเคียงใน repo tx · 4-ก แชมป์ null ได้
describe('completeTournament (POST /tournaments/:id/complete)', () => {
  it('closes a public tournament whose matches are all completed and records the champion', async () => {
    await expect(Service.completeTournament(tournament(), 9)).resolves.toEqual({ id: 50, status: 'completed', championTeamId: 11 });
    expect(TournamentRepo.completeTournament).toHaveBeenCalledWith(50, 9, 11, 1);
  });

  it('closes with no champion when the final was a double forfeit', async () => {
    vi.mocked(MatchResultService.resolveChampionTeamId).mockResolvedValueOnce(null);
    await expect(Service.completeTournament(tournament({ tournament_status: 'private' }), 9)).resolves.toMatchObject({ championTeamId: null });
    expect(TournamentRepo.completeTournament).toHaveBeenCalledWith(50, 9, null, 1);
  });

  it('409 MATCHES_UNFINISHED listing the open matches', async () => {
    vi.mocked(TournamentRepo.findUnfinishedMatchIds).mockResolvedValueOnce([{ match_id: 3, match_status: 'disputed' }, { match_id: 4, match_status: 'scheduled' }]);
    await expect(Service.completeTournament(tournament(), 9)).rejects.toMatchObject({
      status: 409, code: 'MATCHES_UNFINISHED', extra: { matches: [{ id: 3, status: 'disputed' }, { id: 4, status: 'scheduled' }] },
    });
    expect(TournamentRepo.completeTournament).not.toHaveBeenCalled();
  });

  it('409 NO_MATCHES when no bracket was ever drawn', async () => {
    vi.mocked(MatchRepo.countMatchesByTournament).mockResolvedValueOnce(0);
    await expect(Service.completeTournament(tournament(), 9)).rejects.toMatchObject({ status: 409, code: 'NO_MATCHES' });
  });

  it.each([
    ['completed', 'TOURNAMENT_COMPLETED'],
    ['pending_approval', 'INVALID_STATUS_TRANSITION'],
    ['rejected', 'INVALID_STATUS_TRANSITION'],
  ] as const)('%s → 409 %s', async (status, code) => {
    await expect(Service.completeTournament(tournament({ tournament_status: status }), 9)).rejects.toMatchObject({ status: 409, code });
  });

  it('409 INVALID_STATUS_TRANSITION when the row changed under us', async () => {
    vi.mocked(TournamentRepo.completeTournament).mockResolvedValueOnce(false);
    await expect(Service.completeTournament(tournament(), 9)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
  });
});
