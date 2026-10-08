import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { all, insert, one } from './helpers/db.js';
import {
  createFaculty, createSportType, createTeam, createTournament, createUser, makeAdmin, type TestUser,
} from './helpers/factories.js';

/**
 * เส้น "ปฏิเสธ / ตัดสิน" ของแอดมินที่ยังไม่มีเทส — คู่ของเส้นอนุมัติที่ทดสอบไว้แล้วใน adminScope.int.test.ts
 *
 *   คำร้องรายงานผู้ใช้     requireAdmin (ทุกระดับ) · ด่านขอบเขตอยู่ใน service (assertCanActOnUser)
 *   คำร้องทีม / โอนหัวหน้า  requireAdmin_U (มหาวิทยาลัยเท่านั้น)
 *   กรรมการภายนอก          requireAdmin_U
 *   audit log · oversight   ไม่ใช่แอดมินคณะ
 *
 * ★ ทุกเทสที่ถูกปฏิเสธ ตรวจด้วยว่าฐานไม่เปลี่ยน
 */

let facA: number;
let facB: number;
let root: TestUser;
let uni: TestUser;
let facAdmin: TestUser;      // คณะ A
let reporter: TestUser;
let targetA: TestUser;       // ผู้ใช้ทั่วไปคณะ A
let targetB: TestUser;       // ผู้ใช้ทั่วไปคณะ B

beforeEach(async () => {
  facA = await createFaculty();
  facB = await createFaculty();
  root = await createUser();
  uni = await createUser();
  facAdmin = await createUser({ facultyId: facA });
  reporter = await createUser();
  targetA = await createUser({ facultyId: facA });
  targetB = await createUser({ facultyId: facB });
  await makeAdmin(root.id, 'root');
  await makeAdmin(uni.id, 'university_wide');
  await makeAdmin(facAdmin.id, 'faculty', facA);
});

const isSuspended = async (userId: number) =>
  (await one<{ s: number }>('SELECT is_suspended AS s FROM users WHERE user_id = ?', [userId]))!.s === 1;

// ───────────────────────────── รายงานผู้ใช้ ─────────────────────────────

