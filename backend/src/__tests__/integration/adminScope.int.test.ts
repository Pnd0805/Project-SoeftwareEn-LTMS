import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { insert, one, testDb } from './helpers/db.js';
import { createFaculty, createSportType, createTeam, createUser, makeAdmin, type TestUser } from './helpers/factories.js';

/**
 * สิทธิ์แอดมิน — ลำดับชั้นที่โค้ดบังคับ (assertCanGrant / assertCanActOnUser)
 *
 *   root             แต่งตั้ง/ถอน University Admin เท่านั้น · ไม่ทำงานประจำวัน (ระงับผู้ใช้ ฯลฯ)
 *   university_wide  แต่งตั้ง/ถอน Faculty Admin เท่านั้น · อนุมัติคำร้องทีม (requireAdmin_U)
 *   faculty          ไม่แต่งตั้งใคร · ระงับได้เฉพาะผู้ใช้ทั่วไปในคณะตัวเอง
 *
 * ★ ส่วนที่เสี่ยงที่สุดคือ "ยกระดับสิทธิ์ตัวเอง/พวกเดียวกัน" — route ของ scopes/suspend ผ่านแค่ requireAdmin
 *   (แอดมินทุกระดับ) ⇒ ด่านจริงอยู่ใน service ทั้งหมด ไฟล์นี้พิสูจน์ผ่านคำขอจริง
 */

let facA: number;
let facB: number;
let root: TestUser;
let uni: TestUser;
let uni2: TestUser;
let facAdmin: TestUser;
let userA: TestUser;          // ผู้ใช้ทั่วไปคณะ A
let userB: TestUser;          // ผู้ใช้ทั่วไปคณะ B

/**
 * 🔴 แก้ 7 ต.ค. 2569 (BE-37 · มติ ⑬ ข) — คนที่จะได้สิทธิ์แอดมินต้องเป็นบัญชีภายใน
 *   และแอดมินคณะต้องสังกัดคณะนั้นจริง
 *
 * `createUser` ตั้งอีเมลเริ่มต้นเป็น `@test.local` ซึ่งนับเป็น**บัญชีภายนอก** (utils/kuEmail)
 * ⇒ ผู้ใช้ที่ไฟล์นี้จะเอาไปแต่งตั้งต้องใช้อีเมล `@ku.th` ไม่งั้นติดด่านใหม่ที่ไม่เกี่ยวกับ
 *   เรื่องที่แต่ละเทสทดสอบ (ลำดับชั้นการแต่งตั้ง)
 * ★ ไม่แก้ค่าเริ่มต้นของ factory — ไฟล์อื่นใช้ความเป็น "คนนอก" เป็นเงื่อนไขอยู่ (กรรมการภายนอก)
 * ★ `userA`/`userB` ผูกคณะให้ตรงกับคณะที่จะมอบสิทธิ์ (facA/facB) ตามกฎใหม่
 */
const kuEmail = () => `admin-${Math.random().toString(36).slice(2, 10)}@ku.th`;

beforeEach(async () => {
  facA = await createFaculty();
  facB = await createFaculty();
  root = await createUser({ email: kuEmail() });
  uni = await createUser({ email: kuEmail() });
  uni2 = await createUser({ email: kuEmail() });
  facAdmin = await createUser({ facultyId: facA, email: kuEmail() });
  userA = await createUser({ facultyId: facA, email: kuEmail() });
  userB = await createUser({ facultyId: facB, email: kuEmail() });
  await makeAdmin(root.id, 'root');
  await makeAdmin(uni.id, 'university_wide');
  await makeAdmin(uni2.id, 'university_wide');
  await makeAdmin(facAdmin.id, 'faculty', facA);
});

const scopeOf = (userId: number) =>
  one<{ admin_scope_id: number; scope_type: string; faculty_id: number | null }>(
    'SELECT admin_scope_id, scope_type, faculty_id FROM admin_scopes WHERE user_id = ?', [userId]);
const isSuspended = async (userId: number) =>
  (await one<{ is_suspended: number }>('SELECT is_suspended FROM users WHERE user_id = ?', [userId]))!.is_suspended === 1;
const suspend = (who: TestUser, targetId: number) =>
  as(who).patch(`/admin/users/${targetId}/suspend`).send({ suspended: true, reason: 'ทดสอบ', category: 'spam' });

