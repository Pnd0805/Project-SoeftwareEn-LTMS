import { describe, it, expect } from 'vitest';
import { createUserReportSchema } from '../userReport.schema.js';

/**
 * C2 — POST /users/:id/report
 *
 * เดิม `evidence` เป็น z.array(z.string()) เปล่า ⇒ ส่งสตริงอะไรมาก็ผ่าน และไม่จำกัดจำนวน
 * พอหลักฐานถูกส่งออกเป็น presigned URL แล้ว (1 ต.ค. 2569) ขาเข้าต้องคุมด้วย
 * เพดาน 5 ไฟล์ตั้งให้เท่ากับหลักฐานการค้านผล (S03/S13) เพื่อไม่ให้สองที่คุมคนละมาตรฐาน
 *
 * ส่วนการตรวจว่า key เป็นของผู้แจ้งคนนี้จริง อยู่ที่ service ไม่ใช่ schema
 * เพราะต้องรู้ userId จาก token ซึ่ง schema มองไม่เห็น (ดู user.service.test.ts)
 */
describe('createUserReportSchema', () => {
    it('reason บังคับเสมอ ไม่ว่าจะแนบหลักฐานหรือไม่', () => {
        expect(createUserReportSchema.safeParse({ reason: 'ใช้ถ้อยคำไม่เหมาะสม' }).success).toBe(true);
        expect(createUserReportSchema.safeParse({ evidence: ['report_evidence/9001/a.png'] }).success).toBe(false);
        expect(createUserReportSchema.safeParse({ reason: '   ' }).success).toBe(false);
    });

    it('แนบหลักฐานได้ไม่เกิน 5 ไฟล์', () => {
        const keys = (n : number) => Array.from({ length : n } , (_ , i) => `report_evidence/9001/${i}.png`);

        expect(createUserReportSchema.safeParse({ reason : 'x' , evidence : keys(5) }).success).toBe(true);

        const over = createUserReportSchema.safeParse({ reason : 'x' , evidence : keys(6) });
        expect(over.success).toBe(false);
        if(!over.success){
            expect(over.error.issues.some(i => i.message === 'แนบหลักฐานได้ไม่เกิน 5 ไฟล์')).toBe(true);
        }
    });

    it('key ว่างหรือยาวเกิน 512 ตัวอักษรไม่ผ่าน', () => {
        expect(createUserReportSchema.safeParse({ reason : 'x' , evidence : [''] }).success).toBe(false);
        expect(createUserReportSchema.safeParse({ reason : 'x' , evidence : ['   '] }).success).toBe(false);
        expect(createUserReportSchema.safeParse({ reason : 'x' , evidence : ['k'.repeat(513)] }).success).toBe(false);
        expect(createUserReportSchema.safeParse({ reason : 'x' , evidence : ['k'.repeat(512)] }).success).toBe(true);
    });

    it('ไม่ส่ง evidence มาเลยก็ผ่าน (ไม่บังคับแนบ)', () => {
        const parsed = createUserReportSchema.safeParse({ reason : 'ใช้ถ้อยคำไม่เหมาะสม' });
        expect(parsed.success).toBe(true);
        if(parsed.success){
            expect(parsed.data.evidence).toBeUndefined();
        }
    });
});
