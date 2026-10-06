import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { insert, one } from './helpers/db.js';
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

beforeEach(async () => {
  facA = await createFaculty();
  facB = await createFaculty();
  root = await createUser();
  uni = await createUser();
  uni2 = await createUser();
  facAdmin = await createUser({ facultyId: facA });
  userA = await createUser({ facultyId: facA });
  userB = await createUser({ facultyId: facB });
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

  it('ผู้ใช้ทั่วไป → 403 ที่ requireAdmin', async () => {
    const res = await as(userA).post('/admin/scopes').send({ userId: userA.id, scopeType: 'faculty', facultyId: facA });
    expect(res.status).toBe(403);
    expect(await scopeOf(userA.id)).toBeNull();
  });

  it('ผู้ใช้ที่มีสิทธิ์อยู่แล้ว → 409 (ต้องถอนก่อน ไม่เขียนทับ)', async () => {
    const res = await as(uni).post('/admin/scopes').send({ userId: facAdmin.id, scopeType: 'faculty', facultyId: facB });
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
