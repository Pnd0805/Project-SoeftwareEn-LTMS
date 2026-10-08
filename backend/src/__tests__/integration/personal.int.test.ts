import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import { createFaculty, createSportType, createTeam, createTournament, createUser, type TestUser } from './helpers/factories.js';

/**
 * ข้อมูลส่วนตัว — ความเสี่ยงคือ "เห็น/แก้ของคนอื่น" ด้วยการเดาเลข id (IDOR)
 *   แจ้งเตือน · โปรไฟล์ · คำขอเข้าทีม · ติดตาม · รายงานผู้ใช้ · ประกาศของทัวร์
 */

let alice: TestUser;
let bob: TestUser;

beforeEach(async () => {
  alice = await createUser({ fullName: 'Alice ทดสอบ', birthDate: '2003-05-05' });
  bob = await createUser({ fullName: 'Bob ทดสอบ' });
});

// ───────────────────────────── แจ้งเตือน ─────────────────────────────

describe('แจ้งเตือน — เห็นและแก้ได้เฉพาะของตัวเอง', () => {
  let aliceNote: number;
  let bobNote: number;
  beforeEach(async () => {
    const note = (userId: number, title: string) =>
      insert('notifications', { user_id: userId, type: 'team_invited', title, message: 'x', is_read: 0 });
    aliceNote = await note(alice.id, 'ของ Alice');
    bobNote = await note(bob.id, 'ของ Bob');
  });
  const isRead = async (id: number) =>
    (await one<{ is_read: number }>('SELECT is_read FROM notifications WHERE notification_id = ?', [id]))!.is_read === 1;

  it('รายการแจ้งเตือนมีแต่ของตัวเอง', async () => {
    const res = await as(alice).get('/me/notifications');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('ของ Alice');
    expect(JSON.stringify(res.body)).not.toContain('ของ Bob');
  });

  it('🔒 ทำเครื่องหมายว่าอ่านแล้วกับแจ้งเตือนของคนอื่น → ของเขายังไม่ถูกอ่าน', async () => {
    const res = await as(alice).patch(`/me/notifications/${bobNote}/read`);
    expect(res.status).toBeLessThan(500);
    expect(await isRead(bobNote)).toBe(false);
  });

  it('ทำเครื่องหมายของตัวเองได้', async () => {
    expect((await as(alice).patch(`/me/notifications/${aliceNote}/read`)).status).toBeLessThan(300);
    expect(await isRead(aliceNote)).toBe(true);
  });

  it('อ่านทั้งหมด → แตะเฉพาะของตัวเอง', async () => {
    expect((await as(alice).post('/me/notifications/read-all')).status).toBeLessThan(300);
    expect(await isRead(aliceNote)).toBe(true);
    expect(await isRead(bobNote)).toBe(false);
  });
});

// ───────────────────────────── โปรไฟล์ ─────────────────────────────

describe('โปรไฟล์ — ข้อมูลส่วนตัวไม่หลุดไปให้คนอื่น', () => {
  const PRIVATE = ['email', 'birthDate', 'gender', 'contactInfo', 'address', 'passwordHash', 'password_hash', 'notificationPrefs'];

  it.each([
    ['ไม่ล็อกอิน', () => anon.get(`/users/${alice.id}`)],
    ['ผู้ใช้คนอื่น', () => as(bob).get(`/users/${alice.id}`)],
  ])('%s ดูโปรไฟล์ → ไม่มีฟิลด์ส่วนตัวเลย', async (_label, request) => {
    const res = await request();
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Alice ทดสอบ');
    for (const key of PRIVATE) expect(res.body).not.toHaveProperty(key);
    expect(JSON.stringify(res.body)).not.toContain(alice.email);
  });

  it('ค้นหาผู้ใช้ → ไม่มีอีเมลในผลลัพธ์', async () => {
    const res = await as(bob).get('/users/search?q=Alice');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(alice.email);
  });

  /**
   * 🆕 BE-19 / FE-11 (7 ต.ค. 2569 · มติ ⑫ ก) — ผลค้นหามีแค่ชื่อ แยกคนชื่อซ้ำไม่ได้
   *
   * FE เจอ "วรรณิดา ทองคำ" สองแถวที่หน้าตาเหมือนกันทุกอย่างตอนเชิญเข้าทีม
   * ⇒ หัวหน้าทีมเชิญผิดคนแล้วไม่มีทางรู้
   *
   * ★ เพิ่มคณะและชั้นปี ซึ่ง**แสดงบนโปรไฟล์สาธารณะอยู่แล้ว** ⇒ ไม่ได้เปิดข้อมูลใหม่
   *   เทส "ไม่มีอีเมลในผลลัพธ์" ข้างบนยังต้องเขียวต่อไป — นั่นคือเส้นที่ไม่ข้าม
   */
  it('ผลค้นหามีคณะและชั้นปี เพื่อแยกคนชื่อซ้ำ', async () => {
    const faculty = await createFaculty();
    const twin = await createUser({ fullName: 'Alice ทดสอบ', facultyId: faculty, year: 3 });

    const res = await as(bob).get('/users/search?q=Alice');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: twin.id, facultyName: expect.any(String), year: 3 }),
      // ★ alice ไม่มีคณะ/ชั้นปี → ต้องเป็น null ไม่ใช่หายไปจาก object (FE อ่านคีย์ตรง ๆ)
      expect.objectContaining({ id: alice.id, facultyName: null, year: null }),
    ]));
  });

  it('ตัวเองดู /me → เห็นข้อมูลส่วนตัวของตัวเอง', async () => {
    const res = await as(alice).get('/me');
    expect(res.body).toMatchObject({ email: alice.email, birthDate: '2003-05-05' });
  });

  it('🔒 PATCH /me ส่งฟิลด์ต้องห้ามมาด้วย → ไม่มีผล (ไม่มี mass assignment)', async () => {
    const res = await as(alice).patch('/me').send({
      contactInfo: 'line: alice',
      isSuspended: true, is_suspended: 1, email: 'hacked@test.local', userType: 'staff',
      facultyId: 999, adminScope: 'university_wide', emailVerified: true, totalPoints: 999999,
    });
    expect(res.status).toBeLessThan(300);
    const row = await one<Record<string, unknown>>(
      'SELECT contact_info, is_suspended, email, user_type, faculty_id, total_points FROM users WHERE user_id = ?', [alice.id]);
    expect(row).toMatchObject({ contact_info: 'line: alice', is_suspended: 0, email: alice.email, user_type: 'student', faculty_id: null });
    expect(row!['total_points']).not.toBe(999999);
    expect(await one('SELECT 1 FROM admin_scopes WHERE user_id = ?', [alice.id])).toBeNull();
  });
});

