import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
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

/**
 * 🔴 มติ 8 ต.ค. 2569 — คณะ/ภาควิชา/ชั้นปี บังคับเฉพาะคนใน (@ku.th)
 *   ★ อีเมล `@test.local` ที่ไฟล์นี้ใช้ทั้งไฟล์คือ **คนนอก** ⇒ สามช่องนั้นไม่ถูกบังคับและไม่ถูกเก็บ
 *     เทสไหนที่ต้องการให้ด่านคณะทำงาน ต้องใช้ `kuRegistration()` (อีเมล @ku.th)
 */
const registration = (email: string) => ({
  fullName: 'สมหญิง ทดสอบ', email, password: 'Passw0rd-123', gender: 'female',
  birthDate: '2004-02-02', facultyId: faculty, departmentId: department, year: 2,
});
const kuRegistration = (local: string) => registration(`${local}@ku.th`);
const otpIn = (email: string) => mailbox.lastTo(email)!.text.match(/\b(\d{6})\b/)![1]!;
const resetTokenIn = (email: string) => mailbox.lastTo(email)!.text.match(/token=([0-9a-f]+)/)![1]!;
const verified = async (email: string) =>
  (await one<{ email_verified: number }>('SELECT email_verified FROM users WHERE email = ?', [email]))!.email_verified === 1;

/**
 * 🆕 BE-06 (7 ต.ค. 2569 · มติ ⑭ ค) — จำกัดจำนวนครั้งที่ล็อกอินผิด
 *
 * เดิมยิงรหัสผิด 12 ครั้งติดกันได้ 401 ทุกครั้ง ไม่มีหน่วง ไม่มีล็อก
 * ⇒ เครื่องเดารหัสทำงานได้เต็มความเร็วของเซิร์ฟเวอร์
 *
 * ★ ข้อจำกัดที่ยอมรับแล้วอยู่ในหัว `middlewares/rateLimitLogin.ts` (เก็บในหน่วยความจำ
 *   ของ process · หายเมื่อรีสตาร์ท · เพดานคูณตามจำนวน process)
 * ★ ตัวนับถูกล้างใน `setup/perFile.ts` ทุกเทส ⇒ เทสอื่นที่ยิงรหัสผิดไม่กวนกัน
 */
afterEach(() => { env.REQUIRE_EMAIL_VERIFIED = false; });   // บางเทสเปิดด่านเอง · ค่าของ .env.test คือปิด

/** ใบ OTP ของอีเมลนี้ทั้งหมด (ทุกสถานะ) */
const otpCount = async (email: string) => (await one<{ c: number }>(
  `SELECT COUNT(*) AS c FROM email_verification_otps o JOIN users u ON u.user_id = o.user_id WHERE u.email = ?`, [email]))!.c;
/** ย้อนเวลาออกใบ OTP ของอีเมลนี้ — ทดสอบ cooldown 60 วิ โดยไม่ต้องรอจริง */
const ageOtps = (email: string, seconds: number) => testDb().query(
  `UPDATE email_verification_otps o JOIN users u ON u.user_id = o.user_id
      SET o.created_at = o.created_at - INTERVAL ? SECOND WHERE u.email = ?`, [seconds, email]);