// ───────────────────────────── แต่งตั้งสิทธิ์ ─────────────────────────────

describe('POST /admin/scopes — แต่งตั้งได้เฉพาะชั้นถัดลงไปหนึ่งชั้น', () => {
  it('university_wide แต่งตั้ง faculty admin ได้', async () => {
    const res = await as(uni).post('/admin/scopes').send({ userId: userB.id, scopeType: 'faculty', facultyId: facB });
    expect(res.status).toBe(201);
    expect(await scopeOf(userB.id)).toMatchObject({ scope_type: 'faculty', faculty_id: facB });
  });

  it('🔴 university_wide แต่งตั้ง university_wide อีกคน → 403 (กันขยายพวกระดับเดียวกัน)', async () => {
    const res = await as(uni).post('/admin/scopes').send({ userId: userB.id, scopeType: 'university_wide' });
    expect(res.status).toBe(403);
    expect(await scopeOf(userB.id)).toBeNull();
  });

  it('🔴 faculty admin แต่งตั้งใครไม่ได้เลย — แม้แค่ faculty ของคณะตัวเอง', async () => {
    const res = await as(facAdmin).post('/admin/scopes').send({ userId: userA.id, scopeType: 'faculty', facultyId: facA });
    expect(res.status).toBe(403);
    expect(await scopeOf(userA.id)).toBeNull();
  });

  it('🔴 faculty admin แต่งตั้ง university_wide (ยกระดับ) → 403', async () => {
    const res = await as(facAdmin).post('/admin/scopes').send({ userId: userA.id, scopeType: 'university_wide' });
    expect(res.status).toBe(403);
    expect(await scopeOf(userA.id)).toBeNull();
  });

  it('root แต่งตั้ง university_wide ได้ · แต่ faculty ไม่ได้', async () => {
    expect((await as(root).post('/admin/scopes').send({ userId: userA.id, scopeType: 'university_wide' })).status).toBe(201);
    expect((await as(root).post('/admin/scopes').send({ userId: userB.id, scopeType: 'faculty', facultyId: facB })).status).toBe(403);
    expect(await scopeOf(userB.id)).toBeNull();
  });

  /**
   * 🆕 BE-37 (7 ต.ค. 2569 · มติ ⑬ ข) — แต่งตั้งใครเป็นแอดมินก็ได้
   *
   * ด่านเดิมตรวจครบทุกอย่างยกเว้น **ตัวผู้รับ** ⇒ QA ตั้ง `referee.ext@outside.org`
   * (บัญชีภายนอก ไม่มีคณะ) เป็นแอดมินคณะวิศวกรรมศาสตร์ได้ 201
   * ⇒ คนนอกมหาวิทยาลัยเห็นและตัดสินเรื่องของคณะได้ทั้งหมด
   */
  describe('คนที่จะได้สิทธิ์ต้องเป็นคนใน และสังกัดคณะนั้นจริง (BE-37)', () => {
    it('บัญชีภายนอก (ไม่ใช่ @ku.th) → 422 EXTERNAL_ACCOUNT_CANNOT_BE_ADMIN', async () => {
      const outsider = await createUser({ email: 'referee.ext@outside.org', facultyId: facA });

      const res = await as(uni).post('/admin/scopes').send({ userId: outsider.id, scopeType: 'faculty', facultyId: facA });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('EXTERNAL_ACCOUNT_CANNOT_BE_ADMIN');
      expect(await scopeOf(outsider.id)).toBeNull();
    });

    it('บัญชีภายนอก แต่งตั้งเป็น university_wide ก็ไม่ได้ (root แต่งตั้ง)', async () => {
      const outsider = await createUser({ email: 'someone@outside.org' });

      const res = await as(root).post('/admin/scopes').send({ userId: outsider.id, scopeType: 'university_wide' });

      expect(res.status).toBe(422);
      expect(await scopeOf(outsider.id)).toBeNull();
    });

    /** ★ ไม่ใช่แค่ "ต้องมีคณะ" — อาจารย์คณะ A เป็นแอดมินคณะ B ก็ผิดความหมายของตำแหน่ง */
    it('คนของคณะ A แต่งตั้งเป็นแอดมินคณะ B → 422 ADMIN_FACULTY_MISMATCH', async () => {
      const res = await as(uni).post('/admin/scopes').send({ userId: userA.id, scopeType: 'faculty', facultyId: facB });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ADMIN_FACULTY_MISMATCH');
      expect(await scopeOf(userA.id)).toBeNull();
    });

    it('คนที่ไม่มีคณะเลย แต่งตั้งเป็นแอดมินคณะ → 422', async () => {
      const noFaculty = await createUser({ email: kuEmail() });

      const res = await as(uni).post('/admin/scopes').send({ userId: noFaculty.id, scopeType: 'faculty', facultyId: facA });

      expect(res.status).toBe(422);
      expect(await scopeOf(noFaculty.id)).toBeNull();
    });

    /** ★ เคสตรงข้าม — university_wide ไม่ต้องมีคณะ ด่านคณะต้องไม่เผลอบล็อก */
    it('คนในที่ไม่มีคณะ แต่งตั้งเป็น university_wide ได้ (root แต่งตั้ง)', async () => {
      const staff = await createUser({ email: kuEmail() });

      const res = await as(root).post('/admin/scopes').send({ userId: staff.id, scopeType: 'university_wide' });

      expect(res.status).toBe(201);
      expect(await scopeOf(staff.id)).toMatchObject({ scope_type: 'university_wide', faculty_id: null });
    });
  });

  it('ผู้ใช้ทั่วไป → 403 ที่ requireAdmin', async () => {
    const res = await as(userA).post('/admin/scopes').send({ userId: userA.id, scopeType: 'faculty', facultyId: facA });
    expect(res.status).toBe(403);
    expect(await scopeOf(userA.id)).toBeNull();
  });

  /** ★ ใช้ facA (คณะของ facAdmin) — ด่านคณะใหม่ (BE-37) อยู่ก่อนด่าน "มีสิทธิ์อยู่แล้ว"
   *    ถ้าส่ง facB มา จะได้ 422 ADMIN_FACULTY_MISMATCH ซึ่งไม่ใช่เรื่องที่เทสนี้ทดสอบ */
  it('ผู้ใช้ที่มีสิทธิ์อยู่แล้ว → 409 (ต้องถอนก่อน ไม่เขียนทับ)', async () => {
    const res = await as(uni).post('/admin/scopes').send({ userId: facAdmin.id, scopeType: 'faculty', facultyId: facA });
    expect(res.status).toBe(409);
    expect((await scopeOf(facAdmin.id))!.faculty_id).toBe(facA);
  });
});

