import { afterEach, describe, expect, it, vi } from 'vitest';
import { anon } from './helpers/api.js';
import { env } from '../../config/env.js';

/**
 * 🆕 C2 (8 ต.ค. 2569) — พิสูจน์ว่า `slowRequestLog` **ถูกต่อเข้าเส้นจริง** ไม่ใช่แค่เขียนไว้
 *
 * เทส unit พิสูจน์ได้แค่ว่าฟังก์ชันทำงานถูกเมื่อถูกเรียก — ถ้าใครลบ `app.use(slowRequestLog)`
 * ออกจาก `app.ts` เทสชุดนั้นยังเขียวทั้งหมด ซึ่งคือการพังแบบที่เราอยากจับที่สุด
 * (ทั้งเรื่องนี้เกิดจาก "log ว่างเปล่า" ตั้งแต่แรก)
 *
 * ★ ลดเกณฑ์เหลือ 1 ms ชั่วคราวระหว่างเทส — `env` เป็นออบเจกต์ธรรมดาและ middleware
 *   อ่านค่าใหม่ทุกคำขอ จึงปรับได้โดยไม่ต้องโหลดโมดูลใหม่ · คืนค่าเดิมเสมอใน afterEach
 */
describe('C2 — slowRequestLog ต่ออยู่ในเส้นจริง', () => {
    const original = env.SLOW_REQUEST_MS;
    afterEach(() => { env.SLOW_REQUEST_MS = original; vi.restoreAllMocks(); });

    it('คำขอจริงที่เกินเกณฑ์ → มีบรรทัด log พร้อม method และ path', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        env.SLOW_REQUEST_MS = 1;

        await anon.get('/sport-types');

        const lines = warn.mock.calls.map(c => String(c[0])).filter(l => l.startsWith('[slow]'));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('GET');
        expect(lines[0]).toContain('/api/v1/sport-types');
    });

    it('เกณฑ์ปกติ (2 วินาที) → คำขอธรรมดาต้องเงียบ ไม่ท่วม log', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        env.SLOW_REQUEST_MS = original;

        await anon.get('/sport-types');

        expect(warn.mock.calls.filter(c => String(c[0]).startsWith('[slow]'))).toHaveLength(0);
    });
});