describe('คำร้องรายงานผู้ใช้ — แอดมินคณะเห็น/ตัดสินได้เฉพาะผู้ใช้ทั่วไปในคณะตัวเอง', () => {
  let reportA: number;
  let reportB: number;
  beforeEach(async () => {
    const report = (target: number, reason: string) => insert('user_reports', {
      reported_by: reporter.id, target_user_id: target, reason, user_report_status: 'pending',
    });
    reportA = await report(targetA.id, 'พูดจาหยาบคาย (คณะ A)');
    reportB = await report(targetB.id, 'สแปม (คณะ B)');
  });
  const statusOf = async (id: number) =>
    (await one<{ s: string }>('SELECT user_report_status AS s FROM user_reports WHERE user_report_id = ?', [id]))!.s;
  const approve = (who: TestUser, id: number) => as(who).post(`/admin/user-reports/${id}/approve`).send({ category: 'spam' });

  it('รายการ: แอดมินคณะ A เห็นแค่เรื่องของคณะ A · แอดมินมหาวิทยาลัยเห็นทั้งหมด · root ไม่เห็น', async () => {
    const facText = JSON.stringify((await as(facAdmin).get('/admin/user-reports?pageSize=100')).body);
    expect(facText).toContain('คณะ A');
    expect(facText).not.toContain('คณะ B');
    const uniText = JSON.stringify((await as(uni).get('/admin/user-reports?pageSize=100')).body);
    expect(uniText).toContain('คณะ A');
    expect(uniText).toContain('คณะ B');
    expect((await as(root).get('/admin/user-reports')).status).toBe(403);
    expect((await as(reporter).get('/admin/user-reports')).status).toBe(403);
  });

  it('🔒 แอดมินคณะ A อนุมัติเรื่องของคณะ B → 403 · ไม่มีใครถูกระงับ · เรื่องยัง pending', async () => {
    expect((await approve(facAdmin, reportB)).status).toBe(403);
    expect(await isSuspended(targetB.id)).toBe(false);
    expect(await statusOf(reportB)).toBe('pending');
  });

  it('🔒 แอดมินคณะ A ปฏิเสธเรื่องของคณะ B → 403 (ปัดตกเรื่องนอกขอบเขตก็ไม่ได้)', async () => {
    expect((await as(facAdmin).post(`/admin/user-reports/${reportB}/reject`).send({ reason: 'ไม่มีมูล' })).status).toBe(403);
    expect(await statusOf(reportB)).toBe('pending');
  });

  it('แอดมินคณะ A อนุมัติเรื่องของคณะ A → ผู้ถูกรายงานถูกระงับ · เรื่องเป็น approved', async () => {
    expect((await approve(facAdmin, reportA)).status).toBe(200);
    expect(await isSuspended(targetA.id)).toBe(true);
    expect(await statusOf(reportA)).toBe('approved');
  });

  it('ปฏิเสธต้องมีเหตุผล · ปฏิเสธแล้วไม่มีใครถูกระงับ · ตัดสินซ้ำไม่ได้', async () => {
    expect((await as(uni).post(`/admin/user-reports/${reportB}/reject`).send({})).status).toBe(400);
    expect((await as(uni).post(`/admin/user-reports/${reportB}/reject`).send({ reason: 'ไม่มีมูล' })).status).toBe(200);
    expect(await statusOf(reportB)).toBe('rejected');
    expect(await isSuspended(targetB.id)).toBe(false);
    expect((await approve(uni, reportB)).status).toBe(409);
  });

  it('แอดมินพิจารณาเรื่องที่รายงานตัวเอง → 403 CANNOT_REVIEW_OWN_REPORT', async () => {
    const aboutUni = await insert('user_reports', {
      reported_by: reporter.id, target_user_id: uni.id, reason: 'แอดมินใช้อำนาจเกิน', user_report_status: 'pending',
    });
    const res = await as(uni).post(`/admin/user-reports/${aboutUni}/reject`).send({ reason: 'ไม่มีมูล' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CANNOT_REVIEW_OWN_REPORT');
    expect(await statusOf(aboutUni)).toBe('pending');
  });
});

// ───────────────────────────── คำร้องทีม ─────────────────────────────

describe('ปฏิเสธคำร้องทีม Official / โอนหัวหน้า — แอดมินมหาวิทยาลัยเท่านั้น', () => {
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
  const requestRow = (id: number) => one<{ s: string; reason: string | null }>(
    'SELECT team_admin_request_status AS s, rejection_reason AS reason FROM team_admin_requests WHERE team_admin_request_id = ?', [id]);
  const teamRow = () => one<{ official_status: string; leader_id: number }>(
    'SELECT official_status, leader_id FROM teams WHERE team_id = ?', [team]);

  it('รายการคำร้อง: แอดมินคณะ/ผู้ใช้ทั่วไป 403 · แอดมินมหาวิทยาลัย 200', async () => {
    for (const path of ['/admin/team-requests', '/admin/team-requests/transfers']) {
      expect((await as(facAdmin).get(path)).status).toBe(403);
      expect((await as(leader).get(path)).status).toBe(403);
      expect((await as(uni).get(path)).status).toBe(200);
    }
  });

  it.each([
    ['ปฏิเสธทีม Official', () => officialReq, '/reject'],
    ['ปฏิเสธการโอนหัวหน้า', () => transferReq, '/reject-transfer'],
  ])('%s: แอดมินคณะ → 403 · แอดมินมหาวิทยาลัย → rejected พร้อมเหตุผล', async (_label, id, suffix) => {
    expect((await as(facAdmin).post(`/admin/team-requests/${id()}${suffix}`).send({ reason: 'x' })).status).toBe(403);
    expect((await requestRow(id()))!.s).toBe('pending');
    expect((await as(uni).post(`/admin/team-requests/${id()}${suffix}`).send({ reason: 'เอกสารไม่ครบ' })).status).toBe(200);
    expect(await requestRow(id())).toEqual({ s: 'rejected', reason: 'เอกสารไม่ครบ' });
    expect(await teamRow()).toEqual({ official_status: 'Unofficial', leader_id: leader.id });
  });

  it('ปฏิเสธด้วยเหตุผลว่าง → 400 · ตัดสินซ้ำ → 409', async () => {
    expect((await as(uni).post(`/admin/team-requests/${officialReq}/reject`).send({ reason: '' })).status).toBe(400);
    expect((await requestRow(officialReq))!.s).toBe('pending');
    expect((await as(uni).post(`/admin/team-requests/${officialReq}/reject`).send({ reason: 'ไม่ผ่าน' })).status).toBe(200);
    expect((await as(uni).post(`/admin/team-requests/${officialReq}/approve`)).status).toBe(409);
    expect((await teamRow())!.official_status).toBe('Unofficial');
  });

  it('แอดมินโอนหัวหน้าเอง: แอดมินคณะ 403 · ไม่ใช่สมาชิก 422 · แอดมินมหาวิทยาลัยโอนได้', async () => {
    const outsider = await createUser();
    expect((await as(facAdmin).post(`/admin/teams/${team}/transfer-leader`).send({ newLeaderId: member.id })).status).toBe(403);
    expect((await as(uni).post(`/admin/teams/${team}/transfer-leader`).send({ newLeaderId: outsider.id })).status).toBe(422);
    expect((await teamRow())!.leader_id).toBe(leader.id);
    expect((await as(uni).post(`/admin/teams/${team}/transfer-leader`).send({ newLeaderId: member.id })).status).toBe(200);
    expect((await teamRow())!.leader_id).toBe(member.id);
  });
});

// ───────────────────────────── กรรมการภายนอก ─────────────────────────────

describe('ตรวจตัวตนกรรมการภายนอก: ขอเอกสารเพิ่ม / ปฏิเสธ', () => {
  let external: TestUser;
  beforeEach(async () => {
    const sport = await createSportType();
    const organizer = await createUser();
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: facA, status: 'public' });
    external = await createUser({ userType: 'external' });
    await insert('tournament_referees', {
      tournament_id: tour, user_id: external.id, invited_by: organizer.id,
      invitation_status: 'accepted', is_external: 1, external_approval_status: 'pending',
    });
  });
  const approvalOf = async () => (await one<{ s: string }>(
    'SELECT external_approval_status AS s FROM tournament_referees WHERE user_id = ?', [external.id]))!.s;

  it('คิวรอตรวจ: แอดมินมหาวิทยาลัยเห็น · แอดมินคณะไม่เห็น', async () => {
    expect((await as(facAdmin).get('/admin/referee-requests')).status).toBe(403);
    const res = await as(uni).get('/admin/referee-requests');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(`"userId":${external.id}`);
  });

  it('ขอเอกสารเพิ่ม: แอดมินคณะ 403 · ไม่มีเหตุผล 400 · แอดมินมหาวิทยาลัย → needs_docs', async () => {
    expect((await as(facAdmin).post(`/admin/referee-requests/${external.id}/request-docs`).send({ reason: 'ขอบัตรชัด ๆ' })).status).toBe(403);
    expect((await as(uni).post(`/admin/referee-requests/${external.id}/request-docs`).send({})).status).toBe(400);
    expect(await approvalOf()).toBe('pending');
    expect((await as(uni).post(`/admin/referee-requests/${external.id}/request-docs`).send({ reason: 'ขอบัตรชัด ๆ' })).status).toBe(200);
    expect(await approvalOf()).toBe('needs_docs');
  });

  it('ปฏิเสธ: แอดมินคณะ 403 · แอดมินมหาวิทยาลัย → rejected · ปฏิเสธซ้ำ → 409', async () => {
    expect((await as(facAdmin).post(`/admin/referee-requests/${external.id}/reject`).send({ reason: 'บัตรปลอม' })).status).toBe(403);
    expect(await approvalOf()).toBe('pending');
    expect((await as(uni).post(`/admin/referee-requests/${external.id}/reject`).send({ reason: 'บัตรปลอม' })).status).toBe(200);
    expect(await approvalOf()).toBe('rejected');
    expect((await as(uni).post(`/admin/referee-requests/${external.id}/reject`).send({ reason: 'ซ้ำ' })).status).toBe(409);
  });
});