// ───────────────────────────── คำขอเข้าทีม ─────────────────────────────

describe('DELETE /me/join-requests/:rid — ยกเลิกได้เฉพาะคำขอของตัวเอง', () => {
  it('🔒 ยกเลิกคำขอของคนอื่น → 404 · ของเขายัง pending', async () => {
    const sport = await createSportType();
    const team = await createTeam({ leader: (await createUser()).id, sportTypeId: sport, visibility: 'public' });
    const bobRequest = await insert('team_join_requests', { team_id: team, user_id: bob.id, team_join_request_status: 'pending' });

    const res = await as(alice).delete(`/me/join-requests/${bobRequest}`);
    expect(res.status).toBe(404);
    expect((await one<{ s: string }>('SELECT team_join_request_status AS s FROM team_join_requests WHERE team_join_request_id = ?', [bobRequest]))!.s)
      .toBe('pending');
    expect((await as(bob).delete(`/me/join-requests/${bobRequest}`)).status).toBeLessThan(300);
  });
});

// ───────────────────────────── ติดตาม / รายงาน ─────────────────────────────

describe('ติดตาม และรายงานผู้ใช้', () => {
  it('ติดตามตัวเอง → 4xx', async () => {
    const res = await as(alice).post(`/users/${alice.id}/follow`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('ติดตามคนอื่น → จำนวนผู้ติดตามเพิ่ม 1 · ติดตามซ้ำไม่นับเพิ่ม · เลิกติดตามแล้วลดลง', async () => {
    const count = async () => (await anon.get(`/users/${bob.id}`)).body.followerCount;
    expect((await as(alice).post(`/users/${bob.id}/follow`)).status).toBeLessThan(300);
    expect(await count()).toBe(1);
    await as(alice).post(`/users/${bob.id}/follow`);
    expect(await count()).toBe(1);
    expect((await as(alice).delete(`/users/${bob.id}/follow`)).status).toBeLessThan(300);
    expect(await count()).toBe(0);
  });

  it('รายงานตัวเอง → 4xx · ไม่มีรายงาน', async () => {
    const res = await as(alice).post(`/users/${alice.id}/report`).send({ reason: 'ทดสอบ' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await all('SELECT 1 FROM user_reports')).toHaveLength(0);
  });

  it('รายงานคนอื่น → บันทึกผู้รายงานเป็นคนที่ล็อกอิน', async () => {
    expect((await as(alice).post(`/users/${bob.id}/report`).send({ reason: 'พูดจาไม่สุภาพ' })).status).toBeLessThan(300);
    expect(await one('SELECT reported_by, target_user_id FROM user_reports'))
      .toEqual({ reported_by: alice.id, target_user_id: bob.id });
  });

  /**
   * 🆕 BE-38 (7 ต.ค. 2569 · มติ ⑦ ค) — คนเดิมรายงานเป้าหมายเดิมซ้ำได้ 201 ทั้งสองครั้ง
   * ⇒ คิวแอดมินมีเรื่องเดียวกันจากคนเดียวกันหลายใบ · ตัดสินใบหนึ่งแล้วอีกใบยังค้าง
   */
  it('รายงานคนเดิมซ้ำขณะเรื่องยังรอพิจารณา → 409 · มีใบเดียว', async () => {
    expect((await as(alice).post(`/users/${bob.id}/report`).send({ reason: 'พูดจาไม่สุภาพ' })).status).toBeLessThan(300);

    const again = await as(alice).post(`/users/${bob.id}/report`).send({ reason: 'พูดจาไม่สุภาพ' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('REPORT_ALREADY_PENDING');

    expect(await all('SELECT 1 FROM user_reports')).toHaveLength(1);
  });

  /**
   * ★ ด่านนี้ต้องแคบ — ผูกกับ **คู่** (ผู้รายงาน, เป้าหมาย) ไม่ใช่เป้าหมายเดี่ยว
   *   คนละคนรายงานคนเดียวกันต้องได้ เพราะจำนวนผู้รายงานเป็นข้อมูลที่แอดมินใช้ตัดสิน
   *   ถ้าเทสนี้แดง แปลว่าด่านกว้างเกินและปิดปากคนอื่นไปด้วย
   */
  it('คนละคนรายงานคนเดียวกัน → ได้ทั้งสองใบ', async () => {
    const carol = await createUser({ fullName: 'Carol ทดสอบ' });

    expect((await as(alice).post(`/users/${bob.id}/report`).send({ reason: 'เหตุผล A' })).status).toBeLessThan(300);
    expect((await as(carol).post(`/users/${bob.id}/report`).send({ reason: 'เหตุผล B' })).status).toBeLessThan(300);

    expect(await all('SELECT 1 FROM user_reports')).toHaveLength(2);
  });

  /** ★ ตัดสินแล้วรายงานใหม่ได้ — พฤติกรรมอาจเกิดซ้ำจริง ด่านต้องไม่ปิดถาวร */
  it('เรื่องเดิมถูกตัดสินแล้ว → รายงานใหม่ได้', async () => {
    expect((await as(alice).post(`/users/${bob.id}/report`).send({ reason: 'ครั้งแรก' })).status).toBeLessThan(300);
    await testDb().query("UPDATE user_reports SET user_report_status = 'rejected'");

    expect((await as(alice).post(`/users/${bob.id}/report`).send({ reason: 'เกิดอีกแล้ว' })).status).toBeLessThan(300);
    expect(await all('SELECT 1 FROM user_reports')).toHaveLength(2);
  });
});

// ───────────────────────────── ประกาศของทัวร์ ─────────────────────────────

describe('ประกาศ — แก้/ลบได้เฉพาะผู้จัดของทัวร์นั้น', () => {
  let tour: number;
  let announcement: number;
  let otherOrganizer: TestUser;

  beforeEach(async () => {
    const faculty = await createFaculty();
    const sport = await createSportType();
    otherOrganizer = await createUser();
    tour = await createTournament({ organizer: alice.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    await createTournament({ organizer: otherOrganizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const res = await as(alice).post(`/tournaments/${tour}/announcements`).send({ title: 'เลื่อนแข่ง', body: 'ฝนตก' });
    expect(res.status).toBe(201);
    announcement = res.body.id;
  });

  const titleOf = async () =>
    (await one<{ title: string; deleted_at: Date | null }>('SELECT title, deleted_at FROM announcements WHERE announcement_id = ?', [announcement]))!;

  it('ใครก็อ่านได้ (ไม่ต้องล็อกอิน)', async () => {
    const res = await anon.get(`/tournaments/${tour}/announcements`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain('เลื่อนแข่ง');
  });

  it.each([
    ['ผู้จัดทัวร์อื่น', () => otherOrganizer],
    ['ผู้ใช้ทั่วไป', () => bob],
  ])('%s สร้าง/แก้/ลบ → 403 · ประกาศเดิมไม่เปลี่ยน', async (_label, who) => {
    expect((await as(who()).post(`/tournaments/${tour}/announcements`).send({ title: 'ปลอม', body: 'x' })).status).toBe(403);
    expect((await as(who()).patch(`/announcements/${announcement}`).send({ title: 'ถูกแก้' })).status).toBe(403);
    expect((await as(who()).delete(`/announcements/${announcement}`)).status).toBe(403);
    expect(await titleOf()).toEqual({ title: 'เลื่อนแข่ง', deleted_at: null });
    expect(await all("SELECT 1 FROM announcements WHERE title = 'ปลอม'")).toHaveLength(0);
  });

  it('ผู้จัดแก้แล้วลบได้ (soft delete)', async () => {
    expect((await as(alice).patch(`/announcements/${announcement}`).send({ title: 'แก้แล้ว' })).status).toBe(200);
    expect((await titleOf()).title).toBe('แก้แล้ว');
    expect((await as(alice).delete(`/announcements/${announcement}`)).status).toBeLessThan(300);
    expect((await titleOf()).deleted_at).not.toBeNull();
  });
});

