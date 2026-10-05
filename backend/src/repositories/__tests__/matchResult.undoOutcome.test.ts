import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ถอนผลที่ verify ไปแล้ว (B4) — เทสนี้คุมข้อเดียว: **การถอนเลขสถิติต้องรับใบที่ `withdrawn` ด้วย**
 *
 * 🔴 บั๊กที่เทสนี้กันไว้ (แก้ 6 ต.ค. 2569)
 *   applyOutcomeTx บวก player_profile_stats ตอน verify โดยเช็คว่า **ตอนนั้น** ใบยัง `approved`
 *   และการถอนตัวทีหลัง **ไม่ลด** เลขที่บวกไปแล้ว (ตั้งใจ — คนนั้นลงแข่งจริง · มติ 26 ก.ย.)
 *   ⇒ ถ้าทีมถอนตัวหลัง verify แล้วค่อยมี reject/amend ผลนั้น UPDATE ถอนเลขจะแมตช์ 0 แถว
 *     ⇒ โปรไฟล์ค้างนัดที่ถูกยกเลิกไปแล้ว ตลอดไป ลบไม่ได้นอกจากแก้มือในฐาน
 *
 * ★ เทสอ่าน **ตัว SQL** ไม่ใช่ผลลัพธ์ เพราะ undoOutcomeTx ไม่ได้ export และผลจริงต้องมีฐาน
 *   สิ่งที่ต้องกันคือ "เงื่อนไขหายไปจาก WHERE" ซึ่งอ่านจากข้อความ SQL ได้ตรง ๆ และพังทันทีถ้ามีคนแก้กลับ
 */
const mocks = vi.hoisted(() => ({
    // ★ ประกาศพารามิเตอร์เป็น unknown[] ไว้ ไม่ใช่ () => … เพราะถ้าไม่มี tsc จะอนุมานว่า
    //   mock นี้ไม่รับอาร์กิวเมนต์เลย (tuple ว่าง) แล้ว mock.calls[0]![0] จะอ่านไม่ได้
    query : vi.fn((..._args : unknown[]) => Promise.resolve([[], []])),
    beginTransaction : vi.fn(),
    commit : vi.fn(),
    rollback : vi.fn(),
    release : vi.fn()
}));

vi.mock('../../config/db.js', () => ({
    default : {
        query : mocks.query,
        getConnection : () => Promise.resolve({
            query : mocks.query,
            beginTransaction : mocks.beginTransaction,
            commit : mocks.commit,
            rollback : mocks.rollback,
            release : mocks.release
        })
    }
}));
vi.mock('../match.repo.js', () => ({}));
vi.mock('../tournament.repo.js', () => ({}));
vi.mock('../bracketNode.repo.js', () => ({ syncNodeTeamsFromMatchTx : vi.fn() }));
vi.mock('../pickem.repo.js', () => ({ settleTx : vi.fn(), unsettleTx : vi.fn() }));
vi.mock('../reward.repo.js', () => ({ evaluatePickemRewardsTx : vi.fn() }));

import { rejectMatchResult } from '../matchResult.repo.js';

const match = {
    match_id : 70, tournament_id : 20, team_a_id : 5, team_b_id : 6,
    next_match_id : null, loser_next_match_id : null
} as never;

beforeEach(() => {
    mocks.query.mockClear();
    mocks.query.mockImplementation(() => Promise.resolve([[], []]));
});

/** คำสั่งที่ลด player_profile_stats — หาจากตารางและคำว่า GREATEST ไม่ใช่จากลำดับ (ลำดับเปลี่ยนได้) */
function statsUndoSql(): string {
    const call = mocks.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('player_profile_stats') && sql.includes('GREATEST'));
    expect(call, 'ไม่พบคำสั่งถอนเลข player_profile_stats เลย').toBeDefined();
    return call![0] as string;
}

describe('undoOutcomeTx — การถอนสถิติผู้เล่น', () => {
    it('ถอนเลขให้ทั้งใบที่ approved และใบที่ withdrawn', async () => {
        await rejectMatchResult(900, match, 5, 1, 3, 9, 'ยกเลิกผล', true);

        const sql = statsUndoSql();
        expect(sql).toContain("ta.tournament_application_status IN ('approved', 'withdrawn')");
        // 🔴 รูปแบบเดิมที่เป็นบั๊ก — ถ้ากลับไปเป็นแบบนี้ เทสต้องแดง
        expect(sql).not.toContain("ta.tournament_application_status = 'approved'");
    });

    it('ยังกันเลขติดลบด้วย GREATEST และยังผูกกีฬาเดิม', async () => {
        await rejectMatchResult(900, match, 5, 1, 3, 9, 'ยกเลิกผล', true);

        const sql = statsUndoSql();
        expect(sql).toContain('GREATEST(ps.matches_played - 1, 0)');
        expect(sql).toContain('ps.sport_type_id = ?');
    });

    /**
     * ★ เคสนี้สำคัญกว่าที่เห็น: `wasVerified = false` คือผลที่ยังไม่เคยถูกบวก
     * ถ้าเผลอถอนให้ด้วย เลขของคนที่ไม่เกี่ยวจะลดลงโดยไม่มีใครรู้ (GREATEST กันแค่ติดลบ ไม่กันผิด)
     */
    it('ผลที่ยังไม่เคย verify ⇒ ไม่แตะ player_profile_stats เลย', async () => {
        await rejectMatchResult(900, match, 5, 1, 3, 9, 'ยกเลิกผล', false);

        const touched = mocks.query.mock.calls.some(([sql]) =>
            typeof sql === 'string' && sql.includes('player_profile_stats'));
        expect(touched).toBe(false);
    });
});
