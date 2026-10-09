import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import { findTournamentsToWarnBeforeAutoDelete, markAutoDeleteWarned, purgeTournamentsClosedOver,
         sweepPrivatePastDueTournaments } from '../tournament.repo.js';

beforeEach(() => vi.clearAllMocks());

/**
 * BR-03 ส่วนที่ 1 (8 ต.ค. 2569) — ด่านที่เทส integration **เข้าไม่ถึง**
 *
 * ★ ทำไมต้องมีไฟล์นี้: เทส integration รันงานนี้ทีละรอบเรียงกัน
 *   รอบสองจึงไม่มีผู้สมัครเหลือให้ UPDATE อยู่แล้ว ⇒ ถอดเงื่อนไขใน UPDATE ออกก็ยังเขียวหมด
 *   (ลอง mutation แล้วเป็นอย่างนั้นจริง) แต่เงื่อนไขนั้นมีไว้กัน **สองรอบที่ทำงานซ้อนกัน**
 *   เช่นรันหลายโปรเซส หรือรอบก่อนยังไม่จบแล้วรอบใหม่มาถึง
 *   ถ้าหลุด: ผู้จัดจะได้แจ้งเตือน "ทัวร์ถูกปิด" ซ้ำทุกชั่วโมงตลอดไป
 *   ⇒ ตรึงที่ตัว SQL ตรง ๆ เพราะเป็นที่เดียวที่ตรวจได้โดยไม่ต้องปั้นสถานการณ์แข่งกัน
 */
describe('sweepPrivatePastDueTournaments — ด่านกันรอบทำงานซ้อนกัน', () => {
    it('UPDATE ต้องยังเช็คสถานะและ deleted_at อีกครั้ง ไม่ใช่เชื่อผลจาก SELECT', async () => {
        mocks.query
            .mockResolvedValueOnce([[{ tournament_id: 7, name: 'ทัวร์', requested_by_user_id: 3 }], []])
            .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

        await sweepPrivatePastDueTournaments();

        const [updateSql] = mocks.query.mock.calls[1]!;
        expect(updateSql).toContain('UPDATE tournaments');
        expect(updateSql).toContain("tournament_status = 'private'");
        expect(updateSql).toContain('deleted_at IS NULL');
    });

    it('UPDATE ไม่ติด → ไม่คืนทัวร์นั้น (อีกรอบชิงไปก่อน ⇒ ไม่แจ้งซ้ำ)', async () => {
        mocks.query
            .mockResolvedValueOnce([[{ tournament_id: 7, name: 'ทัวร์', requested_by_user_id: 3 }], []])
            .mockResolvedValueOnce([{ affectedRows: 0 }, []]);

        expect(await sweepPrivatePastDueTournaments()).toEqual([]);
    });

    it('UPDATE ติด → คืนชื่อและผู้จัดไว้ให้ service แจ้งเตือน', async () => {
        mocks.query
            .mockResolvedValueOnce([[{ tournament_id: 7, name: 'ทัวร์ฤดูร้อน', requested_by_user_id: 3 }], []])
            .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

        expect(await sweepPrivatePastDueTournaments())
            .toEqual([{ tournamentId: 7, name: 'ทัวร์ฤดูร้อน', organizerId: 3 }]);
    });

    it('ไม่มีผู้สมัคร → ไม่ยิง UPDATE เลย', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await sweepPrivatePastDueTournaments();
        expect(mocks.query).toHaveBeenCalledTimes(1);
    });
});

/**
 * BR-03 ส่วนที่ 2 — ด่านกันเตือนซ้ำ ซึ่งเทส integration **เข้าไม่ถึง** ด้วยเหตุผลเดียวกับข้างบน
 *   (รันเรียงกัน รอบสองไม่มีผู้สมัครเหลือให้ UPDATE ⇒ ถอดเงื่อนไขออกก็ยังเขียว)
 *   ของจริงที่เงื่อนไขนี้กันคือ **สองรอบที่ทำงานซ้อนกัน** · ถ้าหลุด ผู้จัดได้ข้อความเดิม 24 ครั้ง/วัน
 */
describe('markAutoDeleteWarned — ด่านกันเตือนซ้ำ', () => {
    it('UPDATE ต้องเช็ค auto_delete_warned_at IS NULL อีกครั้ง ไม่ใช่เชื่อผลจาก SELECT', async () => {
        mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
        await markAutoDeleteWarned(7);

        const [sql] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('auto_delete_warned_at IS NULL');
    });

    it('UPDATE ไม่ติด → คืน false (รอบอื่นจำไปก่อน ⇒ service ต้องไม่ส่งข้อความ)', async () => {
        mocks.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
        expect(await markAutoDeleteWarned(7)).toBe(false);
    });

    it('UPDATE ติด → คืน true', async () => {
        mocks.query.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
        expect(await markAutoDeleteWarned(7)).toBe(true);
    });
});

describe('findTournamentsToWarnBeforeAutoDelete — เงื่อนไขที่ต้องมีครบ', () => {
    it('กรองทั้งสถานะ · ยังไม่เคยเตือน · ยังไม่ถึงวันแข่ง · อยู่ในช่วงกี่วันที่ส่งมา', async () => {
        mocks.query.mockResolvedValueOnce([[], []]);
        await findTournamentsToWarnBeforeAutoDelete(7);

        const [sql, params] = mocks.query.mock.calls[0]!;
        expect(sql).toContain("tournament_status = 'private'");
        expect(sql).toContain('auto_delete_warned_at IS NULL');
        expect(sql).toContain('event_start_date > CURDATE()');          // ถึงวันแข่งแล้วเป็นงานของตัวที่ปิดเลย
        expect(sql).toContain('event_start_date <= CURDATE() + INTERVAL ? DAY');
        expect(sql).toContain('deleted_at IS NULL');
        expect(params).toEqual([7]);
    });
});

describe('purgeTournamentsClosedOver — วันปิดทัวร์และการลบ', () => {
    it('ใช้ COALESCE(completed_at, event_end_date, event_start_date) เป็นวันปิด', async () => {
        mocks.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
        await purgeTournamentsClosedOver(4);

        const [sql, params] = mocks.query.mock.calls[0]!;
        expect(sql).toMatch(/COALESCE\(\s*completed_at\s*,\s*event_end_date\s*,\s*event_start_date\s*\)/);
        expect(params).toEqual([4]);
    });

    /** 🔴 soft delete แถว tournaments เท่านั้น (มติ 8 ต.ค. ทาง ก) · deleted_by NULL = ระบบลบ */
    it('soft delete เท่านั้น — ไม่ DELETE จริง และ deleted_by เป็น NULL', async () => {
        mocks.query.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
        await purgeTournamentsClosedOver(4);

        const [sql] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('deleted_at = NOW()');
        expect(sql).toContain('deleted_by = NULL');
        expect(sql).not.toMatch(/DELETE\s+FROM/i);
        expect(sql).toContain('deleted_at IS NULL');          // ไม่ลบซ้ำของที่ลบแล้ว
    });
});
