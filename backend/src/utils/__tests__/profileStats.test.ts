import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn() }));

import { canSeeProfileStats } from '../profileStats.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import type { UserRow } from '../../types/db.js';

const mockedAdminRepo = vi.mocked(AdminRepo);

function user(showProfileStats : number) : UserRow{
    return { user_id : 9001 , show_profile_stats : showProfileStats } as UserRow;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(null);
});

/**
 * OD-46 — ด่านเดียวของสามเส้นที่ผูกสวิตช์เดียวกัน (U04 stats · U14 career · RW05 match-history)
 * ถ้าเขียนด่านซ้ำสามที่ จะเพี้ยนกันเองเมื่อแก้ที่หนึ่งแล้วลืมอีกสองที่
 * (บั๊กคลาสเดียวกับสามด่านกรรมการที่แก้ไปใน d5bda6d)
 */
describe('canSeeProfileStats', () => {
    describe('เปิดอยู่ (ค่าเริ่มต้นของทุกแถว)', () => {
        it('ใครก็เห็น รวมคนที่ไม่ล็อกอิน — พฤติกรรมเดิมก่อน migration 035', async () => {
            await expect(canSeeProfileStats(user(1))).resolves.toBe(true);
            await expect(canSeeProfileStats(user(1) , 9999)).resolves.toBe(true);
            await expect(canSeeProfileStats(user(1) , 9001)).resolves.toBe(true);
        });

        // เส้นปกติต้องไม่มี query เพิ่มเลย — ค้นสิทธิ์แอดมินเฉพาะตอนที่จำเป็นจริง
        it('ไม่ค้นสิทธิ์แอดมินเลยเมื่อเปิดอยู่', async () => {
            await canSeeProfileStats(user(1) , 9999);
            expect(mockedAdminRepo.findAdminByUserId).not.toHaveBeenCalled();
        });
    });

    describe('ปิดแล้ว', () => {
        it('คนที่ไม่ล็อกอินไม่เห็น และไม่ค้นสิทธิ์แอดมิน (ไม่มี viewer ให้ค้น)', async () => {
            await expect(canSeeProfileStats(user(0))).resolves.toBe(false);
            expect(mockedAdminRepo.findAdminByUserId).not.toHaveBeenCalled();
        });

        it('เจ้าตัวเห็นของตัวเองเสมอ โดยไม่ต้องค้นสิทธิ์แอดมิน', async () => {
            await expect(canSeeProfileStats(user(0) , 9001)).resolves.toBe(true);
            expect(mockedAdminRepo.findAdminByUserId).not.toHaveBeenCalled();
        });

        it('คนอื่นที่ไม่ใช่แอดมินไม่เห็น', async () => {
            await expect(canSeeProfileStats(user(0) , 9999)).resolves.toBe(false);
            expect(mockedAdminRepo.findAdminByUserId).toHaveBeenCalledWith(9999);
        });

        // คิวคำร้องขอระงับผู้ใช้ตัดสินจากพฤติกรรมในสนาม ถ้าแอดมินมองไม่เห็น
        // การซ่อนสถิติจะกลายเป็นเครื่องมือหนีการตรวจ
        it.each(['root' , 'university_wide' , 'faculty'] as const)(
            'แอดมินระดับ %s ทะลุได้', async (scopeType) => {
                mockedAdminRepo.findAdminByUserId.mockResolvedValue({ admin_scope_id : 1 , scope_type : scopeType } as never);

                await expect(canSeeProfileStats(user(0) , 9500)).resolves.toBe(true);
            });
    });
});
