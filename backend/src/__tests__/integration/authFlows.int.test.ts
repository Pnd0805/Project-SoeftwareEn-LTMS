import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { insert, one, testDb } from './helpers/db.js';
import { mailbox } from './helpers/mailbox.js';
import { createFaculty, createUserWithPassword } from './helpers/factories.js';

/**
 * สมัคร → ยืนยันอีเมลด้วย OTP · ลืมรหัส → ลิงก์ในเมล → ตั้งรหัสใหม่
 *
 * ★ อ่าน OTP/ลิงก์จาก mailbox (SMTP ปลอม) แบบเดียวกับที่ผู้ใช้อ่านจากกล่องจดหมายจริง
 *   ⇒ พิสูจน์ทั้งเส้น: service ออกรหัส → ส่งเมล → ผู้ใช้กรอก → ฐานเปลี่ยน
 */

let faculty: number;
let department: number;

beforeEach(async () => {
  faculty = await createFaculty();
  department = await insert('departments', { faculty_id: faculty, name: 'ภาคทดสอบ' });
});

const registration = (email: string) => ({
  fullName: 'สมหญิง ทดสอบ', email, password: 'Passw0rd-123', gender: 'female',
  birthDate: '2004-02-02', facultyId: faculty, departmentId: department, year: 2,
});
const otpIn = (email: string) => mailbox.lastTo(email)!.text.match(/\b(\d{6})\b/)![1]!;
const resetTokenIn = (email: string) => mailbox.lastTo(email)!.text.match(/token=([0-9a-f]+)/)![1]!;
const verified = async (email: string) =>
  (await one<{ email_verified: number }>('SELECT email_verified FROM users WHERE email = ?', [email]))!.email_verified === 1;

// ───────────────────────────── สมัคร + ยืนยันอีเมล ─────────────────────────────

