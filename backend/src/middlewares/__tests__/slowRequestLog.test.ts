import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../config/env.js', () => ({ env: { SLOW_REQUEST_MS: 2000 } }));

import { slowRequestLog } from '../slowRequestLog.js';
import { env } from '../../config/env.js';

/**
 * 🆕 C2 (8 ต.ค. 2569) — log คำขอที่ช้าเกินเกณฑ์
 *
 * ★ เทสชุดนี้สนใจสองอย่างเท่านั้น: **อะไรถูก log** และ **อะไรต้องไม่ถูก log**
 *   ไม่ผูกกับข้อความทั้งบรรทัด (จะได้แก้ถ้อยคำได้) แต่ผูกกับ "ข้อมูลที่ต้องมี/ห้ามมี"
 */

/** `res` ปลอมที่ยิง event ได้จริง — ตัวจริงเป็น stream ที่ยิง 'close' เสมอตอน connection ปิด */
function makeRes(writableEnded: boolean, statusCode = 200) {
    const res = new EventEmitter() as EventEmitter & Partial<Response>;
    res.statusCode = statusCode;
    Object.defineProperty(res, 'writableEnded', { value: writableEnded });
    return res as unknown as Response & EventEmitter;
}
const makeReq = (url: string, method = 'GET') => ({ originalUrl: url, method } as Request);

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T00:00:00Z'));
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    env.SLOW_REQUEST_MS = 2000;
});
afterEach(() => {
    warn.mockRestore();
    vi.useRealTimers();
});

describe('slowRequestLog', () => {
    it('ส่ง next() ต่อเสมอ — middleware นี้ต้องไม่ขวางคำขอใด ๆ', () => {
        const next = vi.fn() as NextFunction;
        slowRequestLog(makeReq('/api/v1/teams'), makeRes(true), next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('เร็วกว่าเกณฑ์ → ไม่ log อะไรเลย', () => {
        const res = makeRes(true);
        slowRequestLog(makeReq('/api/v1/teams'), res, vi.fn() as NextFunction);
        vi.advanceTimersByTime(1999);
        res.emit('close');
        expect(warn).not.toHaveBeenCalled();
    });

    it('ช้าเกินเกณฑ์และตอบจบ → log เวลา · method · path · status', () => {
        const res = makeRes(true, 200);
        slowRequestLog(makeReq('/api/v1/teams/9001'), res, vi.fn() as NextFunction);
        vi.advanceTimersByTime(2500);
        res.emit('close');

        expect(warn).toHaveBeenCalledOnce();
        const line = String(warn.mock.calls[0]![0]);
        expect(line).toContain('2500ms');
        expect(line).toContain('GET');
        expect(line).toContain('/api/v1/teams/9001');
        expect(line).toContain('200');
    });

    /**
     * 🔴 เคสที่เป็นเหตุผลทั้งหมดของ C2 — load test เจอคำขอค้างจน timeout 2,000+ ครั้ง
     *   คำขอพวกนั้น **ไม่เคยยิง `finish`** เพราะไม่มีคำตอบถูกส่ง
     *   ⇒ ถ้าวัดที่ `finish` อย่างเดียว log จะยังว่างเปล่าเหมือนเดิม = แก้ไม่ตรงปัญหา
     */
    it('client ยกเลิกก่อน (ไม่มีคำตอบถูกส่ง) → ยัง log และบอกว่าไม่ได้ส่งคำตอบ', () => {
        const res = makeRes(false, 200);
        slowRequestLog(makeReq('/api/v1/tournaments/9001/pickem-leaderboard'), res, vi.fn() as NextFunction);
        vi.advanceTimersByTime(10_000);
        res.emit('close');

        expect(warn).toHaveBeenCalledOnce();
        const line = String(warn.mock.calls[0]![0]);
        expect(line).toContain('10000ms');
        expect(line).toContain('client ยกเลิกก่อน');
        // ★ ห้ามรายงาน status — ไม่มีใครได้รับคำตอบนั้น การพิมพ์ 200 จะอ่านเหมือนสำเร็จ
        expect(line).not.toContain('200');
    });

    it('🔴 ตัด query string ทิ้งเสมอ — ไม่พาคำค้นของผู้ใช้ลง log', () => {
        const res = makeRes(true);
        slowRequestLog(makeReq('/api/v1/users/search?q=สมชาย%20ใจดี&page=2'), res, vi.fn() as NextFunction);
        vi.advanceTimersByTime(3000);
        res.emit('close');

        const line = String(warn.mock.calls[0]![0]);
        expect(line).toContain('/api/v1/users/search');
        expect(line).not.toContain('q=');
        expect(line).not.toContain('สมชาย');
    });

    it('ตั้ง SLOW_REQUEST_MS = 0 → ปิดสนิท ไม่ผูก listener เลย', () => {
        env.SLOW_REQUEST_MS = 0;
        const res = makeRes(true);
        slowRequestLog(makeReq('/api/v1/teams'), res, vi.fn() as NextFunction);
        expect(res.listenerCount('close')).toBe(0);

        vi.advanceTimersByTime(60_000);
        res.emit('close');
        expect(warn).not.toHaveBeenCalled();
    });
});
