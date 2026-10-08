import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
    const conn = { query: vi.fn(() => Promise.resolve([{ affectedRows: 1 }, []])), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() };
    return { conn, query: vi.fn(() => Promise.resolve([[], []])), getConnection: vi.fn(() => Promise.resolve(conn)) };
});

vi.mock('../../config/db.js', () => ({ default: { query: mocks.query, getConnection: mocks.getConnection } }));
vi.mock('../pickem.repo.js', () => ({ settleTx: vi.fn(), unsettleTx: vi.fn(), findPickerIdsTx: vi.fn(() => Promise.resolve([])) }));
// OD-64 — amend เรียกตัวประเมินเหรียญด้วย · เทสนี้วัดลำดับ settle/unsettle ไม่ใช่เหรียญ จึง mock ทิ้ง
vi.mock('../reward.repo.js', () => ({
    evaluatePickemRewardsTx: vi.fn(() => Promise.resolve({ granted: 0, revoked: 0 })),
    evaluateStatRewardsForTournamentTx: vi.fn(() => Promise.resolve({ granted: 0, revoked: 0 })),
}));
vi.mock('../bracketNode.repo.js', () => ({ syncNodeTeamsFromMatchTx: vi.fn() }));
vi.mock('../match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../tournament.repo.js', () => ({ findTournamentById: vi.fn(() => Promise.resolve({ tournament_id: 50, sport_type_id: 1 })) }));

import { amendMatchResult } from '../matchResult.repo.js';
import * as PickemRepo from '../pickem.repo.js';
import type { MatchRow } from '../../types/db.js';

const WINNER = 10, LOSER = 11;
const match = { match_id: 1, tournament_id: 50, team_a_id: WINNER, team_b_id: LOSER,
                next_match_id: null, loser_next_match_id: null } as MatchRow;

const OLD_SCORE = { [String(WINNER)]: 3, [String(LOSER)]: 1 };
const NEW_SCORE = { [String(WINNER)]: 2, [String(LOSER)]: 1 };

beforeEach(() => {
    vi.clearAllMocks();
    // findById(matchResId) ของ repo เอง — คืนสกอร์เดิมให้ amend อ่านไปถอน standings
    mocks.query.mockResolvedValue([[{ match_result_id: 100, score_data: OLD_SCORE }], []] as never);
});

/**
 * OD-56 ก้าวที่ 2 (4 ต.ค. 2569) — regression
 *
 * ★ กิ่ง "ผู้จัด amend สกอร์ แต่ผู้ชนะคนเดิม" **ไม่เคยแตะ Pick'em มาก่อน**
 *   ซึ่งถูกต้องตอนที่แต้มขึ้นกับ "ใครชนะ" เท่านั้น
 *
 *   แต่หลัง OD-56 แต้มขึ้นกับ **สกอร์** ด้วย (ชั้น exact / close) ⇒ ถ้าไม่คิดใหม่
 *   คนที่ทายสกอร์เดิมเป๊ะจะถือแต้มเต็มค้างไว้ทั้งที่สกอร์นั้นถูกแก้ไปแล้ว
 *   และคนที่ทายตรงกับสกอร์ใหม่จะไม่ได้โบนัสที่ควรได้
 *
 *   🔴 **เพี้ยนแบบไม่มี error ฟ้องเลย** — endpoint ตอบ 200 ปกติ ตารางอันดับก็ยังคืนตัวเลข
 *      เทสชุดนี้เป็นตัวเดียวที่จับได้
 */
describe('amendMatchResult — ต้องคิดแต้ม Pick\'em ใหม่เมื่อสกอร์เปลี่ยน', () => {
    it('ผู้ชนะคนเดิม สกอร์เปลี่ยน → unsettle แล้ว settle ใหม่ด้วยสกอร์ใหม่', async () => {
        await amendMatchResult(100, match, WINNER, WINNER, NEW_SCORE, 1, 3, 7, 'แก้สกอร์', true);

        expect(PickemRepo.unsettleTx).toHaveBeenCalledWith(mocks.conn, 1);
        expect(PickemRepo.settleTx).toHaveBeenCalledWith(mocks.conn, 1, WINNER, NEW_SCORE, 1);
    });

    it('★ unsettle ต้องมาก่อน settle — ไม่งั้นแต้มเก่าค้างใน users.total_points', async () => {
        const order: string[] = [];
        vi.mocked(PickemRepo.unsettleTx).mockImplementation(async () => { order.push('unsettle'); });
        vi.mocked(PickemRepo.settleTx).mockImplementation(async () => { order.push('settle'); });

        await amendMatchResult(100, match, WINNER, WINNER, NEW_SCORE, 1, 3, 7, 'แก้สกอร์', true);

        expect(order).toEqual(['unsettle', 'settle']);
    });

    it('ส่งสกอร์ใหม่ไปให้ settle ไม่ใช่สกอร์เดิม', async () => {
        await amendMatchResult(100, match, WINNER, WINNER, NEW_SCORE, 1, 3, 7, 'แก้สกอร์', true);

        const passedScore = vi.mocked(PickemRepo.settleTx).mock.calls[0]![3];
        expect(passedScore).toEqual(NEW_SCORE);
        expect(passedScore).not.toEqual(OLD_SCORE);
    });

    it('ผลยังไม่เคย verify → ไม่ต้อง unsettle (ไม่มีแต้มเก่าให้ถอน) แต่ต้อง settle', async () => {
        await amendMatchResult(100, match, WINNER, WINNER, NEW_SCORE, 1, 3, 7, 'แก้สกอร์', false);

        expect(PickemRepo.unsettleTx).not.toHaveBeenCalled();
        // applyOutcomeTx เป็นคนเรียก settleTx ในกิ่งนี้
        expect(PickemRepo.settleTx).toHaveBeenCalledWith(mocks.conn, 1, WINNER, NEW_SCORE, 1);
    });

    it('ผู้ชนะเปลี่ยน → ยังเดินทาง undo/apply เดิม (unsettle+settle มาจากสองตัวนั้น)', async () => {
        await amendMatchResult(100, match, WINNER, LOSER, NEW_SCORE, 1, 3, 7, 'เปลี่ยนผู้ชนะ', true);

        expect(PickemRepo.unsettleTx).toHaveBeenCalledTimes(1);
        expect(PickemRepo.settleTx).toHaveBeenCalledWith(mocks.conn, 1, LOSER, NEW_SCORE, 1);
    });
});
