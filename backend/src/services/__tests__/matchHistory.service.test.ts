import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/matchHistory.repo.js', () => ({
    findVerifiedMatchHistoryByUser: vi.fn(),
    findStatsForUserMatches: vi.fn(),
}));
vi.mock('../../utils/checkExist.js', () => ({ checkUser: vi.fn() }));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn() }));

import * as Repo from '../../repositories/matchHistory.repo.js';
import { checkUser } from '../../utils/checkExist.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as Service from '../matchHistory.service.js';

const repo = vi.mocked(Repo);
const mockedCheckUser = vi.mocked(checkUser);
const mockedAdminRepo = vi.mocked(AdminRepo);

// show_profile_stats = 1 คือค่าเริ่มต้นของทุกแถว (migration 035) — เส้นปกติต้องไม่เปลี่ยนพฤติกรรม
beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckUser.mockResolvedValue({ user_id: 3, show_profile_stats: 1 } as any);
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(null);
    repo.findVerifiedMatchHistoryByUser.mockResolvedValue([]);
    repo.findStatsForUserMatches.mockResolvedValue([]);
});

describe('matchHistory.service', () => {
    it('checks the user and returns empty history cleanly', async () => {
        await expect(Service.getMatchHistory(3)).resolves.toEqual({ items: [], statsHidden: false });
        expect(mockedCheckUser).toHaveBeenCalledWith(3);
        expect(repo.findStatsForUserMatches).toHaveBeenCalledWith(3, []);
    });

    it('groups player stats by match before mapping', async () => {
        repo.findVerifiedMatchHistoryByUser.mockResolvedValue([{ match_id: 10, my_team_id: 5, winner_team_id: 5 } as any]);
        repo.findStatsForUserMatches.mockResolvedValue([
            { match_id: 10, stat_key: 'goals', stat_label_th: 'ประตู', value_int: 2 },
            { match_id: 10, stat_key: 'assists', stat_label_th: 'แอสซิสต์', value_int: 1 },
        ]);
        const result = await Service.getMatchHistory(3);
        expect(result.items[0]?.playerStats).toHaveLength(2);
    });

    /**
     * OD-46 — เจ้าของโปรไฟล์ปิดการแสดงสถิติ · ด่านเดียวกับ U04/U14 (utils/profileStats)
     * items เป็น null ไม่ใช่ [] เพราะ [] อ่านได้ว่า "ไม่เคยลงแข่ง" ซึ่งเป็นคำตอบที่ผิด
     */
    describe('OD-46 — เจ้าของปิดการแสดงสถิติ', () => {
        beforeEach(() => {
            mockedCheckUser.mockResolvedValue({ user_id: 3, show_profile_stats: 0 } as any);
        });

        it('คนที่ไม่ล็อกอินได้ items เป็น null และไม่ไปแตะ repo เลย', async () => {
            await expect(Service.getMatchHistory(3)).resolves.toEqual({ items: null, statsHidden: true });
            expect(repo.findVerifiedMatchHistoryByUser).not.toHaveBeenCalled();
            expect(repo.findStatsForUserMatches).not.toHaveBeenCalled();
        });

        it('คนอื่นที่ล็อกอินแต่ไม่ใช่แอดมิน ก็ไม่เห็น', async () => {
            await expect(Service.getMatchHistory(3, 9999)).resolves.toEqual({ items: null, statsHidden: true });
        });

        it('เจ้าตัวยังเห็นประวัติของตัวเองเสมอ และไม่ต้องค้นสิทธิ์แอดมิน', async () => {
            const result = await Service.getMatchHistory(3, 3);

            expect(result.statsHidden).toBe(false);
            expect(result.items).toEqual([]);
            expect(mockedAdminRepo.findAdminByUserId).not.toHaveBeenCalled();
        });

        it('แอดมินทะลุได้ (คิวคำร้องขอระงับตัดสินจากพฤติกรรมในสนาม)', async () => {
            mockedAdminRepo.findAdminByUserId.mockResolvedValue({ admin_scope_id: 1 } as any);

            const result = await Service.getMatchHistory(3, 9001);

            expect(result.statsHidden).toBe(false);
            expect(result.items).toEqual([]);
        });
    });
});
