import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/matchResult.repo.js', () => ({ findStandings: vi.fn(), findFinalMatchResult: vi.fn() }));
vi.mock('../../repositories/match.repo.js', () => ({}));
vi.mock('../../repositories/tournament.repo.js', () => ({}));
vi.mock('../../repositories/team.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../walkover.service.js', () => ({}));
vi.mock('../../middlewares/requireReferee.js', () => ({}));
vi.mock('../../utils/checkExist.js', () => ({}));

import * as Service from '../matchResult.service.js';
import * as Repo from '../../repositories/matchResult.repo.js';
import type { TournamentRow } from '../../types/db.js';

const rr = { tournament_id: 50, bracket_format: 'round_robin' } as unknown as TournamentRow;
const se = { tournament_id: 50, bracket_format: 'single_elimination' } as unknown as TournamentRow;
const row = (team_id: number, points: number, gf = 0, ga = 0) =>
  ({ team_id, name: 'T' + team_id, sport_type_id: 1, played: 3, won: points / 3, lost: 3 - points / 3, points, goals_for: gf, goals_against: ga });

beforeEach(() => vi.clearAllMocks());

// B1 — แชมป์ตอนปิดทัวร์
describe('resolveChampionTeamId', () => {
  it('round robin: top of the table', async () => {
    vi.mocked(Repo.findStandings).mockResolvedValue([row(2, 9, 6, 1), row(1, 6, 4, 3), row(3, 0)]);
    await expect(Service.resolveChampionTeamId(rr)).resolves.toBe(2);
  });
  it('round robin: level on every criterion at the top → no champion', async () => {
    vi.mocked(Repo.findStandings).mockResolvedValue([row(1, 6, 4, 2), row(2, 6, 4, 2), row(3, 0)]);
    await expect(Service.resolveChampionTeamId(rr)).resolves.toBeNull();
  });
  it('round robin: goal difference separates equal points', async () => {
    vi.mocked(Repo.findStandings).mockResolvedValue([row(1, 6, 5, 2), row(2, 6, 4, 2), row(3, 0)]);
    await expect(Service.resolveChampionTeamId(rr)).resolves.toBe(1);
  });
  it('elimination: winner of the final, null on a double forfeit', async () => {
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce({ winner_team_id: 7 } as never);
    await expect(Service.resolveChampionTeamId(se)).resolves.toBe(7);
    vi.mocked(Repo.findFinalMatchResult).mockResolvedValueOnce({ winner_team_id: null } as never);
    await expect(Service.resolveChampionTeamId(se)).resolves.toBeNull();
  });
});
