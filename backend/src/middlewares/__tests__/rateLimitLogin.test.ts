import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Request, Response, NextFunction } from 'express';
import { rateLimitLogin, resetLoginRateLimit } from '../rateLimitLogin.js';
import { AppError } from '../../utils/AppError.js';

/**
 * BE-06 — จำกัดการล็อกอินผิด: 10 ครั้งต่อ (IP, อีเมล) · 60 ครั้งต่อ IP · หน้าต่าง 15 นาที
 * res จำลองเป็น EventEmitter เพื่อยิง 'finish' พร้อม statusCode เหมือน express ส่งคำตอบจริง
 */

const WINDOW_MS = 15 * 60 * 1000;

type FakeRes = EventEmitter & { statusCode: number; setHeader: ReturnType<typeof vi.fn> };

function attempt(opts: { ip?: string | undefined; email?: unknown; body?: unknown; status?: number }) {
  const req = {
    ip: 'ip' in opts ? opts.ip : '10.0.0.1',
    body: 'body' in opts ? opts.body : { email: opts.email ?? 'a@test.ac.th' },
  } as unknown as Request;
  const res = Object.assign(new EventEmitter(), { statusCode: 200, setHeader: vi.fn() }) as FakeRes;
  const next = vi.fn();

  rateLimitLogin(req, res as unknown as Response, next as NextFunction);

  const error = next.mock.calls[0]?.[0] as AppError | undefined;
  // ผ่านด่าน ⇒ จำลองว่า route ตอบกลับไปแล้วด้วย status ที่กำหนด
  if (error === undefined && opts.status !== undefined) {
    res.statusCode = opts.status;
    res.emit('finish');
  }
  return { res, next, error };
}

function fail(times: number, opts: { ip?: string; email?: string } = {}) {
  for (let i = 0; i < times; i++) {
    const { error } = attempt({ ...opts, status: 401 });
    expect(error, `attempt ${i + 1} should not be blocked yet`).toBeUndefined();
  }
}

beforeEach(() => {
  resetLoginRateLimit();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimitLogin — per (IP, email)', () => {
  it('lets a fresh attempt through with a plain next()', () => {
    const { next, res } = attempt({ status: 200 });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('allows 10 failed attempts, then blocks the 11th with 429 + Retry-After', () => {
    fail(10);

    const { error, res } = attempt({ status: 401 });

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      status: 429,
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      extra: { retryAfterSeconds: WINDOW_MS / 1000 },
    });
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', String(WINDOW_MS / 1000));
  });

  it('blocks even a correct password once the quota is used up (checked before the route runs)', () => {
    fail(10);
    const { error, next } = attempt({ status: 200 });
    expect(error).toMatchObject({ status: 429 });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('Retry-After counts down with the remaining window', () => {
    fail(10);
    vi.advanceTimersByTime(5 * 60 * 1000);

    const { error, res } = attempt({});
    expect(error?.extra).toEqual({ retryAfterSeconds: 600 });
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '600');
  });

  it('Retry-After never goes below 1 second', () => {
    fail(10);
    vi.advanceTimersByTime(WINDOW_MS - 1);

    const { error } = attempt({});
    expect(error?.extra).toEqual({ retryAfterSeconds: 1 });
  });

  it('opens again once the 15-minute window has passed', () => {
    fail(10);
    vi.advanceTimersByTime(WINDOW_MS);

    const { error } = attempt({ status: 401 });
    expect(error).toBeUndefined();
  });

  it('treats the email case-insensitively', () => {
    fail(5, { email: 'User@Test.ac.th' });
    fail(5, { email: 'user@test.ac.th' });

    expect(attempt({ email: 'USER@TEST.AC.TH' }).error).toMatchObject({ status: 429 });
  });

  it('does not lock the same email from a different IP (account is not locked everywhere)', () => {
    fail(10, { ip: '10.0.0.1' });

    expect(attempt({ ip: '10.0.0.1' }).error).toMatchObject({ status: 429 });
    expect(attempt({ ip: '10.0.0.2' }).error).toBeUndefined();
  });

  it('does not lock a different email from the same IP', () => {
    fail(10, { email: 'victim@test.ac.th' });
    expect(attempt({ email: 'someone-else@test.ac.th' }).error).toBeUndefined();
  });
});

describe('rateLimitLogin — what counts as a failure', () => {
  it('a successful login clears the (IP, email) counter', () => {
    fail(9);
    attempt({ status: 200 });
    fail(10); // ถ้าไม่ล้าง ครั้งที่ 10 ตรงนี้จะโดนบล็อก
    expect(attempt({}).error).toMatchObject({ status: 429 });
  });

  it.each([403, 400, 500])('status %i is not counted as a guess', (status) => {
    for (let i = 0; i < 20; i++) attempt({ status });
    expect(attempt({}).error).toBeUndefined();
  });

  it('a non-401 error response does not clear earlier failures', () => {
    fail(9);
    attempt({ status: 403 });
    fail(1);
    expect(attempt({}).error).toMatchObject({ status: 429 });
  });

  it('a blocked attempt does not extend or add to the counter', () => {
    fail(10);
    for (let i = 0; i < 5; i++) attempt({ status: 401 });
    vi.advanceTimersByTime(WINDOW_MS);
    expect(attempt({}).error).toBeUndefined();
  });
});

describe('rateLimitLogin — per IP across all emails', () => {
  it('blocks the IP after 60 failures spread over many emails, even for a new email', () => {
    for (let i = 0; i < 60; i++) fail(1, { email: `user${i}@test.ac.th` });

    expect(attempt({ email: 'brand-new@test.ac.th' }).error).toMatchObject({
      status: 429,
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
    });
    expect(attempt({ ip: '10.0.0.99', email: 'brand-new@test.ac.th' }).error).toBeUndefined();
  });

  it('a successful login does not reset the IP counter', () => {
    for (let i = 0; i < 59; i++) fail(1, { email: `user${i}@test.ac.th` });
    attempt({ email: 'user0@test.ac.th', status: 200 });
    fail(1, { email: 'another@test.ac.th' });

    expect(attempt({ email: 'yet-another@test.ac.th' }).error).toMatchObject({ status: 429 });
  });
});

describe('rateLimitLogin — odd input', () => {
  it.each([
    ['no body', undefined],
    ['email is not a string', { email: 12345 }],
    ['body without email', {}],
  ])('%s still goes through and is counted under an empty email', (_label, body) => {
    for (let i = 0; i < 10; i++) {
      expect(attempt({ body, status: 401 }).error).toBeUndefined();
    }
    expect(attempt({ body: {} }).error).toMatchObject({ status: 429 });
  });

  it('falls back to "unknown" when req.ip is missing', () => {
    for (let i = 0; i < 10; i++) attempt({ ip: undefined, status: 401 });
    expect(attempt({ ip: undefined }).error).toMatchObject({ status: 429 });
    expect(attempt({ ip: '10.0.0.1' }).error).toBeUndefined();
  });

  it('resetLoginRateLimit() clears every counter', () => {
    fail(10);
    resetLoginRateLimit();
    expect(attempt({}).error).toBeUndefined();
  });

  it('keeps working after more than 1000 distinct keys (sweep path)', () => {
    for (let i = 0; i < 1100; i++) attempt({ ip: `10.1.${Math.floor(i / 250)}.${i % 250}`, status: 401 });
    vi.advanceTimersByTime(WINDOW_MS);

    fail(10, { ip: '10.9.9.9' });
    expect(attempt({ ip: '10.9.9.9' }).error).toMatchObject({ status: 429 });
  });
});