describe('จำกัดจำนวนครั้งที่ล็อกอินผิด (BE-06)', () => {
  const PASSWORD = 'Passw0rd-123';
  const wrongLogin = (email: string) => anon.post('/auth/login').send({ email, password: 'ผิดแน่นอน-123' });

  it('ยิงรหัสผิดเกินเพดาน → 429 TOO_MANY_LOGIN_ATTEMPTS พร้อม Retry-After', async () => {
    const user = await createUserWithPassword(PASSWORD);

    // 10 ครั้งแรกยัง 401 ตามเดิม (ไม่เปลี่ยนพฤติกรรมของการกรอกผิดธรรมดา)
    for (let i = 0; i < 10; i++) {
      expect((await wrongLogin(user.email)).status).toBe(401);
    }

    const blocked = await wrongLogin(user.email);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_LOGIN_ATTEMPTS');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  /**
   * 🔴 ข้อจำกัดที่ยอมรับแล้ว — เขียนเป็นเทสไว้เพื่อไม่ให้ใครเข้าใจผิดว่าด่านนี้แก้ครบ
   *
   * ด่านนี้ปฏิเสธ **ก่อน** ตรวจรหัสผ่าน ⇒ เมื่อโควตาของคู่ (IP, อีเมล) หมด
   * เจ้าของบัญชีที่มาจากไอพีเดียวกันก็เข้าไม่ได้แม้กรอกรหัสถูก (15 นาที)
   *
   * ★ ที่ดีขึ้นกว่าการนับที่ตาราง `users` คือ **ขอบเขต** ไม่ใช่การไม่มีผลกระทบ:
   *   นับที่บัญชี = ล็อกทุกเส้นทางทุกเครื่อง · นับที่ (IP, อีเมล) = เหยื่อย้ายเครือข่าย
   *   แล้วเข้าได้ทันที · ตอนแรกผมเขียนเทสนี้ไว้ว่า "รหัสที่ถูกยังเข้าได้" ซึ่ง**ผิด**
   *   และเทสเป็นตัวจับได้ — จึงแก้ทั้งเทสและคำอธิบายในไฟล์ middleware ให้ตรงความจริง
   */
  it('โควตาหมดแล้ว รหัสที่ถูกก็เข้าไม่ได้จนพ้นช่วงเวลา (ข้อจำกัดที่ยอมรับ)', async () => {
    const user = await createUserWithPassword(PASSWORD);
    for (let i = 0; i < 10; i++) await wrongLogin(user.email);

    const blocked = await anon.post('/auth/login').send({ email: user.email, password: PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_LOGIN_ATTEMPTS');
  });

  /** ★ อีเมลอื่นจากไอพีเดียวกันต้องไม่พลอยติด — เพดานต่อ IP หลวมกว่ามาก (NAT ของมหาวิทยาลัย) */
  it('อีเมลอื่นไม่พลอยติดด้วย', async () => {
    const victim = await createUserWithPassword(PASSWORD);
    const bystander = await createUserWithPassword(PASSWORD);

    for (let i = 0; i < 11; i++) await wrongLogin(victim.email);

    expect((await anon.post('/auth/login').send({ email: bystander.email, password: PASSWORD })).status).toBe(200);
  });

  it('กรอกผิดไม่ถึงเพดานแล้วเข้าถูก → ตัวนับถูกล้าง ยิงผิดใหม่ได้อีกเต็มโควตา', async () => {
    const user = await createUserWithPassword(PASSWORD);

    for (let i = 0; i < 5; i++) expect((await wrongLogin(user.email)).status).toBe(401);
    expect((await anon.post('/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(200);

    for (let i = 0; i < 10; i++) {
      expect((await wrongLogin(user.email)).status).toBe(401);
    }
  });
});

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

  /**
   * 🔴 bug hunt 30 ต.ค. 2569 ข้อ 8 — เดิมนับครั้งที่ผิด "หลัง" เทียบรหัส
   *   ⇒ ยิงพร้อมกันหลายคำขอ ทุกคำขอผ่านด่าน 5 ครั้งก่อนที่ตัวนับจะขึ้น ⇒ ได้เดาเกินโควตา
   */
  it('🔴 ยิงรหัสผิดพร้อมกัน 20 คำขอ → นับได้ไม่เกิน 5 · ใบนั้นตาย รหัสที่ถูกก็ใช้ไม่ได้แล้ว', async () => {
    const email = 'otp-race@test.local';
    await anon.post('/auth/register').send(registration(email));
    const right = otpIn(email);
    const wrong = right === '000000' ? '111111' : '000000';

    const codes = await Promise.all(Array.from({ length: 20 },
      () => anon.post('/auth/verify-email').send({ email, code: wrong }).then(r => r.status)));
    expect(new Set(codes)).toEqual(new Set([400]));

    const row = await one<{ attempt_count: number }>(
      `SELECT o.attempt_count FROM email_verification_otps o JOIN users u ON u.user_id = o.user_id WHERE u.email = ?`, [email]);
    expect(row!.attempt_count).toBe(5);
    expect((await anon.post('/auth/verify-email').send({ email, code: right })).status).toBe(400);
    expect(await verified(email)).toBe(false);
  });

  it('🔒 OTP ใช้ได้กับอีเมลที่ได้รับเท่านั้น — เอารหัสของตัวเองไปยืนยันอีเมลคนอื่นไม่ได้', async () => {
    await anon.post('/auth/register').send(registration('attacker@test.local'));
    await anon.post('/auth/register').send(registration('victim@test.local'));
    const res = await anon.post('/auth/verify-email').send({ email: 'victim@test.local', code: otpIn('attacker@test.local') });
    expect(res.status).toBe(400);
    expect(await verified('victim@test.local')).toBe(false);
  });

  /**
   * OD-53 (29 ต.ค. 2569) — เทสนี้เคยคาด 400 สำหรับการสมัครซ้ำ **ทุกกรณี**
   * ตอนนี้แยกเป็นสองเคสตามสถานะการยืนยัน เพราะของเดิมทำให้เกิดทางตัน:
   *   สมัคร → ไม่กรอก OTP → กลับมาสมัครใหม่ → "อีเมลนี้ถูกใช้แล้ว กรุณาเข้าสู่ระบบ"
   *   ทั้งที่ **เข้าสู่ระบบไม่ได้** (เมื่อด่านเปิด) และอีเมลนั้นเป็นของเขาเอง
   */
  // 🔴 bug hunt 30 ต.ค. ข้อ 2 — ทับใบเดิมได้เฉพาะตอนด่านเปิด (ด่านปิด = ยึดบัญชีได้ · เทสถัดไป)
  it('ด่านเปิด: สมัครซ้ำด้วยอีเมลที่ยังไม่ยืนยัน → 201 ทับใบเดิม · ยังมีบัญชีเดียว · รหัสใหม่ใช้ได้', async () => {
    env.REQUIRE_EMAIL_VERIFIED = true;
    const email = 'dup@test.local';
    expect((await anon.post('/auth/register').send(registration(email))).status).toBe(201);
    const firstId = (await one<{ user_id: number }>('SELECT user_id FROM users WHERE email = ?', [email]))!.user_id;

    const again = await anon.post('/auth/register')
      .send({ ...registration(email), fullName: 'ชื่อใหม่ หลังสมัครซ้ำ', password: 'Passw0rd-999' });
    expect(again.status).toBe(201);

    // 🔴 ต้องเป็นแถวเดิม ไม่ใช่บัญชีที่สอง (ไม่งั้นชน UNIQUE ของอีเมล)
    const row = (await one<{ user_id: number; full_name: string; n: number }>(
      'SELECT user_id , full_name , (SELECT COUNT(*) FROM users WHERE email = ?) AS n FROM users WHERE email = ?',
      [email, email]))!;
    expect(row.n).toBe(1);
    expect(row.user_id).toBe(firstId);
    // ข้อมูลต้องถูกทับด้วยของรอบใหม่ ไม่ใช่คงของเก่าไว้
    expect(row.full_name).toBe('ชื่อใหม่ หลังสมัครซ้ำ');

    // 🔴 ที่สำคัญสุด: รหัสผ่านรอบใหม่ต้องใช้ล็อกอินได้จริง
    //   ถ้าไม่ทับ password_hash เขาจะล็อกอินด้วยรหัสที่เพิ่งตั้งไม่ได้ และหาสาเหตุไม่เจอ
    //   ด่านเปิดอยู่ ⇒ ยังเข้าไม่ได้จนกว่าจะยืนยัน แต่ได้ 403 EMAIL_NOT_VERIFIED (ด่านนี้อยู่หลังด่านรหัสผ่าน = รหัสถูก)
    const login = await anon.post('/auth/login').send({ email, password: 'Passw0rd-999' });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  /**
   * 🔴 bug hunt 30 ต.ค. ข้อ 2 — ด่านปิด (ค่าตั้งต้น) คนที่ไม่ยืนยันใช้งานได้เต็มที่
   *   เดิม: คนร้ายสมัครด้วยอีเมลเหยื่อ → ทับรหัสผ่าน → ล็อกอินเป็นเหยื่อได้ทันที และเหยื่อไม่ถูกเด้งออก
   */
  it('🔴 ด่านปิด: สมัครซ้ำด้วยอีเมลที่ยังไม่ยืนยัน → 400 EMAIL_ALREADY_REGISTERED · รหัสเดิมยังใช้ได้ · คนร้ายเข้าไม่ได้', async () => {
    const email = 'victim-unverified@test.local';
    expect((await anon.post('/auth/register').send(registration(email))).status).toBe(201);
    const before = (await one<{ full_name: string; password_hash: string }>(
      'SELECT full_name , password_hash FROM users WHERE email = ?', [email]))!;

    const hijack = await anon.post('/auth/register')
      .send({ ...registration(email), fullName: 'คนที่พยายามยึดบัญชี', password: 'Hijack-123' });
    expect(hijack.status).toBe(400);
    expect(hijack.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');

    expect(await one('SELECT full_name , password_hash FROM users WHERE email = ?', [email])).toEqual(before);
    expect((await anon.post('/auth/login').send({ email, password: 'Hijack-123' })).status).toBe(401);
    expect((await anon.post('/auth/login').send({ email, password: registration(email).password })).status).toBe(200);
  });

  it('🔴 ทับใบเดิมแล้ว บัตรเก่าที่ล็อกอินค้างไว้ใช้ไม่ได้ (token_version)', async () => {
    const email = 'dup-token@test.local';
    expect((await anon.post('/auth/register').send(registration(email))).status).toBe(201);
    const oldToken = (await anon.post('/auth/login').send({ email, password: registration(email).password })).body.accessToken;
    expect((await as({ token: oldToken }).get('/me')).status).toBe(200);

    env.REQUIRE_EMAIL_VERIFIED = true;   // เปิดด่านทีหลัง (มีบัตรค้างจากตอนด่านปิด)
    expect((await anon.post('/auth/register').send({ ...registration(email), password: 'Passw0rd-999' })).status).toBe(201);

    expect((await as({ token: oldToken }).get('/me')).status).toBe(401);
  });

  it('สมัครซ้ำด้วยอีเมลที่ยืนยันแล้ว → 400 EMAIL_ALREADY_REGISTERED · ข้อมูลเดิมไม่ถูกแตะ', async () => {
    const email = 'dup-verified@test.local';
    expect((await anon.post('/auth/register').send(registration(email))).status).toBe(201);
    expect((await anon.post('/auth/verify-email').send({ email, code: otpIn(email) })).status).toBe(200);
    expect(await verified(email)).toBe(true);

    const again = await anon.post('/auth/register')
      .send({ ...registration(email), fullName: 'คนที่พยายามยึดบัญชี', password: 'Hijack-123' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');

    // 🔴 ด่านนี้คือตัวกันการยึดบัญชี — ชื่อและรหัสผ่านเดิมต้องไม่เปลี่ยน
    const row = (await one<{ full_name: string; n: number }>(
      'SELECT full_name , (SELECT COUNT(*) FROM users WHERE email = ?) AS n FROM users WHERE email = ?',
      [email, email]))!;
    expect(row.n).toBe(1);
    expect(row.full_name).not.toBe('คนที่พยายามยึดบัญชี');
    expect((await anon.post('/auth/login').send({ email, password: 'Hijack-123' })).status).toBe(401);
  });

  it('คนใน: ภาควิชาไม่อยู่ในคณะที่เลือก → 400 · ไม่สร้างบัญชี', async () => {
    const otherFaculty = await createFaculty();
    const res = await anon.post('/auth/register').send({ ...kuRegistration('mismatch'), facultyId: otherFaculty });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(await one("SELECT 1 FROM users WHERE email = 'mismatch@ku.th'")).toBeNull();
  });

  /**
   * 🔴 มติ 8 ต.ค. 2569 — ของเดิมบังคับคณะ/ภาควิชา/ชั้นปีกับทุกคน
   *   ⇒ **คนนอกสมัครไม่ได้เลย** เพราะไม่มีคณะให้เลือก (BE-?? ของเดิมข้อ 1)
   *   คอลัมน์ในฐานเป็น NULL ได้มาตั้งแต่ schema.sql แล้ว — ที่บังคับไว้คือ Zod ชั้นเดียว
   */
  it('คนนอก: สมัครได้โดยไม่ส่งคณะ/ภาควิชา/ชั้นปี → บัญชีเป็น external และสามช่องเป็น NULL', async () => {
    const email = 'outsider.no.faculty@test.local';
    const { fullName, password, gender, birthDate } = registration(email);
    const res = await anon.post('/auth/register').send({ fullName, email, password, gender, birthDate });

    expect(res.status).toBe(201);
    const row = await one<{ user_type: string; faculty_id: number | null; department_id: number | null; year: number | null }>(
      'SELECT user_type, faculty_id, department_id, year FROM users WHERE email = ?', [email]);
    expect(row).toEqual({ user_type: 'external', faculty_id: null, department_id: null, year: null });
  });

  /** ตามมติ: ส่งมาก็ไม่เก็บ และไม่ตอบ error (FE อาจค้างค่าจากหน้าก่อนไว้) */
  it('คนนอก: ส่งคณะ/ภาควิชา/ชั้นปีมาด้วย → 201 แต่ไม่ถูกเก็บ', async () => {
    const email = 'outsider.with.faculty@test.local';
    const res = await anon.post('/auth/register').send(registration(email));

    expect(res.status).toBe(201);
    const row = await one<{ faculty_id: number | null; department_id: number | null; year: number | null }>(
      'SELECT faculty_id, department_id, year FROM users WHERE email = ?', [email]);
    expect(row).toEqual({ faculty_id: null, department_id: null, year: null });
  });

  it('คนใน: ไม่ส่งคณะ/ภาควิชา/ชั้นปี → 400 ครบทั้งสามช่อง · ไม่สร้างบัญชี', async () => {
    const { fullName, password, gender, birthDate } = registration('x');
    const res = await anon.post('/auth/register').send({ fullName, email: 'insider.missing@ku.th', password, gender, birthDate });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['facultyId', 'departmentId', 'year']));
    expect(await one("SELECT 1 FROM users WHERE email = 'insider.missing@ku.th'")).toBeNull();
  });

  it('คนใน: ส่งครบ → 201 และเก็บค่าไว้จริง', async () => {
    const res = await anon.post('/auth/register').send(kuRegistration('insider.ok'));

    expect(res.status).toBe(201);
    const row = await one<{ user_type: string; faculty_id: number; department_id: number; year: number }>(
      'SELECT user_type, faculty_id, department_id, year FROM users WHERE email = ?', ['insider.ok@ku.th']);
    expect(row).toEqual({ user_type: 'student', faculty_id: faculty, department_id: department, year: 2 });
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
    await ageOtps(email, 61);   // FR-UM-06 — พ้น cooldown 60 วิ ของใบที่ออกตอนสมัคร
    expect((await anon.post('/auth/resend-verification').send({ email })).status).toBeLessThan(300);
    expect((await anon.post('/auth/verify-email').send({ email, code: otpIn(email) })).status).toBe(200);
    expect(await verified(email)).toBe(true);
  });

  /**
   * FR-UM-06 (SRS เทียบโค้ด 30 ต.ค.) — ขอรหัสใหม่ต้องห่างจากใบล่าสุดอย่างน้อย 60 วินาที
   * เดิมหน่วงแค่ปุ่มในหน้าเว็บ ⇒ ยิง API ตรงได้รัว ๆ จนครบโควตา 3 ใบ/ชม.
   */
  it('🔴 ขอรหัสใหม่ห่างกันไม่ถึง 60 วิ → ตอบ 200 เหมือนเดิม แต่ไม่มีใบใหม่ในฐาน · เกิน 60 วิ ได้ใบใหม่', async () => {
    const email = 'cooldown@test.local';
    await anon.post('/auth/register').send(registration(email));
    await ageOtps(email, 61);
    const first = await anon.post('/auth/resend-verification').send({ email });
    expect(await otpCount(email)).toBe(2);

    const tooSoon = await anon.post('/auth/resend-verification').send({ email });
    expect(tooSoon.status).toBe(200);
    expect(await otpCount(email)).toBe(2);
    // 🔴 รูปร่างคำตอบต้องเหมือนกันทุกตัวอักษร — ไม่บอกคนนอกว่าติด cooldown
    expect(tooSoon.body).toEqual(first.body);

    await ageOtps(email, 61);
    expect((await anon.post('/auth/resend-verification').send({ email })).status).toBe(200);
    expect(await otpCount(email)).toBe(3);
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

  // 🔴 bug hunt 30 ต.ค. ข้อ 7 — ค้นตรงด้วย SHA-256 + จองใบด้วย used_at IS NULL ⇒ ยิงพร้อมกันได้ผลครั้งเดียว
  it('🔴 ยิงลิงก์เดียวพร้อมกัน 5 คำขอ → สำเร็จครั้งเดียว · ในฐานเก็บ SHA-256 ไม่ใช่ token ดิบ', async () => {
    const user = await createUserWithPassword('OldPass-123');
    await anon.post('/auth/forgot-password').send({ email: user.email });
    const token = resetTokenIn(user.email);

    const stored = await one<{ token_hash: string }>(
      'SELECT token_hash FROM password_reset_tokens WHERE user_id = ? ORDER BY password_reset_token_id DESC LIMIT 1', [user.id]);
    expect(stored!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored!.token_hash).not.toBe(token);

    const codes = (await Promise.all(Array.from({ length: 5 }, (_, i) =>
      anon.post('/auth/reset-password').send({ token, newPassword: `NewPass-45${i}` }).then(r => r.status)))).sort();
    expect(codes).toEqual([200, 400, 400, 400, 400]);
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
   * 🔴 QA 30 ต.ค. 2569 (C3) — แทนที่ BE-07 · เดิม logout ตอบ 204 เฉย ๆ token ใช้ต่อได้ 7 วัน
   * ★ ออกจากทุกเครื่องพร้อมกัน (เลขรุ่นเป็นของผู้ใช้ ไม่ใช่ของเครื่อง) — ข้อจำกัดที่เจ้าของงานยอมรับ
   */
  it('🔴 logout แล้ว token ใบนั้นใช้ไม่ได้ · เครื่องอื่นก็หลุด · ล็อกอินใหม่ได้ตามปกติ', async () => {
    const user = await createUserWithPassword('Passw0rd-123');
    const login = () => anon.post('/auth/login').send({ email: user.email, password: 'Passw0rd-123' });
    const phone = (await login()).body.accessToken as string;
    const laptop = (await login()).body.accessToken as string;
    expect((await as({ token: phone }).get('/me')).status).toBe(200);

    expect((await as({ token: phone }).post('/auth/logout')).status).toBe(204);

    const after = await as({ token: phone }).get('/me');
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('TOKEN_EXPIRED');
    expect((await as({ token: laptop }).get('/me')).status).toBe(401);
    const fresh = (await login()).body.accessToken as string;
    expect((await as({ token: fresh }).get('/me')).status).toBe(200);
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
