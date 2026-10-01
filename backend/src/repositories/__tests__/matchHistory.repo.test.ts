import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import * as MatchHistoryRepo from '../matchHistory.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('matchHistory.repo', () => {
    it('uses only approved rosters, verified results, non-deleted tournaments and actual participation evidence', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await MatchHistoryRepo.findVerifiedMatchHistoryByUser(9);
        const [sql, values] = mocks.query.mock.calls[0]!;
        expect(sql).toContain("ta.tournament_application_status = 'approved'");
        expect(sql).toContain("mr.match_result_status = 'verified'");
        expect(sql).toContain('t.deleted_at IS NULL');
        expect(sql).toContain("ci.match_checkin_status IN ('success', 'exception')");
        expect(sql).toContain('pms.player_match_stat_id IS NOT NULL');
        // OD-47 — ไม่ส่ง tournamentId = NULL ทั้งคู่ ⇒ ได้ทุกทัวร์เหมือนเดิม (RW05)
        expect(values).toEqual([9, null, null]);
    });

    it('does not query stats when history is empty', async () => {
        await expect(MatchHistoryRepo.findStatsForUserMatches(9, [])).resolves.toEqual([]);
        expect(mocks.query).not.toHaveBeenCalled();
    });
    /** OD-47 — RW06 โปรไฟล์ในทัวร์ ใช้ query เดิมบวก filter ไม่ใช่ SQL ชุดใหม่ */
    it('OD-47 — ส่ง tournamentId แล้วกรองเหลือทัวร์เดียว', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await MatchHistoryRepo.findVerifiedMatchHistoryByUser(9, 20);

        const [sql, values] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('(? IS NULL OR t.tournament_id = ?)');
        expect(values).toEqual([9, 20, 20]);
    });
});
