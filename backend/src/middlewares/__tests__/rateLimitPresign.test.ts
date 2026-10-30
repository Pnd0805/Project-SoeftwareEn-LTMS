import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { MAX_PRESIGN_PER_USER, PRESIGN_WINDOW_MS, rateLimitPresign, resetPresignRateLimit } from '../rateLimitPresign.js';

/** QA 30 ต.ค. 2569 (D1) — ตัวจำกัดจำนวนครั้งที่ขอลิงก์อัปโหลด ต่อผู้ใช้ */
const reqOf = (userId: number) => ({ user: { user_id: userId } }) as unknown as Request;
const resOf = () => ({ setHeader: vi.fn() }) as unknown as Response;
const hit = (userId: number) => {
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  const res = resOf();
  rateLimitPresign(reqOf(userId), res, next);
  return { next, res };
};

beforeEach(() => {
  resetPresignRateLimit();
  vi.useRealTimers();
});

describe('rateLimitPresign', () => {
  it('30 ครั้งแรกผ่าน · ครั้งที่ 31 ได้ 429 TOO_MANY_UPLOADS พร้อม Retry-After', () => {
    for (let i = 0; i < MAX_PRESIGN_PER_USER; i++) expect(hit(1).next).toHaveBeenCalledWith();
    const { next, res } = hit(1);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 429, code: 'TOO_MANY_UPLOADS' }));
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('🔴 นับทุกคำขอที่ผ่าน ไม่ใช่เฉพาะที่ล้มเหลว (ต่างจาก rateLimitLogin)', () => {
    expect(MAX_PRESIGN_PER_USER).toBe(30);
    for (let i = 0; i < MAX_PRESIGN_PER_USER; i++) hit(1);
    expect(hit(1).next).toHaveBeenCalledWith(expect.objectContaining({ status: 429 }));
  });

  it('★ คีย์เป็นผู้ใช้ — คนอื่นไม่พลอยติด', () => {
    for (let i = 0; i < MAX_PRESIGN_PER_USER; i++) hit(1);
    expect(hit(2).next).toHaveBeenCalledWith();
  });

  it('พ้นหน้าต่าง 1 ชม. แล้วขอได้ใหม่', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T10:00:00Z'));
    for (let i = 0; i < MAX_PRESIGN_PER_USER; i++) hit(1);
    expect(hit(1).next).toHaveBeenCalledWith(expect.objectContaining({ status: 429 }));
    vi.setSystemTime(new Date(Date.parse('2026-10-30T10:00:00Z') + PRESIGN_WINDOW_MS));
    expect(hit(1).next).toHaveBeenCalledWith();
  });
});
