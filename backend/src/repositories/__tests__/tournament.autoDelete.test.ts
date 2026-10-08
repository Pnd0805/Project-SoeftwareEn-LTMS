import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import { sweepPrivatePastDueTournaments } from '../tournament.repo.js';

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