// ───────────────────────────── audit log / oversight ─────────────────────────────

describe('audit log และงานค้าง — ไม่ใช่แอดมินคณะ', () => {
  it('แอดมินคณะ/ผู้ใช้ทั่วไป 403 · แอดมินมหาวิทยาลัยและ root เปิดได้', async () => {
    for (const path of ['/admin/audit-logs', '/admin/oversight/stalled']) {
      expect([path, (await as(facAdmin).get(path)).status]).toEqual([path, 403]);
      expect([path, (await as(reporter).get(path)).status]).toEqual([path, 403]);
      expect([path, (await as(uni).get(path)).status]).toEqual([path, 200]);
    }
    expect((await as(root).get('/admin/audit-logs')).status).toBe(200);
  });

  it('การตัดสินถูกบันทึกลง audit log พร้อมผู้ทำ', async () => {
    const report = await insert('user_reports', {
      reported_by: reporter.id, target_user_id: targetA.id, reason: 'x', user_report_status: 'pending',
    });
    await as(uni).post(`/admin/user-reports/${report}/reject`).send({ reason: 'ไม่มีมูล' });
    expect(await all("SELECT 1 FROM audit_logs WHERE user_id = ? AND action_type = 'user_report_rejected' AND entity_id = ?", [uni.id, report]))
      .toHaveLength(1);
  });
});
