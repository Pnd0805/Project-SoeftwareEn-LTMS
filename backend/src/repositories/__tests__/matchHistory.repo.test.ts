import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import * as MatchHistoryRepo from '../matchHistory.repo.js';

beforeEach(() => vi.clearAllMocks());

describe('matchHistory.repo', () => {
    it('uses only approved rosters, verified results, non-deleted tournaments and actual participation evidence', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await MatchHistoryRepo.findVerifiedMatchHistoryByUser(9, undefined, false);
        const [sql, values] = mocks.query.mock.calls[0]!;
        expect(sql).toContain("ta.tournament_application_status = 'approved'");
        expect(sql).toContain("mr.match_result_status = 'verified'");
        expect(sql).toContain('t.deleted_at IS NULL');
        expect(sql).toContain("ci.match_checkin_status IN ('success', 'exception')");
        expect(sql).toContain('pms.player_match_stat_id IS NOT NULL');
        // OD-47 — ไม่ส่ง tournamentId = NULL ทั้งคู่ ⇒ ได้ทุกทัวร์เหมือนเดิม (RW05)
        expect(values).toEqual([0, 9, null, null]);
    });

    it('does not query stats when history is empty', async () => {
        await expect(MatchHistoryRepo.findStatsForUserMatches(9, [])).resolves.toEqual([]);
        expect(mocks.query).not.toHaveBeenCalled();
    });
    /** OD-47 — RW06 โปรไฟล์ในทัวร์ ใช้ query เดิมบวก filter ไม่ใช่ SQL ชุดใหม่ */
    it('OD-47 — ส่ง tournamentId แล้วกรองเหลือทัวร์เดียว', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await MatchHistoryRepo.findVerifiedMatchHistoryByUser(9, 20, false);

        const [sql, values] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('(? IS NULL OR t.tournament_id = ?)');
        expect(values).toEqual([0, 9, 20, 20]);
    });
    /**
     * มติ 5 ต.ค. — ส่งธง withdrawn ต่อรายการให้ FE ติดป้ายได้
     *
     * ★ อ่านจาก `ta` ตรง ๆ ได้แม้ query เป็น SELECT DISTINCT เพราะฐานบังคับ
     *   `application_players UNIQUE (tournament_id, user_id)` ⇒ หนึ่งคนมีใบเดียวต่อทัวร์
     *   ⇒ คอลัมน์นี้มีค่าเดียวต่อแถว ไม่มีทางทำให้แถวแตกเป็นสองแถวต่อแมตช์
     * 🔴 ถ้าวันหนึ่งมีใครถอด unique key นั้นออก ข้อนี้จะไม่จริงอีก และประวัติแมตช์จะซ้ำกันทั้งหน้า
     *   โดยไม่มี error — เทสนี้จับไม่ได้ (มันอ่าน SQL ไม่ได้อ่าน schema) ⇒ เขียนเตือนไว้ที่นี่
     */
    it('มติ 5 ต.ค. — ส่ง has_approved ออกมาเป็นคอลัมน์ และยังเป็น SELECT DISTINCT', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await MatchHistoryRepo.findVerifiedMatchHistoryByUser(9, undefined, true);

        const [sql] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('AS has_approved');
        expect(sql).toContain('SELECT DISTINCT');
        expect(sql).toContain("ta.tournament_application_status = 'approved' THEN 1 ELSE 0 END AS has_approved");
    });

    /** OD-47 ข้อ ก — RW06 ต้องเห็นแมตช์ของคนในทีมที่ถอนตัว ไม่ใช่คืน matches ว่าง */
    it('OD-47 — includeWithdrawn ส่ง 1 และ JOIN รับใบที่ withdrawn ด้วย', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await MatchHistoryRepo.findVerifiedMatchHistoryByUser(9, 20, true);

        const [sql, values] = mocks.query.mock.calls[0]!;
        expect(sql).toContain("ta.tournament_application_status = 'withdrawn'");
        expect(values).toEqual([1, 9, 20, 20]);
    });
});
