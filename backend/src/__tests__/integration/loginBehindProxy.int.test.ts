import { afterEach, describe, expect, it } from 'vitest';
import { anon } from './helpers/api.js';
import { createUserWithPassword } from './helpers/factories.js';
import app from '../../app.js';
import { env } from '../../config/env.js';

/**
 * 🔴 bug hunt 30 ต.ค. 2569 ข้อ 1 — อยู่หลัง nginx แล้วคนเดียวทำให้ทั้งเว็บล็อกอินไม่ได้
 *
 * ใน docker-compose ทุกคำขอมาจาก nginx ⇒ ไม่ตั้ง trust proxy = ทุกคนเป็นไอพีเดียว
 *   ⇒ เพดาน 60 ครั้งต่อไอพีของ rateLimitLogin กลายเป็นเพดานของทั้งเว็บ
 * ★ เทสจำลอง nginx ด้วย header X-Forwarded-For แบบที่ nginx ส่งจริง (`$proxy_add_x_forwarded_for`
 *   = ค่าที่ client ส่งมา + ", " + ไอพีจริง) แล้วตั้ง `trust proxy` = 1 แบบที่ docker-compose ตั้ง
 */
const PASSWORD = 'Passw0rd-123';
const wrong = (email: string, xff: string) =>
  anon.post('/auth/login').set('X-Forwarded-For', xff).send({ email, password: 'ผิดแน่นอน-123' });

afterEach(() => { app.set('trust proxy', env.TRUST_PROXY); });

// ★ ต้องมาก่อนกลุ่มหลัง nginx — afterEach ของกลุ่มนั้นตั้งค่ากลับจาก env ซึ่งจะกลบการตรวจว่า app.ts ตั้งจริงไหม
describe('รัน backend ตรง ๆ (ค่าตั้งต้น TRUST_PROXY=0)', () => {
  it('ค่าตั้งต้นคือไม่เชื่อ header · app.ts เอาค่าจาก env ไปตั้งจริง', () => {
    expect(env.TRUST_PROXY).toBe(0);
    expect(app.get('trust proxy')).toBe(0);   // ไม่มีบรรทัด app.set ใน app.ts = undefined/false
  });

  it('ปลอม X-Forwarded-For ไม่ช่วยหลบตัวจำกัด — ไอพีมาจากการเชื่อมต่อจริงเท่านั้น', async () => {
    const user = await createUserWithPassword(PASSWORD);
    for (let i = 0; i < 10; i++) await wrong(user.email, `10.0.0.${i}`);
    expect((await wrong(user.email, '10.0.0.99')).status).toBe(429);
  });
});

describe('หลัง nginx (TRUST_PROXY=1)', () => {
  it('🔴 คนร้ายจากไอพี A ยิงผิด 60 ครั้ง → คนอื่นจากไอพี B ยังล็อกอินได้', async () => {
    app.set('trust proxy', 1);
    const victim = await createUserWithPassword(PASSWORD);
    for (let i = 0; i < 60; i++) {
      expect((await wrong(`random-${i}@test.local`, '203.0.113.10')).status).toBe(401);
    }
    expect((await wrong('one-more@test.local', '203.0.113.10')).status).toBe(429);   // ไอพี A โดนจริง

    const ok = await anon.post('/auth/login').set('X-Forwarded-For', '198.51.100.20')
      .send({ email: victim.email, password: PASSWORD });
    expect(ok.status).toBe(200);
  });

  it('🔴 ปลอม X-Forwarded-For มาข้างหน้า → ไม่มีผล ยังนับเป็นไอพีจริงที่ nginx ต่อท้าย', async () => {
    app.set('trust proxy', 1);
    for (let i = 0; i < 60; i++) {
      await wrong(`random-${i}@test.local`, `10.9.${i}.1, 203.0.113.10`);
    }
    expect((await wrong('one-more@test.local', '10.255.255.1, 203.0.113.10')).status).toBe(429);
  });
});