describe('สมัครสมาชิกและยืนยันอีเมล', () => {
  it('สมัคร → ได้เมล OTP · กรอกรหัสจากเมล → ยืนยันสำเร็จ · ล็อกอินได้', async () => {
    const email = 'new.user@test.local';
    const res = await anon.post('/auth/register').send(registration(email));
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('code');                // OTP ไม่หลุดออกทาง response
    expect(JSON.stringify(res.body)).not.toMatch(/\b\d{6}\b/);
    expect(await verified(email)).toBe(false);

    expect((await anon.post('/auth/verify-email').send({ email, code: otpIn(email) })).status).toBe(200);
    expect(await verified(email)).toBe(true);
    expect((await anon.post('/auth/login').send({ email, password: 'Passw0rd-123' })).status).toBe(200);
  });

  it('รหัสผิด → 400 · ยังไม่ยืนยัน', async () => {
    const email = 'wrong.code@test.local';
    await anon.post('/auth/register').send(registration(email));
    const wrong = otpIn(email) === '000000' ? '111111' : '000000';
    expect((await anon.post('/auth/verify-email').send({ email, code: wrong })).status).toBe(400);
    expect(await verified(email)).toBe(false);
  });

  it('🔒 OTP ใช้ได้กับอีเมลที่ได้รับเท่านั้น — เอารหัสของตัวเองไปยืนยันอีเมลคนอื่นไม่ได้', async () => {
    await anon.post('/auth/register').send(registration('attacker@test.local'));
    await anon.post('/auth/register').send(registration('victim@test.local'));
    const res = await anon.post('/auth/verify-email').send({ email: 'victim@test.local', code: otpIn('attacker@test.local') });
    expect(res.status).toBe(400);
    expect(await verified('victim@test.local')).toBe(false);
  });

  it('สมัครซ้ำด้วยอีเมลเดิม → 400 EMAIL_ALREADY_REGISTERED · ไม่มีบัญชีที่สอง', async () => {
    const email = 'dup@test.local';
    expect((await anon.post('/auth/register').send(registration(email))).status).toBe(201);
    const again = await anon.post('/auth/register').send(registration(email));
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    expect((await one<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE email = ?', [email]))!.n).toBe(1);
  });

  it('ภาควิชาไม่อยู่ในคณะที่เลือก → 400 · ไม่สร้างบัญชี', async () => {
    const otherFaculty = await createFaculty();
    const res = await anon.post('/auth/register').send({ ...registration('mismatch@test.local'), facultyId: otherFaculty });
    expect(res.status).toBe(400);
    expect(await one("SELECT 1 FROM users WHERE email = 'mismatch@test.local'")).toBeNull();
  });

  it('รหัสผ่านอ่อน (ไม่มีตัวเลข / สั้นกว่า 8) → 400', async () => {
    for (const password of ['NoDigitsHere', 'abc1']) {
      expect((await anon.post('/auth/register').send({ ...registration(`weak-${password}@test.local`), password })).status).toBe(400);
    }
  });

  /**
   * 🔴 แก้ 6 ต.ค. 2569 ตอนรวมงาน user_type ของ vimsd (6b2311b)
   *   เดิมเทสนี้คาดว่า user_type = 'student' เพราะโค้ดฝัง 'student' ไว้ใน SQL
   *   ตอนนี้ระบบคิดจากโดเมนอีเมล (มติ ①ก3 · @ku.th) และอีเมลในเทสนี้ไม่ใช่ @ku.th
   *   ⇒ ค่าที่ถูกคือ 'external' · เจตนาของเทส (ผู้สมัครตั้ง user_type เองไม่ได้) ไม่เปลี่ยน
   *   ★ ยังเป็นเทสความปลอดภัยเหมือนเดิม: ส่ง userType: 'staff' มาแล้วต้องไม่ได้ 'staff'
   *     เพิ่มเคส @ku.th คู่กัน เพื่อให้เห็นว่าค่าที่ได้มาจากโดเมน ไม่ใช่มาจากคำขอ
   */
  it('🔒 ส่งฟิลด์ต้องห้ามตอนสมัคร (สิทธิ์แอดมิน/ยืนยันแล้ว/ชนิดผู้ใช้) → ไม่มีผล', async () => {
    const email = 'escalate@test.local';
    const res = await anon.post('/auth/register').send({
      ...registration(email), emailVerified: true, email_verified: 1, adminScope: 'university_wide', userType: 'staff',
    });
    expect(res.status).toBe(201);
    expect(await verified(email)).toBe(false);
    // 'external' เพราะโดเมนไม่ใช่ ku.th — ที่สำคัญคือ **ไม่ใช่ 'staff'** ที่ผู้สมัครส่งมา
    expect(await one('SELECT user_type FROM users WHERE email = ?', [email])).toEqual({ user_type: 'external' });
    expect(await one('SELECT 1 FROM admin_scopes WHERE user_id = ?', [res.body.id])).toBeNull();
  });

  it('ชนิดผู้ใช้มาจากโดเมนอีเมล: @ku.th → student แม้ส่ง userType อื่นมา', async () => {
    const email = 'nisit@ku.th';

    const res = await anon.post('/auth/register').send({ ...registration(email), userType: 'staff' });

    expect(res.status).toBe(201);
    expect(await one('SELECT user_type FROM users WHERE email = ?', [email])).toEqual({ user_type: 'student' });
  });

  it('ขอรหัสใหม่ → รหัสใหม่ใช้ได้', async () => {
    const email = 'resend@test.local';
    await anon.post('/auth/register').send(registration(email));
    expect((await anon.post('/auth/resend-verification').send({ email })).status).toBeLessThan(300);
    expect((await anon.post('/auth/verify-email').send({ email, code: otpIn(email) })).status).toBe(200);
    expect(await verified(email)).toBe(true);
  });

  it('ขอรหัสใหม่ด้วยอีเมลที่ไม่มีในระบบ → ตอบเหมือนกันทุกตัวอักษร (ไม่บอกว่ามีบัญชีไหม)', async () => {
    await anon.post('/auth/register').send(registration('exists@test.local'));
    const known = await anon.post('/auth/resend-verification').send({ email: 'exists@test.local' });
    const unknown = await anon.post('/auth/resend-verification').send({ email: 'nobody@test.local' });
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
  });
});

// ───────────────────────────── ลืมรหัสผ่าน ─────────────────────────────

describe('ลืมรหัสผ่าน → ลิงก์ในเมล → ตั้งรหัสใหม่', () => {
  it('ทั้งเส้น: ขอ → ได้เมลมีลิงก์ → ตั้งรหัสใหม่ → รหัสเก่าใช้ไม่ได้ · รหัสใหม่ใช้ได้', async () => {
    const user = await createUserWithPassword('OldPass-123');
    expect((await anon.post('/auth/forgot-password').send({ email: user.email })).status).toBe(200);
    const token = resetTokenIn(user.email);

    expect((await anon.post('/auth/reset-password').send({ token, newPassword: 'NewPass-456' })).status).toBe(200);
    expect((await anon.post('/auth/login').send({ email: user.email, password: 'OldPass-123' })).status).toBe(401);
    expect((await anon.post('/auth/login').send({ email: user.email, password: 'NewPass-456' })).status).toBe(200);
  });

  it('ลิงก์ใช้ได้ครั้งเดียว — ใช้ซ้ำ → 400', async () => {
    const user = await createUserWithPassword('OldPass-123');
    await anon.post('/auth/forgot-password').send({ email: user.email });
    const token = resetTokenIn(user.email);
    expect((await anon.post('/auth/reset-password').send({ token, newPassword: 'NewPass-456' })).status).toBe(200);
    expect((await anon.post('/auth/reset-password').send({ token, newPassword: 'Hijack-789' })).status).toBe(400);
    expect((await anon.post('/auth/login').send({ email: user.email, password: 'NewPass-456' })).status).toBe(200);
  });

  it('ขอลิงก์ใหม่ → ลิงก์เก่าใช้ไม่ได้ทันที', async () => {
    const user = await createUserWithPassword('OldPass-123');
    await anon.post('/auth/forgot-password').send({ email: user.email });
    const first = resetTokenIn(user.email);
    await anon.post('/auth/forgot-password').send({ email: user.email });
    expect((await anon.post('/auth/reset-password').send({ token: first, newPassword: 'NewPass-456' })).status).toBe(400);
  });

  it('อีเมลไม่มีในระบบ → ตอบเหมือนกันทุกตัวอักษร · ไม่มีเมลส่งออก', async () => {
    const user = await createUserWithPassword('OldPass-123');
    const known = await anon.post('/auth/forgot-password').send({ email: user.email });
    const unknown = await anon.post('/auth/forgot-password').send({ email: 'ghost@test.local' });
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(mailbox.lastTo('ghost@test.local')).toBeUndefined();
  });

  it('ส่งเมลไม่ได้ (SMTP ล่ม) → ยังตอบ 200 เหมือนเดิม (ไม่บอกผู้โจมตีว่ามีบัญชี)', async () => {
    const user = await createUserWithPassword('OldPass-123');
    mailbox.failNextSend();
    const original = console.error;
    console.error = () => {};   // log นี้คือสิ่งที่เทสตั้งใจให้เกิด
    try {
      expect((await anon.post('/auth/forgot-password').send({ email: user.email })).status).toBe(200);
    } finally {
      console.error = original;
    }
  });

  it('ผู้ใช้ถูกระงับ → ลิงก์ที่ออกก่อนระงับใช้ไม่ได้', async () => {
    const user = await createUserWithPassword('OldPass-123');
    await anon.post('/auth/forgot-password').send({ email: user.email });
    const token = resetTokenIn(user.email);
    await testDb().query('UPDATE users SET is_suspended = 1 WHERE user_id = ?', [user.id]);
    expect((await anon.post('/auth/reset-password').send({ token, newPassword: 'NewPass-456' })).status).toBe(400);
  });

  it('token มั่ว → 400 INVALID_RESET_TOKEN', async () => {
    const res = await anon.post('/auth/reset-password').send({ token: 'f'.repeat(64), newPassword: 'NewPass-456' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });
});

// ───────────────────────────── เซสชันหลังเปลี่ยนรหัส / ออกจากระบบ ─────────────────────────────

describe('เซสชัน', () => {
  it('logout ตอบ 204 · ต้องล็อกอินก่อน', async () => {
    const user = await createUserWithPassword('Passw0rd-123');
    expect((await anon.post('/auth/logout')).status).toBe(401);
    expect((await as(user).post('/auth/logout')).status).toBe(204);
  });

  /**
   * B1 — แก้แล้ว 6 ต.ค. 2569 (เดิมเป็น it.fails) · มติ ทางเลือก ข "เลขรุ่นของบัตร"
   *
   * เดิม: ตั้งรหัสผ่านใหม่แล้ว บัตรที่ออกก่อนหน้ายังใช้ได้จนหมดอายุเอง
   *   ⇒ เหตุผลหลักที่คนเปลี่ยนรหัส ("สงสัยว่ามีคนเข้าบัญชี") ไม่ถูกตอบสนอง
   * ตอนนี้: users.token_version บวก 1 ใน SQL เดียวกับการเขียนรหัสใหม่ (migration 046)
   *   บัตรพก tv ไปด้วย ⇒ requireAuth ปฏิเสธบัตรที่พกเลขเก่าทุกใบทุกเครื่อง
   */
  it('ตั้งรหัสผ่านใหม่แล้ว บัตรเดิมใช้ไม่ได้ทันที', async () => {
    const user = await createUserWithPassword('OldPass-123');
    expect((await as(user).get('/me')).status).toBe(200);

    await anon.post('/auth/forgot-password').send({ email: user.email });
    await anon.post('/auth/reset-password').send({ token: resetTokenIn(user.email), newPassword: 'NewPass-456' });

    expect((await as(user).get('/me')).status).toBe(401);
  });

  /** ★ บัตรใบใหม่ที่ได้จากการล็อกอินด้วยรหัสใหม่ ต้องใช้ได้ปกติ (ไม่ใช่เตะทุกคนออกถาวร) */
  it('ล็อกอินด้วยรหัสใหม่แล้วได้บัตรที่ใช้งานได้', async () => {
    const user = await createUserWithPassword('OldPass-123');
    await anon.post('/auth/forgot-password').send({ email: user.email });
    await anon.post('/auth/reset-password').send({ token: resetTokenIn(user.email), newPassword: 'NewPass-456' });

    const login = await anon.post('/auth/login').send({ email: user.email, password: 'NewPass-456' });
    expect(login.status).toBe(200);

    const fresh = { ...user, token: login.body.accessToken as string };
    expect((await as(fresh).get('/me')).status).toBe(200);
  });

  /**
   * ★ เตะเฉพาะบัญชีที่เปลี่ยนรหัส — ไม่ใช่เตะทุกคนในระบบ
   *   (ถ้าเลขรุ่นไปอยู่ที่อื่นที่ไม่ใช่ระดับบัญชี เทสนี้จะจับได้)
   */
  it('คนอื่นที่ไม่ได้เปลี่ยนรหัส บัตรยังใช้ได้', async () => {
    const user = await createUserWithPassword('OldPass-123');
    const other = await createUserWithPassword('OtherPass-123');

    await anon.post('/auth/forgot-password').send({ email: user.email });
    await anon.post('/auth/reset-password').send({ token: resetTokenIn(user.email), newPassword: 'NewPass-456' });

    expect((await as(other).get('/me')).status).toBe(200);
  });
});
