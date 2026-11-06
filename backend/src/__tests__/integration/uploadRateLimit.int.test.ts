import { describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { createUser } from './helpers/factories.js';
import { MAX_PRESIGN_PER_USER } from '../../middlewares/rateLimitPresign.js';

/**
 * 🔴 QA 30 ต.ค. 2569 (D1 · ทางเบา) — `POST /uploads/presign` จำกัด 30 ครั้ง/ชม./ผู้ใช้
 *
 * ★ ยิงด้วย body ผิดรูป (ได้ 400 จาก validate) — ตัวจำกัดอยู่ก่อน validate จึงนับทุกคำขอ
 *   และไม่ต้องแตะ S3 (บล็อกใน integration)
 */
const ask = (who: { token: string }) => as(who).post('/uploads/presign').send({ purpose: 'avatar', contentType: 'image/gif' });

describe('จำกัดการขอลิงก์อัปโหลด', () => {
  it('🔴 30 ครั้งแรกถึง validate (400) · ครั้งที่ 31 ได้ 429 TOO_MANY_UPLOADS พร้อม Retry-After', async () => {
    const user = await createUser();
    for (let i = 0; i < MAX_PRESIGN_PER_USER; i++) expect((await ask(user)).status).toBe(400);

    const blocked = await ask(user);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_UPLOADS');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('★ นับต่อผู้ใช้ — คนอื่นไม่พลอยติด', async () => {
    const heavy = await createUser();
    const other = await createUser();
    for (let i = 0; i < MAX_PRESIGN_PER_USER; i++) await ask(heavy);
    expect((await ask(heavy)).status).toBe(429);
    expect((await ask(other)).status).toBe(400);
  });

  it('ไม่ได้ล็อกอิน → 401 (ด่านล็อกอินมาก่อนตัวจำกัด)', async () => {
    expect((await anon.post('/uploads/presign').send({ purpose: 'avatar', contentType: 'image/png' })).status).toBe(401);
  });
});
