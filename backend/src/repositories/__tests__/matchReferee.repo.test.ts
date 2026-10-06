import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * คุมข้อเดียว: `findAcceptedByUser` ต้องไม่คืนแมตช์ของทัวร์ที่ถูกลบแล้ว
 *
 * ★ ทำไมต้องกัน (6 ต.ค. 2569) — ไม่ใช่บั๊กที่เกิดได้จริงตอนนี้
 *   deleteTournament ปฏิเสธถ้าทัวร์มีใบสมัครหรือแมตช์แล้ว (TOURNAMENT_HAS_ACTIVITY)
 *   ⇒ ทัวร์ที่ถูกลบจะไม่มีแมตช์ ⇒ แถวที่ query นี้จะไปเจอ เกิดขึ้นไม่ได้ผ่าน API
 *   แต่สิ่งที่กันอยู่คือด่านใน service ชั้นเดียว ถ้าวันหนึ่งมีมติให้ลบทัวร์ที่มีแมตช์ได้
 *   query นี้จะกลายเป็นตัวบล็อกกรรมการผิดคนทันที (ด่านทับเวลาข้ามทัวร์ e872124
 *   นับแถวจาก query นี้ว่าเป็น "งานที่ถืออยู่") ⇒ เทสนี้ล็อกบรรทัดนั้นไว้ล่วงหน้า
 *
 * ★ อ่าน **ตัว SQL** ไม่ใช่ผลลัพธ์ เพราะเงื่อนไขที่ต้องกันคือ "บรรทัดหายไปจาก WHERE"
 *   ซึ่งอ่านจากข้อความ SQL ได้ตรง ๆ และพังทันทีถ้ามีคนลบออก
 *   (ผลลัพธ์จริงต้องมีฐาน ⇒ เป็นหน้าที่ของการยิงจริง ไม่ใช่ของ unit test)
 */
const mocks = vi.hoisted(() => ({ query : vi.fn((..._args : unknown[]) => Promise.resolve([[], []])) }));
vi.mock('../../config/db.js', () => ({ default : { query : mocks.query } }));

import * as MatchRefRepo from '../matchReferee.repo.js';

beforeEach(() => {
    mocks.query.mockClear();
    mocks.query.mockImplementation(() => Promise.resolve([[], []]));
});

describe('findAcceptedByUser', () => {
    it('กรองทัวร์ที่ถูกลบออก (soft delete)', async () => {
        await MatchRefRepo.findAcceptedByUser(9);

        const [sql, values] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('t.deleted_at IS NULL');
        // ★ array ชั้นเดียวซ้อนใน values เพราะคิวรีใช้ `IN (?)` — mysql2 กาง array ให้เอง
        //   (ตัวเดี่ยวเรียกตัวหลายคนต่อ ⇒ SQL มีชุดเดียว ไม่มีสำเนาที่จะ drift)
        expect(values).toEqual([[9]]);
    });

    it('ยังคืนเฉพาะแมตช์ที่รับไว้แล้ว และข้ามทัวร์ (ไม่มีการกรองด้วย tournament_id)', async () => {
        await MatchRefRepo.findAcceptedByUser(9);

        const [sql] = mocks.query.mock.calls[0]!;
        expect(sql).toContain("mr.assignment_status = 'accepted'");
        // 🔴 ถ้าวันหนึ่งมีใครเติม filter ทัวร์เข้ามา ด่านทับเวลาข้ามทัวร์จะกลายเป็นด่านในทัวร์เดียว
        //   แล้วช่องโหว่ที่ FE รายงาน 6 ต.ค. จะกลับมาโดยไม่มีอะไรฟ้อง
        expect(sql).not.toContain('t.tournament_id = ?');
        expect(sql).not.toContain('m.tournament_id = ?');
    });
});

describe('findAcceptedByUsers', () => {
    /**
     * 🔴 รายชื่อว่างต้องไม่ไปถึง SQL — `IN ()` เป็น syntax error ของ MySQL
     *   ถ้าหลุดไป หน้า F14 ของทัวร์ที่ยังไม่มีกรรมการจะพังทั้งหน้า ไม่ใช่คืนค่าว่าง
     *   (ด่านนี้ต้องเทสที่ชั้น repo — ชั้น service mock repo ไว้ จึงมองไม่เห็นว่ามีการกันหรือไม่)
     */
    it('userIds ว่าง = คืน [] โดยไม่ยิงคิวรีเลย', async () => {
        const rows = await MatchRefRepo.findAcceptedByUsers([]);

        expect(rows).toEqual([]);
        expect(mocks.query).not.toHaveBeenCalled();
    });

    it('หลายคน = คิวรีเดียว ส่ง array เข้าไปให้ IN (?) กางเอง', async () => {
        await MatchRefRepo.findAcceptedByUsers([70, 71]);

        expect(mocks.query).toHaveBeenCalledTimes(1);
        const [sql, values] = mocks.query.mock.calls[0]!;
        expect(sql).toContain('tr.user_id IN (?)');
        expect(values).toEqual([[70, 71]]);
    });

    /** ★ ตัวเดี่ยวต้องเป็นทางผ่านของตัวนี้ ไม่ใช่ SQL สำเนาที่สอง */
    it('ตัวเดี่ยวให้ SQL ชุดเดียวกับตัวหลายคน', async () => {
        await MatchRefRepo.findAcceptedByUser(9);
        const single = mocks.query.mock.calls[0]![0];
        mocks.query.mockClear();
        await MatchRefRepo.findAcceptedByUsers([9]);

        expect(mocks.query.mock.calls[0]![0]).toBe(single);
    });
});
