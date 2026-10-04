import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/matchResult.repo.js', () => ({
  recordPlayerStat: vi.fn(),
  allPlayerInMatch: vi.fn(),
  showPlayerStat: vi.fn(),
}));
vi.mock('../../repositories/match.repo.js', () => ({}));
vi.mock('../../repositories/team.repo.js', () => ({ findTeamIdOfUserInMatch: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({ findStatDefinitionsBySportType: vi.fn() }));
vi.mock('../../utils/checkExist.js', () => ({ checkMatch: vi.fn(), checkTournament: vi.fn() }));
vi.mock('../walkover.service.js', () => ({}));
vi.mock('../../middlewares/requireReferee.js', () => ({}));
// 🔴 OD-58 (4 ต.ค.) — canSeeUnfinishedResult() ถาม AdminRepo ด้วยแล้ว (แอดมินที่ถึงคิวตัดสินต้องอ่านได้)
// ถ้าไม่ mock ที่นี่ เทสจะไปต่อฐานจริง แล้ว "ผ่าน" เฉพาะตอนที่เครื่องมี MySQL รันอยู่
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(() => Promise.resolve(null)) }));

import * as Service from '../matchResult.service.js';
import * as Repo from '../../repositories/matchResult.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as SportTypeRepo from '../../repositories/sportType.repo.js';
import * as CheckExist from '../../utils/checkExist.js';

const mockedRepo = vi.mocked(Repo);
const mockedTeamRepo = vi.mocked(TeamRepo);
const mockedSportTypeRepo = vi.mocked(SportTypeRepo);
const mockedCheckExist = vi.mocked(CheckExist);

beforeEach(() => {
  vi.resetAllMocks();
  mockedCheckExist.checkMatch.mockResolvedValue({ match_id: 1, tournament_id: 50 } as any);
  mockedCheckExist.checkTournament.mockResolvedValue({ tournament_id: 50, sport_type_id: 1 } as any);
  mockedSportTypeRepo.findStatDefinitionsBySportType.mockResolvedValue([
    { sport_stat_definition_id: 100 }, { sport_stat_definition_id: 200 },
  ] as any);
});

describe('updatePlayerStat', () => {
  it('throws UNKNOWN_STAT_DEFINITION before touching the team lookup or writing anything', async () => {
    const playerStats = [{ userId: 1, values: [{ statDefinitionId: 999, value: 5 }] }];

    await expect(Service.updatePlayerStat(1, 7, playerStats)).rejects.toMatchObject({
      status: 400,
      code: 'UNKNOWN_STAT_DEFINITION',
    });
    expect(mockedTeamRepo.findTeamIdOfUserInMatch).not.toHaveBeenCalled();
    expect(mockedRepo.recordPlayerStat).not.toHaveBeenCalled();
  });

  it('throws USER_NOT_IN_MATCH and writes nothing at all, even for a player earlier in the list who was valid', async () => {
    mockedTeamRepo.findTeamIdOfUserInMatch.mockImplementation(async (userId: number) =>
      userId === 1 ? { teamId: 10 } : null,
    );
    const playerStats = [
      { userId: 1, values: [{ statDefinitionId: 100, value: 5 }] },
      { userId: 2, values: [{ statDefinitionId: 100, value: 3 }] }, // not in match
    ];

    await expect(Service.updatePlayerStat(1, 7, playerStats)).rejects.toMatchObject({
      status: 404,
      code: 'USER_NOT_IN_MATCH',
    });
    expect(mockedRepo.recordPlayerStat).not.toHaveBeenCalled();
  });

  it('records stats for every player once all validation passes, and totals recordedCount across all of them', async () => {
    mockedTeamRepo.findTeamIdOfUserInMatch.mockImplementation(async (userId: number) => ({ teamId: userId === 1 ? 10 : 11 }));
    const playerStats = [
      { userId: 1, values: [{ statDefinitionId: 100, value: 5 }, { statDefinitionId: 200, value: 2 }] },
      { userId: 2, values: [{ statDefinitionId: 100, value: 1 }] },
    ];

    const result = await Service.updatePlayerStat(1, 7, playerStats);

    expect(mockedRepo.recordPlayerStat).toHaveBeenCalledWith(1, 1, 10, 7, playerStats[0]!.values);
    expect(mockedRepo.recordPlayerStat).toHaveBeenCalledWith(1, 2, 11, 7, playerStats[1]!.values);
    expect(result).toEqual({ matchId: 1, recordedCount: 3 });
  });
});

describe('getPlayerMatchStat', () => {
  it('fetches per-player stats for every player in the match and maps them', async () => {
    mockedRepo.allPlayerInMatch.mockResolvedValue([
      { userId: 1, fullName: 'สมชาย' },
      { userId: 2, fullName: 'สมหญิง' },
    ] as any);
    mockedRepo.showPlayerStat.mockImplementation(async (_matchId: number, userId: number) =>
      userId === 1 ? [{ statKey: 'goals', statLabelTh: 'ประตู', value: 2 }] : [],
    );

    const result = await Service.getPlayerMatchStat(1);

    expect(mockedRepo.showPlayerStat).toHaveBeenCalledWith(1, 1);
    expect(mockedRepo.showPlayerStat).toHaveBeenCalledWith(1, 2);
    expect(result).toEqual({
      items: [
        { userId: 1, fullName: 'สมชาย', stats: [{ statKey: 'goals', statLabelTh: 'ประตู', value: 2 }] },
        { userId: 2, fullName: 'สมหญิง', stats: [] },
      ],
    });
  });

  it('returns an empty items array when nobody played in the match', async () => {
    mockedRepo.allPlayerInMatch.mockResolvedValue([]);

    const result = await Service.getPlayerMatchStat(1);

    expect(result).toEqual({ items: [] });
    expect(mockedRepo.showPlayerStat).not.toHaveBeenCalled();
  });
});