describe('DELETE /admin/scopes/:id — ถอนสิทธิ์', () => {
  it('university_wide ถอน faculty admin ได้', async () => {
    const scope = (await scopeOf(facAdmin.id))!.admin_scope_id;
    expect((await as(uni).delete(`/admin/scopes/${scope}`)).status).toBeLessThan(300);
    expect(await scopeOf(facAdmin.id)).toBeNull();
  });

  it('ถอนสิทธิ์ตัวเอง → 403', async () => {
    const scope = (await scopeOf(uni.id))!.admin_scope_id;
    expect((await as(uni).delete(`/admin/scopes/${scope}`)).status).toBe(403);
    expect(await scopeOf(uni.id)).not.toBeNull();
  });

  it('ถอน root ผ่าน API → 403 ไม่ว่าใครขอ', async () => {
    const scope = (await scopeOf(root.id))!.admin_scope_id;
    expect((await as(uni).delete(`/admin/scopes/${scope}`)).status).toBe(403);
    expect(await scopeOf(root.id)).not.toBeNull();
  });

  it('university_wide ถอน university_wide อีกคน → 403 (ระดับเดียวกัน)', async () => {
    const scope = (await scopeOf(uni2.id))!.admin_scope_id;
    expect((await as(uni).delete(`/admin/scopes/${scope}`)).status).toBe(403);
    expect(await scopeOf(uni2.id)).not.toBeNull();
  });

  it('faculty admin ถอนใครไม่ได้', async () => {
    const other = await createUser({ facultyId: facA });
    await makeAdmin(other.id, 'faculty', facA);
    const scope = (await scopeOf(other.id))!.admin_scope_id;
    expect((await as(facAdmin).delete(`/admin/scopes/${scope}`)).status).toBe(403);
    expect(await scopeOf(other.id)).not.toBeNull();
  });
});

// ───────────────────────────── ระงับผู้ใช้ ─────────────────────────────

