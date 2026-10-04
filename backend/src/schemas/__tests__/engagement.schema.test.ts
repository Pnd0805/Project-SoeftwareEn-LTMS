import { describe, it, expect } from 'vitest';
import { predictionSchema } from '../engagement.schema.js';

/**
 * OD-56 (4 ต.ค.) — เปลี่ยนจาก `{ teamId }` เป็น `{ scoreData }`
 *
 * ★ เทสชุดนี้ตรึงแค่เรื่องที่ schema รู้ได้เอง (รูปร่าง + ชนิด + ติดลบ)
 *   ส่วน "key ต้องเป็นสองทีมของแมตช์นั้น" และ "ห้ามทายเสมอ" อยู่ที่ service
 *   เพราะ schema ไม่รู้ว่าแมตช์ไหนมีทีมอะไร — ดู pickem.service.test.ts
 */
describe('predictionSchema', () => {
  it('รับสกอร์ของสองทีมเป็นจำนวนเต็ม', () => {
    const result = predictionSchema.safeParse({ scoreData: { '10': 2, '11': 1 } });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ scoreData: { '10': 2, '11': 1 } });
    }
  });

  it('รับคะแนน 0 ได้ — ชนะ 3-0 เป็นผลที่เกิดได้จริง', () => {
    expect(predictionSchema.safeParse({ scoreData: { '10': 3, '11': 0 } }).success).toBe(true);
  });

  // ★ schema ไม่ห้ามเสมอ ปล่อยให้ service ตรวจ — ถ้าห้ามที่นี่ด้วยจะมีกฎเดียวกันสองที่
  it('ไม่ปฏิเสธการทายเสมอที่ชั้นนี้ (service เป็นคนห้าม)', () => {
    expect(predictionSchema.safeParse({ scoreData: { '10': 2, '11': 2 } }).success).toBe(true);
  });

  it('ไม่รับ scoreData ที่ขาดไป', () => {
    expect(predictionSchema.safeParse({}).success).toBe(false);
  });

  it('ไม่รับคะแนนติดลบ พร้อมข้อความ "คะแนนต้องไม่ติดลบ"', () => {
    const result = predictionSchema.safeParse({ scoreData: { '10': -1, '11': 1 } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.message === 'คะแนนต้องไม่ติดลบ')).toBe(true);
    }
  });

  it('ไม่รับคะแนนที่ไม่ใช่จำนวนเต็ม พร้อมข้อความ "คะแนนต้องเป็นจำนวนเต็ม"', () => {
    const result = predictionSchema.safeParse({ scoreData: { '10': 1.5, '11': 1 } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.message === 'คะแนนต้องเป็นจำนวนเต็ม')).toBe(true);
    }
  });

  it('ไม่แปลงสตริงเป็นเลขให้ (no implicit coercion)', () => {
    expect(predictionSchema.safeParse({ scoreData: { '10': '2', '11': 1 } }).success).toBe(false);
  });

  it('ไม่รับ null / undefined', () => {
    expect(predictionSchema.safeParse({ scoreData: null }).success).toBe(false);
    expect(predictionSchema.safeParse({ scoreData: undefined }).success).toBe(false);
  });

  // ★ teamId ต้องไม่ถูกรับเข้ามาอีกแล้ว — ถ้ารับ จะมีสองแหล่งที่บอกว่าใครชนะแล้วขัดกันเองได้
  it('ไม่มี teamId ในผลลัพธ์แม้ส่งมา — ผู้ชนะต้องมาจากสกอร์เท่านั้น', () => {
    const result = predictionSchema.safeParse({ scoreData: { '10': 2, '11': 1 }, teamId: 11 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('teamId');
    }
  });

  it('ส่งแค่ teamId แบบเดิมไม่ผ่านแล้ว', () => {
    expect(predictionSchema.safeParse({ teamId: 5 }).success).toBe(false);
  });
});
