import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/matchHistory.repo.js', () => ({
    findVerifiedMatchHistoryByUser: vi.fn(),
    findStatsForUserMatches: vi.fn(),
}));
vi.mock('../../utils/checkExist.js', () => ({ checkUser: vi.fn() }));

import * as Repo from '../../repositories/matchHistory.repo.js';
import { checkUser } from '../../utils/checkExist.js';
import * as Service from '../matchHistory.service.js';

const repo = vi.mocked(Repo);
const mockedCheckUser = vi.mocked(checkUser);

beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckUser.mockResolvedValue({} as any);
    repo.findVerifiedMatchHistoryByUser.mockResolvedValue([]);
    repo.findStatsForUserMatches.mockResolvedValue([]);
});

describe('matchHistory.service', () => {
    it('checks the user and returns empty history cleanly', async () => {
        await expect(Service.getMatchHistory(3)).resolves.toEqual({ items: [] });
        expect(mockedCheckUser).toHaveBeenCalledWith(3);
        expect(repo.findStatsForUserMatches).toHaveBeenCalledWith(3, []);
    });

    it('groups player stats by match before mapping', async () => {
        repo.findVerifiedMatchHistoryByUser.mockResolvedValue([{ match_id: 10, my_team_id: 5, winner_team_id: 5 } as any]);
        repo.findStatsForUserMatches.mockResolvedValue([
            { match_id: 10, stat_key: 'goals', stat_label_th: 'เธเธฃเธฐเธ•เธน', value_int: 2 },
            { match_id: 10, stat_key: 'assists', stat_label_th: 'เนเธญเธชเธเธดเธชเธ•เน', value_int: 1 },
        ]);
        const result = await Service.getMatchHistory(3);
        expect(result.items[0]?.playerStats).toHaveLength(2);
    });
});