describe('PATCH /admin/users/:id/suspend — ขอบเขตของการระงับ', () => {
  it('faculty admin ระงับผู้ใช้ในคณะตัวเอง → สำเร็จ · และ token ของคนนั้นใช้ไม่ได้ทันที (403)', async () => {
    expect((await as(userA).get('/me')).status).toBe(200);
    const res = await suspend(facAdmin, userA.id);
    expect(res.status).toBe(200);
    expect(await isSuspended(userA.id)).toBe(true);
    const after = await as(userA).get('/me');
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('faculty admin ระงับผู้ใช้คณะอื่น → 403 · ไม่ถูกระงับ', async () => {
    const res = await suspend(facAdmin, userB.id);
    expect(res.status).toBe(403);
    expect(await isSuspended(userB.id)).toBe(false);
  });

  it('faculty admin ระงับแอดมินคนอื่น (แม้คณะเดียวกัน) → 403', async () => {
    const other = await createUser({ facultyId: facA });
    await makeAdmin(other.id, 'faculty', facA);
    expect((await suspend(facAdmin, other.id)).status).toBe(403);
    expect(await isSuspended(other.id)).toBe(false);
  });

  it('ระงับตัวเอง → 403', async () => {
    expect((await suspend(facAdmin, facAdmin.id)).status).toBe(403);
    expect(await isSuspended(facAdmin.id)).toBe(false);
  });

  it('root ไม่ทำงานประจำวัน → 403 ROOT_NO_DAILY_OPERATIONS', async () => {
    const res = await suspend(root, userA.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ROOT_NO_DAILY_OPERATIONS');
  });

  it('ต้องมีเหตุผลและประเภท', async () => {
    const res = await as(uni).patch(`/admin/users/${userB.id}/suspend`).send({ suspended: true, category: 'spam' });
    expect(res.status).toBe(400);
    expect(await isSuspended(userB.id)).toBe(false);
  });

  it('ผู้ใช้ทั่วไประงับคนอื่น → 403', async () => {
    expect((await suspend(userA, userB.id)).status).toBe(403);
    expect(await isSuspended(userB.id)).toBe(false);
  });

  /**
   * A1 — แก้แล้ว 6 ต.ค. 2569 (เดิมเป็น it.fails: ช่องโหว่)
   *
   * university admin ระงับบัญชี root ได้ ⇒ root เรียก API อะไรไม่ได้เลย (requireAuth ตอบ 403)
   * ขัดกับเจตนาในโค้ดเอง: revokeScope ห้ามถอนสิทธิ์ root "ไม่ว่าใครจะเป็นคนขอ" เพราะต้องมีเสมอ 1 คน
   * แต่การระงับให้ผลเดียวกัน ⇒ เท่ากับเดินอ้อมด่านนั้นด้วยปุ่มอื่น
   * ด่านใหม่อยู่ที่ performSuspend ⇒ ครอบทั้ง PATCH suspend และการอนุมัติคำร้องผู้ใช้
   * ★ กันเฉพาะ "ระงับ" — "ปลดระงับ root" ยังทำได้ (เป็นการกู้คืน มีเทสที่ชั้น unit)
   */
  /**
   * B5 — มติ 6 ต.ค. 2569 ทางเลือก ก: ระงับแอดมินมหาวิทยาลัยด้วยปุ่มเดียวไม่ได้
   *   ต้องถอนสิทธิ์ก่อน (เฉพาะ root ที่ถอน university_wide ได้) แล้วจึงระงับในฐานะผู้ใช้ทั่วไป
   *   ⇒ ไม่ต้องให้อำนาจกดใหม่กับ root เลย (ไม่ขัดมติ 28 ก.ย. OD-34)
   */
  it('university admin ระงับ university admin คนอื่น → 403 · ถอนสิทธิ์ก่อนแล้วระงับได้', async () => {
    const blocked = await suspend(uni, uni2.id);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error?.code ?? blocked.body.code).toBe('CANNOT_SUSPEND_UNIVERSITY_ADMIN');
    expect(await isSuspended(uni2.id)).toBe(false);

    // ขั้นที่ 1 — root ถอนสิทธิ์
    const scopes = await as(root).get('/admin/scopes');
    const scopeId = (scopes.body.items as { id: number; user: { id: number } }[])
      .find(s => s.user.id === uni2.id)!.id;
    expect((await as(root).delete(`/admin/scopes/${scopeId}`)).status).toBeLessThan(300);

    // ขั้นที่ 2 — ตอนนี้เป็นผู้ใช้ทั่วไป ⇒ ระงับได้ตามปกติ
    expect((await suspend(uni, uni2.id)).status).toBeLessThan(300);
    expect(await isSuspended(uni2.id)).toBe(true);
  });

  it('university admin ระงับ root → 403 และ root ยังใช้ระบบได้', async () => {
    const res = await suspend(uni, root.id);

    expect(res.status).toBe(403);
    expect(res.body.error?.code ?? res.body.code).toBe('CANNOT_SUSPEND_ROOT');
    expect(await isSuspended(root.id)).toBe(false);
    // ★ ข้อสำคัญของบั๊กนี้คือ root ถูกล็อกออกจากระบบ ⇒ ยืนยันว่ายังเรียก API ได้จริง
    expect((await as(root).get('/admin/scopes')).status).toBe(200);
  });
});

describe('GET /admin/users — faculty admin เห็นเฉพาะคณะตัวเอง', () => {
  it('ส่ง facultyId ของคณะอื่นมา ก็ยังได้แค่คณะตัวเอง', async () => {
    const res = await as(facAdmin).get(`/admin/users?facultyId=${facB}&pageSize=100`);
    expect(res.status).toBe(200);
    const ids = (res.body.items as { id: number }[]).map(u => u.id);
    expect(ids).toContain(userA.id);
    expect(ids).not.toContain(userB.id);
  });
});

// ───────────────────────────── คำร้องทีม (requireAdmin_U) ─────────────────────────────

describe('BR-07 คำร้องทีม — อนุมัติได้เฉพาะ university admin', () => {
  let leader: TestUser;
  let member: TestUser;
  let team: number;
  let officialReq: number;
  let transferReq: number;

  beforeEach(async () => {
    const sport = await createSportType();
    leader = await createUser();
    member = await createUser();
    team = await createTeam({ leader: leader.id, sportTypeId: sport, members: [member.id] });
    officialReq = await insert('team_admin_requests', {
      team_id: team, request_type: 'official_status', requested_by: leader.id,
      team_admin_request_status: 'pending', supporting_docs: JSON.stringify([]),
    });
    transferReq = await insert('team_admin_requests', {
      team_id: team, request_type: 'leader_transfer', requested_by: leader.id, target_user_id: member.id,
      team_admin_request_status: 'pending',
    });
  });

  const teamRow = () => one<{ official_status: string; leader_id: number }>(
    'SELECT official_status, leader_id FROM teams WHERE team_id = ?', [team]);

  it.each([
    ['faculty admin', () => facAdmin],
    ['root', () => root],
    ['หัวหน้าทีมที่ยื่นเอง', () => leader],
  ])('%s อนุมัติทีม Official → 403 · ทีมยัง Unofficial', async (_label, who) => {
    expect((await as(who()).post(`/admin/team-requests/${officialReq}/approve`)).status).toBe(403);
    expect((await teamRow())!.official_status).toBe('Unofficial');
  });

  it('university admin อนุมัติ → ทีมเป็น Official', async () => {
    expect((await as(uni).post(`/admin/team-requests/${officialReq}/approve`)).status).toBe(200);
    expect((await teamRow())!.official_status).toBe('Official');
  });

  it('โอนหัวหน้า: faculty admin อนุมัติไม่ได้ · university admin อนุมัติแล้วหัวหน้าเปลี่ยนจริง', async () => {
    expect((await as(facAdmin).post(`/admin/team-requests/${transferReq}/approve-transfer`)).status).toBe(403);
    expect((await teamRow())!.leader_id).toBe(leader.id);

    expect((await as(uni).post(`/admin/team-requests/${transferReq}/approve-transfer`)).status).toBe(200);
    expect((await teamRow())!.leader_id).toBe(member.id);
  });
});


/**
 * มติ 8 ต.ค. 2569 — `users.user_type` = 'staff' สำหรับคนที่ถือยศ
 *
 * 🔴 ก่อนมตินี้ `'staff'` เป็นค่า **ร้าง**: ไม่มีโค้ดไหนเขียน (ตั้งแต่มติ 6 ต.ค. ที่ให้คิดจากอีเมล)
 *   และไม่มีโค้ดไหนอ่านไปตัดสินอะไร ⇒ ค่าที่ไปถึงไม่ได้
 *
 * ★ ต้องเป็นเทส integration — ประเด็นคือ "คอลัมน์ในฐานถูกเขียนจริงไหม"
 *   เทส unit ที่ mock repo ทิ้ง พิสูจน์ได้แค่ว่ามีการ "เรียกฟังก์ชัน"
 * ★ คอลัมน์นี้ไม่ได้ให้สิทธิ์ใคร (สิทธิ์มาจาก `admin_scopes`) ⇒ เขียนพลาดไม่ทำให้ใครได้สิทธิ์เกิน
 *   แต่ทำให้ข้อมูลโกหก ซึ่งไม่มีเทสอื่นจับได้เลย
 */
describe("user_type = 'staff' ตามยศ", () => {
  const typeOf = async (userId: number) =>
    (await one<{ user_type: string }>('SELECT user_type FROM users WHERE user_id = ?', [userId]))!.user_type;

  it('แต่งตั้งเป็นแอดมินคณะ → user_type กลายเป็น staff', async () => {
    expect(await typeOf(userB.id)).toBe('student');

    const res = await as(uni).post('/admin/scopes').send({ userId: userB.id, scopeType: 'faculty', facultyId: facB });
    expect(res.status).toBe(201);
    expect(await typeOf(userB.id)).toBe('staff');
  });

  it('ถอดยศ → กลับเป็น student (คนใน @ku.th)', async () => {
    const granted = await as(uni).post('/admin/scopes').send({ userId: userB.id, scopeType: 'faculty', facultyId: facB });
    const scopeId = granted.body.id;
    expect(await typeOf(userB.id)).toBe('staff');

    expect((await as(uni).delete(`/admin/scopes/${scopeId}`)).status).toBe(200);
    expect(await typeOf(userB.id)).toBe('student');
  });

  /**
   * 🔴 เหตุที่ **ห้ามตั้งเป็น 'student' ตรง ๆ** ตอนถอดยศ
   *   ปัจจุบัน `grantScope` กันบัญชีภายนอกไว้ (EXTERNAL_ACCOUNT_CANNOT_BE_ADMIN)
   *   แต่แถวที่ตั้งผ่าน DB/seed ไม่ผ่านด่านนั้น ⇒ ถ้าลดเป็น 'student' ทันที
   *   ระบบจะบอกว่าคนนอกมหาวิทยาลัยเป็นนิสิต · กฎที่ใช้คือ isKuEmail ตัวเดียวกับตอนสมัคร
   */
  it('ถอดยศคนที่อีเมลเป็นบัญชีภายนอก → กลับเป็น external ไม่ใช่ student', async () => {
    const outsiderAdmin = await createUser({ email: `outside-admin-${Date.now()}@outside.org` });
    const scopeId = await insert('admin_scopes', {
      user_id: outsiderAdmin.id, scope_type: 'faculty', faculty_id: facB, created_by: uni.id,
    });
    await testDb().query("UPDATE users SET user_type = 'staff' WHERE user_id = ?", [outsiderAdmin.id]);

    expect((await as(uni).delete(`/admin/scopes/${scopeId}`)).status).toBe(200);
    expect(await typeOf(outsiderAdmin.id)).toBe('external');
  });

  it('ถอนยศไม่สำเร็จ (ถอนของตัวเอง) → user_type ไม่เปลี่ยน', async () => {
    const granted = await as(uni).post('/admin/scopes').send({ userId: userB.id, scopeType: 'faculty', facultyId: facB });
    const scopeId = granted.body.id;

    expect((await as(userB).delete(`/admin/scopes/${scopeId}`)).status).toBe(403);
    expect(await typeOf(userB.id)).toBe('staff');
  });

  /** ★ ยังเหลือยศใบอื่น → ห้ามลด (ผ่าน API เหลือไม่ได้ แต่แถวที่ตั้งผ่าน DB มีได้) */
  it('ยังเหลือยศอีกใบ → ไม่ลดกลับ', async () => {
    const granted = await as(uni).post('/admin/scopes').send({ userId: userB.id, scopeType: 'faculty', facultyId: facB });
    const scopeId = granted.body.id;
    const extra = await insert('admin_scopes', {
      user_id: userB.id, scope_type: 'faculty', faculty_id: facB, created_by: uni.id,
    });

    expect((await as(uni).delete(`/admin/scopes/${scopeId}`)).status).toBe(200);
    expect(await typeOf(userB.id)).toBe('staff');
    expect(extra).toBeGreaterThan(0);
  });
});
