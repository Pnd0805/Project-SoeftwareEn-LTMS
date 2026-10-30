import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { rateLimitEmail, resetEmailRateLimit } from '../rateLimitEmail.js';
import { AppError } from '../../utils/AppError.js';

/**
 * QA 30 ต.ค. 2569 ข้อ 1 — เพดานต่อ IP ของเส้นที่ทำให้ระบบส่งอีเมลออก
 * 20 ครั้ง/ชม./IP · นับทุกคำขอไม่ว่าผลเป็นอย่างไร (ต่างจาก rateLimitLogin ที่นับเฉพาะที่ล้มเหลว)
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 20;

function call(ip: string | undefined = '10.0.0.1') {
    const req = { ip } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;
    const next = vi.fn();
    rateLimitEmail(req, res, next as unknown as NextFunction);
    return { res, next, error: next.mock.calls[0]?.[0] as AppError | undefined };
}

function callTimes(times: number, ip?: string) {
    for (let i = 0; i < times; i++) call(ip);
}

beforeEach(() => {
    resetEmailRateLimit();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    resetEmailRateLimit();
});

describe('rateLimitEmail', () => {
    it('lets the first request through with no error', () => {
        const { error, next } = call();
        expect(error).toBeUndefined();
        expect(next).toHaveBeenCalledWith();
    });

    it(`allows exactly ${MAX_PER_IP} requests then blocks the next one`, () => {
        callTimes(MAX_PER_IP);
        const { error } = call();
        expect(error).toMatchObject({ status: 429, code: 'TOO_MANY_EMAIL_REQUESTS' });
    });

    // 🔴 จุดต่างสำคัญจาก rateLimitLogin — ที่นี่คำขอที่สำเร็จก็ถูกนับ
    //    เพราะคำขอที่สำเร็จนี่แหละคือสิ่งที่ทำให้อีเมลถูกส่งออก
    it('counts successful requests too, not only failures', () => {
        // ไม่มีการยิง event 'finish' หรือกำหนด statusCode เลย — ถึงอย่างนั้นก็ยังถูกนับ
        callTimes(MAX_PER_IP);
        expect(call().error).toMatchObject({ code: 'TOO_MANY_EMAIL_REQUESTS' });
    });

    it('sets Retry-After in seconds when blocked', () => {
        callTimes(MAX_PER_IP);
        const { res, error } = call();
        expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.stringMatching(/^\d+$/));
        expect(error?.extra?.['retryAfterSeconds']).toBeGreaterThan(0);
    });

    it('counts each IP separately', () => {
        callTimes(MAX_PER_IP, '10.0.0.1');
        expect(call('10.0.0.2').error).toBeUndefined();
    });

    // ★ ต่างจาก rateLimitLogin โดยเจตนา: อีเมลไม่ได้อยู่ในคีย์
    //   เพราะการโจมตีที่แพงที่สุดคือ "อีเมลใหม่ทุกครั้ง" ⇒ เพดานต่อคู่ (IP, อีเมล) จับไม่ได้เลย
    it('blocks even when every request uses a different email', () => {
        for (let i = 0; i < MAX_PER_IP; i++) {
            const req = { ip: '10.0.0.1', body: { email: `user${i}@ku.th` } } as unknown as Request;
            rateLimitEmail(req, { setHeader: vi.fn() } as unknown as Response, vi.fn() as unknown as NextFunction);
        }
        expect(call().error).toMatchObject({ code: 'TOO_MANY_EMAIL_REQUESTS' });
    });

    it('starts a fresh window after the hour passes', () => {
        callTimes(MAX_PER_IP);
        expect(call().error).toBeDefined();

        vi.advanceTimersByTime(WINDOW_MS + 1);
        expect(call().error).toBeUndefined();
    });

    it('treats a missing ip as one shared bucket instead of crashing', () => {
        callTimes(MAX_PER_IP, undefined);
        expect(call(undefined).error).toMatchObject({ code: 'TOO_MANY_EMAIL_REQUESTS' });
    });
});
