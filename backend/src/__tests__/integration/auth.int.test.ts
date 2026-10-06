import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { anon, as } from './helpers/api.js';
import { createUser, createUserWithPassword } from './helpers/factories.js';
import { testDb } from './helpers/db.js';

/**
 * ด่านยืนยันตัวตน (requireAuth) — ยิงผ่าน route จริง ไม่ mock อะไรเลยนอกจาก SMTP/S3
 * ใช้ GET /me เป็นตัวแทน เพราะมีแค่ requireAuth ด่านเดียว ⇒ ผลที่ได้คือผลของด่านนี้ล้วน ๆ
 */
describe('requireAuth — ผ่าน route จริง', () => {
  it('ไม่มี token → 401 NO_TOKEN', async () => {
    const res = await anon.get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_TOKEN');
  });

  it.each([
    ['ไม่มีคำว่า Bearer', 'abc.def.ghi'],
    ['Bearer แต่ไม่มี token', 'Bearer'],
    ['scheme อื่น', 'Basic dXNlcjpwYXNz'],
  ])('header ผิดรูป (%s) → 401 NO_TOKEN', async (_label, header) => {
    const res = await anon.get('/me').set('Authorization', header);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_TOKEN');
  });

  it('token เซ็นด้วย secret อื่น (ปลอม) → 401 และไม่หลุดไปถึงข้อมูลผู้ใช้', async () => {
    const victim = await createUser();
    const forged = jwt.sign({ sub: String(victim.id) }, 'attacker-secret', { expiresIn: '1h' });
    const res = await as({ token: forged }).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    expect(JSON.stringify(res.body)).not.toContain(victim.email);
  });

  it('token หมดอายุ → 401 TOKEN_EXPIRED', async () => {
    const user = await createUser();
    const expired = jwt.sign({ sub: String(user.id), exp: Math.floor(Date.now() / 1000) - 60 }, process.env['JWT_SECRET']!);
    const res = await as({ token: expired }).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('token ถูกต้องแต่ผู้ใช้ไม่มีในฐานแล้ว → 401 USER_NOT_FOUND', async () => {
    const user = await createUser();
    await testDb().query('DELETE FROM users WHERE user_id = ?', [user.id]);
    const res = await as(user).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('ผู้ใช้ถูกระงับถาวร → 403 ACCOUNT_SUSPENDED แม้ token ยังไม่หมดอายุ', async () => {
    const user = await createUser({ suspended: true });
    const res = await as(user).get('/me');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('ระงับแบบมีกำหนดและพ้นกำหนดแล้ว → ใช้งานได้ตามปกติ', async () => {
    const user = await createUser({ suspended: true, suspendedUntil: new Date(Date.now() - 3600_000) });
    const res = await as(user).get('/me');
    expect(res.status).toBe(200);
  });

  it('token ถูกต้อง → 200 และได้ข้อมูลของ "เจ้าของ token" เท่านั้น', async () => {
    const me = await createUser({ fullName: 'สมชาย ทดสอบ' });
    await createUser({ fullName: 'คนอื่น' });
    const res = await as(me).get('/me');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('สมชาย ทดสอบ');
    expect(JSON.stringify(res.body)).not.toContain('คนอื่น');
  });
});

describe('POST /auth/login — ต่อฐานจริงและ bcrypt จริง', () => {
  it('รหัสถูก → ได้ token ที่ใช้เรียก /me ได้จริง', async () => {
    const user = await createUserWithPassword('Correct-Pass-123');
    const login = await anon.post('/auth/login').send({ email: user.email, password: 'Correct-Pass-123' });
    expect(login.status).toBe(200);
    expect(typeof login.body.accessToken).toBe('string');

    const me = await as({ token: login.body.accessToken }).get('/me');
    expect(me.status).toBe(200);
  });

  it('รหัสผิด กับ อีเมลไม่มีในระบบ → ตอบเหมือนกันทุกตัวอักษร (ไม่บอกว่าอีเมลนี้มีอยู่)', async () => {
    const user = await createUserWithPassword('Correct-Pass-123');
    const wrongPass = await anon.post('/auth/login').send({ email: user.email, password: 'Wrong-Pass-123' });
    const noUser = await anon.post('/auth/login').send({ email: 'nobody@test.local', password: 'Wrong-Pass-123' });

    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPass.body).toEqual(noUser.body);
  });

  it('ผู้ใช้ถูกระงับ → login ไม่ได้ (403) แม้รหัสถูก', async () => {
    const user = await createUserWithPassword('Correct-Pass-123', { suspended: true });
    const res = await anon.post('/auth/login').send({ email: user.email, password: 'Correct-Pass-123' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});
