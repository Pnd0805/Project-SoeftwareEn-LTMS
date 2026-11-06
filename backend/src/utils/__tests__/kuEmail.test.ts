import { describe, expect, it } from 'vitest';
import { isExternalEmail, isKuEmail } from '../kuEmail.js';

/**
 * นิยามเดียวของ "คนในมหาวิทยาลัย" (มติ 6 ต.ค. 2569 · โดเมน @ku.th)
 * ★ เทสที่ระดับ util เพราะกฎนี้จะมีผู้ใช้สองฝั่ง — ฝั่งกรรมการ (ตอนนี้)
 *   และระบบสมัครสมาชิก (ขอไว้ใน md) ⇒ ต้องตอบเหมือนกันทั้งคู่
 */
describe('isKuEmail', () => {
    it.each([
        'somchai.j@ku.th',
        'a@KU.TH',            // โดเมนไม่สนตัวพิมพ์ (RFC 1035)
        'A.B+tag@Ku.Th',      // local part พิมพ์ใหญ่ได้ ไม่เกี่ยวกับการตัดสิน
    ])('%s = คนใน', (email) => {
        expect(isKuEmail(email)).toBe(true);
        expect(isExternalEmail(email)).toBe(false);
    });

    /**
     * 🔴 ชุดนี้คือเหตุผลที่ห้ามใช้ endsWith('ku.th')
     *   ใครจดโดเมน fake-ku.th ได้ ก็กลายเป็น "คนใน" ทันทีโดยไม่ต้องทำอะไรอีก
     */
    it.each([
        ['โดเมนทั่วไป',              'a@gmail.com'],
        ['ลงท้ายคล้ายกัน',           'a@fake-ku.th'],
        ['ไม่มีขีดแต่ต่อท้าย',        'a@notku.th'],
        ['ku.th อยู่กลางโดเมน',      'a@ku.th.evil.com'],
        ['subdomain ที่ไม่ใช่ ku.th', 'a@mail.ku.th.co'],
        ['ไม่มี @ เลย',              'ไม่ใช่อีเมล'],
        ['ว่าง',                     ''],
    ])('%s = คนนอก', (_name, email) => {
        expect(isKuEmail(email)).toBe(false);
        expect(isExternalEmail(email)).toBe(true);
    });

    /** ★ อีเมลที่มี @ หลายตัว ต้องตัดสินจากตัวสุดท้าย ซึ่งเป็นโดเมนจริง */
    it('มี @ หลายตัว ใช้ตัวสุดท้ายเป็นโดเมน', () => {
        expect(isKuEmail('"a@b"@ku.th')).toBe(true);
        expect(isKuEmail('a@ku.th@gmail.com')).toBe(false);
    });
});
