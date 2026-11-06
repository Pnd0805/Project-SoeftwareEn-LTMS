import { describe, expect, it } from 'vitest';
import { api, BASE } from './helpers/api.js';

/**
 * 🆕 29 ต.ค. 2569 (FE round 7 ขอ — ทุก error ต้องมี `code` คงที่)
 *
 * ยิงผ่าน app จริง (app.ts) ไม่ใช่ express ตัวทดลอง — พิสูจน์ว่าลำดับ middleware ถูก:
 *   express.json() อยู่ก่อน route · errorHandler อยู่ท้ายสุด ⇒ error ของ body ไปถึง errorHandler จริง
 * เดิม: JSON เสีย / body ใหญ่เกิน → 500 INTERNAL_ERROR (FE ขึ้น "ระบบผิดพลาด" ทั้งที่คนเรียกส่งผิด)
 */
describe('body ที่ส่งมาเสีย — ผ่าน app จริง', () => {
  it('JSON เสีย → 400 INVALID_JSON', async () => {
    const res = await api().post(`${BASE}/auth/login`).set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('body ใหญ่เกินกำหนด → 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await api().post(`${BASE}/auth/login`).set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@ku.th', password: 'x'.repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('เส้นที่ไม่มีอยู่จริง → 404 NOT_FOUND (มี code เหมือนกัน)', async () => {
    const res = await api().get(`${BASE}/no-such-route`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
