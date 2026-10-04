import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/db.js', () => ({ default: { query: vi.fn() } }));

import { grantStatRewardsForTournamentTx, evaluatePickemRewardsTx } from '../reward.repo.js';
import { PICKEM_TIER_POINTS } from '../../config/scoring.js';

type Call = { sql: string; params: unknown[] };

/** conn ปลอม — เก็บ SQL กับพารามิเตอร์ไว้ตรวจ แล้วตอบตามคิวที่ตั้งไว้ */
const makeConn = (replies: unknown[]) => {
    const calls: Call[] = [];
    let i = 0;
    const conn = {
        query: vi.fn(async (sql: string, params: unknown[]) => {
            calls.push({ sql, params });
            return replies[i++] ?? [{ affectedRows: 0 }, []];
        }),
    };
    return { conn: conn as never, calls };
};

const reward = (id: number, criteria: unknown) => ({ reward_id: id, criteria, is_active: true });

beforeEach(() => vi.clearAllMocks());

/** OD-57 — แจกเหรียญสายสถิติตอนปิดทัวร์ */
describe('grantStatRewardsForTournamentTx', () => {
    it('ยิง 1 คำสั่งต่อเหรียญ และส่ง tournamentId / sportTypeId / เกณฑ์ไปครบ', async () => {
        const { conn, calls } = makeConn([
            [[reward(1, { stat: 'wins', gte: 10 })], []],
            [{ affectedRows: 3 }, []],
        ]);

        await expect(grantStatRewardsForTournamentTx(conn, 50, 7)).resolves.toBe(3);

        expect(calls).toHaveLength(2);                       // อ่านรายการเหรียญ + แจก 1 ครั้ง
        expect(calls[1]!.params).toEqual([1, 7, 50, 10]);     // rewardId, sportTypeId, tournamentId, gte
        expect(calls[1]!.sql).toContain('INSERT IGNORE INTO user_rewards');
        expect(calls[1]!.sql).toContain("tournament_application_status = 'approved'");
    });

    it('★ ชื่อคอลัมน์ที่ลง SQL มาจาก allowlist เท่านั้น', async () => {
        const { conn, calls } = makeConn([
            [[reward(1, { stat: 'championships', gte: 1 })], []],
            [{ affectedRows: 1 }, []],
        ]);
        await grantStatRewardsForTournamentTx(conn, 50, 7);
        expect(calls[1]!.sql).toContain('`championships`');
    });

    it('เกณฑ์อ่านไม่ออก → ไม่แจกใครเลย (ไม่ใช่แจกทุกคน)', async () => {
        const { conn, calls } = makeConn([
            [[reward(1, { stat: 'total_points', gte: 1 }), reward(2, null), reward(3, 'พัง')], []],
        ]);
        await expect(grantStatRewardsForTournamentTx(conn, 50, 7)).resolves.toBe(0);
        expect(calls).toHaveLength(1);                        // อ่านรายการอย่างเดียว ไม่ยิง INSERT
    });

    it('ข้ามเหรียญสาย Pick\'em (คนละ hook กัน)', async () => {
        const { conn, calls } = makeConn([
            [[reward(9, { pickem: 'spot_on', gte: 5 })], []],
        ]);
        await expect(grantStatRewardsForTournamentTx(conn, 50, 7)).resolves.toBe(0);
        expect(calls).toHaveLength(1);
    });

    it('รวมยอดจากหลายเหรียญ', async () => {
        const { conn } = makeConn([
            [[reward(1, { stat: 'wins', gte: 1 }), reward(2, { stat: 'championships', gte: 1 })], []],
            [{ affectedRows: 4 }, []],
            [{ affectedRows: 2 }, []],
        ]);
        await expect(grantStatRewardsForTournamentTx(conn, 50, 7)).resolves.toBe(6);
    });
});

/** OD-57 — เหรียญ Pick'em ประเมินใหม่ทุกครั้งที่แต้มเปลี่ยน แจกหรือริบ */
describe('evaluatePickemRewardsTx', () => {
    it('ไม่มีใครทายแมตช์นี้ → ไม่ยิงอะไรต่อ', async () => {
        const { conn, calls } = makeConn([[[], []]]);
        await expect(evaluatePickemRewardsTx(conn, 12)).resolves.toEqual({ granted: 0, revoked: 0 });
        expect(calls).toHaveLength(1);
    });

    it('★ แจกและริบในรอบเดียว · นับจาก points_earned ของชั้นสูงสุด', async () => {
        const { conn, calls } = makeConn([
            [[{ user_id: 101 }, { user_id: 102 }], []],
            [[reward(9, { pickem: 'spot_on', gte: 5 })], []],
            [{ affectedRows: 1 }, []],     // grant
            [{ affectedRows: 1 }, []],     // revoke
        ]);

        await expect(evaluatePickemRewardsTx(conn, 12)).resolves.toEqual({ granted: 1, revoked: 1 });

        const grant = calls[2]!, revoke = calls[3]!;
        expect(grant.sql).toContain('INSERT IGNORE INTO user_rewards');
        expect(grant.params).toEqual([9, [101, 102], PICKEM_TIER_POINTS.spot_on, 5]);
        expect(revoke.sql).toContain('DELETE FROM user_rewards');
        expect(revoke.sql).toContain('NOT IN');
        expect(revoke.params).toEqual([9, [101, 102], [101, 102], PICKEM_TIER_POINTS.spot_on, 5]);
    });

    it('★ ริบต้องนับใหม่ทั้งหมด ไม่ใช่ลบเฉพาะแมตช์นี้', async () => {
        const { conn, calls } = makeConn([
            [[{ user_id: 101 }], []],
            [[reward(9, { pickem: 'spot_on', gte: 5 })], []],
            [{ affectedRows: 0 }, []],
            [{ affectedRows: 0 }, []],
        ]);
        await evaluatePickemRewardsTx(conn, 12);
        // เงื่อนไขการริบต้องไม่ผูกกับ match_id ของรอบนี้ ไม่งั้นคนที่ยังครบเกณฑ์จะโดนริบไปด้วย
        expect(calls[3]!.sql).not.toContain('match_id');
        expect(calls[3]!.sql).toContain('HAVING COUNT(*) >=');
    });

    it('ข้ามเหรียญสายสถิติ (คนละ hook กัน)', async () => {
        const { conn, calls } = makeConn([
            [[{ user_id: 101 }], []],
            [[reward(1, { stat: 'wins', gte: 10 })], []],
        ]);
        await expect(evaluatePickemRewardsTx(conn, 12)).resolves.toEqual({ granted: 0, revoked: 0 });
        expect(calls).toHaveLength(2);
    });

    it('เกณฑ์อ่านไม่ออก → ไม่แตะเหรียญของใคร', async () => {
        const { conn, calls } = makeConn([
            [[{ user_id: 101 }], []],
            [[reward(9, { pickem: 'มั่ว', gte: 5 })], []],
        ]);
        await expect(evaluatePickemRewardsTx(conn, 12)).resolves.toEqual({ granted: 0, revoked: 0 });
        expect(calls).toHaveLength(2);
    });
});
