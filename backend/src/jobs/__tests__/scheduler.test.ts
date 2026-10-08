import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { JOB_INTERVAL_MS: 3_600_000, JOB_STARTUP_DELAY_MS: 10_000 } }));

import { runJobsOnce, startScheduler, type Job } from '../scheduler.js';

/**
 * งานเบื้องหลังที่รันตามเวลา (มติ 8 ต.ค. 2569 · ทับมติ 30 ก.ย. ที่ให้กวาดตอนมีคนเปิดหน้าทีม)
 *
 * ★ สิ่งที่ตรึงไว้ที่นี่ไม่ใช่ "timer ทำงานไหม" แต่เป็นสองข้อที่ทำให้เซิร์ฟเวอร์ล่มได้จริง:
 *   1. งานหนึ่งพังต้องไม่ทำให้งานถัดไปไม่ได้รัน
 *   2. งานพังต้อง **ไม่โยน error ออกไป** — ถ้าโยน จะเป็น unhandled rejection แล้วโปรเซสตายทั้งตัว
 *      ⇒ งานกวาดทีมพังแล้ว API ที่คนกำลังใช้อยู่ล่มตามไปด้วย ซึ่งแย่กว่าไม่กวาดเลย
 */

const job = (name: string, run: () => Promise<unknown>): Job => ({ name, run });

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('runJobsOnce', () => {
    it('รันทุกงานเรียงกันตามลำดับที่ส่งมา', async () => {
        const order: string[] = [];
        await runJobsOnce([
            job('หนึ่ง', async () => { order.push('หนึ่ง'); }),
            job('สอง', async () => { order.push('สอง'); }),
        ]);
        expect(order).toEqual(['หนึ่ง', 'สอง']);
    });

    /** 🔴 ข้อ 1 — ถ้าหลุด งานที่อยู่หลังงานที่พังจะไม่ได้รันเลยตลอดไป */
    it('งานแรกพัง → งานถัดไปยังได้รัน', async () => {
        const second = vi.fn(async () => {});
        await runJobsOnce([
            job('พัง', async () => { throw new Error('ฐานล่ม'); }),
            job('ยังต้องรัน', second),
        ]);
        expect(second).toHaveBeenCalledOnce();
    });

    /** 🔴 ข้อ 2 — ถ้าหลุด โปรเซสจะตายทั้งตัวเพราะ unhandled rejection */
    it('งานพังต้องไม่โยน error ออกมา และต้องเขียน log บอก', async () => {
        await expect(runJobsOnce([job('พัง', async () => { throw new Error('ฐานล่ม'); })])).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalled();
    });
});

describe('startScheduler', () => {
    it('รันรอบแรกหลังหน่วงตอนเซิร์ฟเวอร์ขึ้น ไม่รอครบรอบ', async () => {
        const run = vi.fn(async () => {});
        startScheduler([job('งาน', run)]);

        expect(run).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(run).toHaveBeenCalledOnce();
    });

    it('รันซ้ำทุกรอบ', async () => {
        const run = vi.fn(async () => {});
        startScheduler([job('งาน', run)], 1_000);

        await vi.advanceTimersByTimeAsync(10_000);            // ผ่านรอบเริ่มต้นไปแล้ว
        const afterStartup = run.mock.calls.length;
        await vi.advanceTimersByTimeAsync(3_000);             // อีกสามรอบ
        // ★ เทียบเป็นส่วนต่าง ไม่ใช่เลขตรง ๆ — ไม่ผูกกับค่าหน่วงรอบเริ่มต้น
        expect(run.mock.calls.length).toBe(afterStartup + 3);
    });

    it('หยุดแล้วต้องไม่รันอีก', async () => {
        const run = vi.fn(async () => {});
        const stop = startScheduler([job('งาน', run)], 1_000);
        stop();

        await vi.advanceTimersByTimeAsync(60_000);
        expect(run).not.toHaveBeenCalled();
    });

    /** ปิดสนิทได้ด้วย env — เผื่อเครื่องที่ไม่อยากให้มีงานเบื้องหลังเลย (เช่นตอนวัด perf แยกส่วน) */
    it('ช่วงเวลาเป็น 0 → ไม่ตั้ง timer เลย', async () => {
        const run = vi.fn(async () => {});
        startScheduler([job('งาน', run)], 0);

        await vi.advanceTimersByTimeAsync(60_000);
        expect(run).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});
