import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * OD-70 (งาน ⑥ · 29 ต.ค. 2569) — ลบภาพยืนยันตัวตนกรรมการเมื่อหมดหน้าที่ · ยิงฐานจริง
 *
 * ★ ต้องเป็น integration เพราะเกณฑ์ทั้งหมดอยู่ใน SQL (ทัวร์จบ · 30 วัน · แถวรอตรวจ · ลำดับ SET)
 *   unit ที่ mock repo ทิ้งจะไม่เห็นอะไรเลย
 * ★ S3 ถูกบล็อกใน integration (setup/perFile.ts) ⇒ mock แค่สองฟังก์ชันที่แตะที่เก็บไฟล์ ที่เหลือของจริง
 * 🔴 เทสที่สำคัญที่สุด (ใบสั่งงานขั้น 5): ลบแล้ว **ผลการตรวจต้องไม่เปลี่ยน** — กันไม่ให้ใครเผลอลบผลไปด้วย
 */
const deleted = vi.hoisted(() => [] as string[]);
const failKeys = vi.hoisted(() => new Set<string>());
const storage = vi.hoisted(() => ({ objects: [] as { key: string; lastModified: Date | null }[] }));
vi.mock('../../services/upload.service.js', async (orig) => ({
  ...(await orig<typeof import('../../services/upload.service.js')>()),
  deleteObjectConfirmed: vi.fn(async (k: string) => { if (failKeys.has(k)) return false; deleted.push(k); return true; }),
  listObjectsByPrefix: vi.fn(async () => storage.objects),
}));

import { as } from './helpers/api.js';
import { insert, one, testDb } from './helpers/db.js';
import { createFaculty, createSportType, createTournament, createUser, makeAdmin, type TestUser } from './helpers/factories.js';
import { purgeRefereeIdentityDocs, sweepOrphanRefereeDocs } from '../../services/refereeDocs.service.js';
import { backgroundJobs } from '../../jobs/index.js';

let organizer: TestUser;
let referee: TestUser;
let uniAdmin: TestUser;
let sport: number;
let faculty: number;

const key = (user: number, n: number) => `referee_identity/${user}/0000000${n}-0000-4000-8000-000000000000.jpg`;
const tour = (status: 'public' | 'completed' | 'cancelled' | 'auto_deleted' | 'private' = 'public') =>
  createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status });
/** ทัวร์ที่จบไปแล้ว `daysAgo` วัน — ตั้งเวลาจบตามชนิดที่ repo ใช้นับ */
async function endedTour(status: 'completed' | 'cancelled' | 'auto_deleted', daysAgo: number): Promise<number> {
  const id = await tour(status);
  const at = `NOW() - INTERVAL ${daysAgo} DAY`;
  if (status === 'completed') await testDb().query(`UPDATE tournaments SET completed_at = ${at} WHERE tournament_id = ?`, [id]);
  if (status === 'cancelled') await testDb().query(`UPDATE tournaments SET cancelled_at = ${at}, cancelled_from_status = 'public' WHERE tournament_id = ?`, [id]);
  if (status === 'auto_deleted') await testDb().query(
    `UPDATE tournaments SET event_start_date = DATE(${at}), event_end_date = DATE(${at}) WHERE tournament_id = ?`, [id]);
  return id;
}
async function refRow(o: {
  tournamentId: number; userId?: number; status?: 'pending' | 'needs_docs' | 'approved' | 'rejected';
  docs?: string[] | null; removed?: boolean; approvedAt?: string | null; purged?: boolean;
}): Promise<number> {
  return insert('tournament_referees', {
    tournament_id: o.tournamentId, user_id: o.userId ?? referee.id, invited_by: organizer.id,
    invitation_status: 'accepted', is_external: 1, external_approval_status: o.status ?? 'pending',
    external_verification_docs: o.docs === null ? null : JSON.stringify(o.docs ?? [key(o.userId ?? referee.id, 1)]),
    approved_by: o.approvedAt ? uniAdmin.id : null, approved_at: o.approvedAt ?? null,
    removed_at: o.removed ? new Date() : null, removed_by: o.removed ? organizer.id : null,
    docs_purged_at: o.purged ? new Date() : null,
  });
}
type RowState = { docs: string[] | null; purged: Date | null; status: string; approved_at: Date | null };
const rowOf = (id: number) => one<RowState>(
  `SELECT external_verification_docs AS docs, docs_purged_at AS purged, external_approval_status AS status, approved_at
     FROM tournament_referees WHERE tournament_referee_id = ?`, [id]);

beforeEach(async () => {
  deleted.length = 0;
  failKeys.clear();
  storage.objects = [];
  faculty = await createFaculty();
  sport = await createSportType();
  organizer = await createUser();
  referee = await createUser({ userType: 'external' });
  uniAdmin = await createUser();
  await makeAdmin(uniAdmin.id, 'university_wide');
});

describe('② งานเบื้องหลัง — แถวที่ยังถือคีย์ของทัวร์ที่จบแล้วเกิน 30 วัน', () => {
  it('🔴 เข้าเกณฑ์ → ลบไฟล์ · ล้างคีย์ · บันทึกเวลา · **ผลการตรวจไม่เปลี่ยน** (ทั้ง pending และ approved)', async () => {
    const t = await endedTour('completed', 31);
    const other = await createUser({ userType: 'external' });
    const pending = await refRow({ tournamentId: t });
    const approved = await refRow({ tournamentId: t, userId: other.id, status: 'approved',
      approvedAt: '2026-06-01 10:00:00', docs: [key(other.id, 2)] });
    const approvedBefore = (await rowOf(approved))!.approved_at;

    await expect(purgeRefereeIdentityDocs()).resolves.toBe(2);

    expect(deleted.sort()).toEqual([key(referee.id, 1), key(other.id, 2)].sort());
    expect(await rowOf(pending)).toMatchObject({ docs: null, status: 'pending', approved_at: null });
    expect((await rowOf(pending))!.purged).not.toBeNull();
    const a = (await rowOf(approved))!;
    expect(a).toMatchObject({ docs: null, status: 'approved' });
    expect(a.approved_at).toEqual(approvedBefore);   // ผลอนุมัติ 1 ปีต้องอยู่ครบ (ข้อ 2.3)
    expect(a.purged).not.toBeNull();
  });

  it('ยังไม่ครบ 30 วัน → ไม่ลบ', async () => {
    const row = await refRow({ tournamentId: await endedTour('completed', 29) });
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(0);
    expect(deleted).toEqual([]);
    expect((await rowOf(row))!.docs).toEqual([key(referee.id, 1)]);
  });

  it('ทัวร์ยังจัดอยู่ → ไม่ลบ', async () => {
    await refRow({ tournamentId: await tour('public'), removed: true });
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(0);
    expect(deleted).toEqual([]);
  });

  it('docs_purged_at มีค่าแล้ว → ไม่ทำซ้ำ', async () => {
    await refRow({ tournamentId: await endedTour('completed', 40), purged: true });
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(0);
    expect(deleted).toEqual([]);
  });

  it('รันสองรอบ → รอบสองไม่มีอะไรให้ทำ', async () => {
    await refRow({ tournamentId: await endedTour('completed', 40) });
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(1);
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(0);
    expect(deleted).toHaveLength(1);
  });

  it('🔴 คนนี้ยังรอตรวจอยู่ในทัวร์ที่ยังจัดอยู่ → ไม่ลบไฟล์ของเขาเลย (แอดมินกำลังจะเปิดดู)', async () => {
    const dead = await refRow({ tournamentId: await endedTour('completed', 40), docs: [key(referee.id, 1)] });
    await refRow({ tournamentId: await tour('public'), docs: [key(referee.id, 2)] });   // รอตรวจในทัวร์ที่ยังจัดอยู่
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(0);
    expect(deleted).toEqual([]);
    expect((await rowOf(dead))!.docs).toEqual([key(referee.id, 1)]);
  });

  it('★ ไฟล์ที่แถวอื่นยังชี้อยู่ (แถวถูกถอดในทัวร์ที่ยังจัด) → ไม่ลบ แถวที่เข้าเกณฑ์ก็ยังไม่ปิด', async () => {
    const dead = await refRow({ tournamentId: await endedTour('completed', 40) });
    await refRow({ tournamentId: await tour('public'), removed: true });   // คีย์เดียวกัน
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(0);
    expect(deleted).toEqual([]);
    expect((await rowOf(dead))!.purged).toBeNull();
  });

  it.each([
    ['ยกเลิก', 'cancelled'],
    ['ระบบปิดเอง', 'auto_deleted'],
  ] as const)('ทัวร์%s เกิน 30 วัน → ลบ (ข้อ 2.1 นับทั้งสามแบบ)', async (_label, status) => {
    const row = await refRow({ tournamentId: await endedTour(status, 31) });
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(1);
    expect((await rowOf(row))!.docs).toBeNull();
  });

  it('ทัวร์ที่ถูกลบเกิน 30 วัน → ลบ (ไม่งั้นค้างตลอดไป)', async () => {
    const t = await tour('private');
    await testDb().query('UPDATE tournaments SET deleted_at = NOW() - INTERVAL 31 DAY WHERE tournament_id = ?', [t]);
    await refRow({ tournamentId: t });
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(1);
  });

  it('🔴 ลบไฟล์พลาด → แถวไม่ถูกปิด คีย์ยังอยู่ (รอบหน้าลองใหม่)', async () => {
    const row = await refRow({ tournamentId: await endedTour('completed', 40), docs: [key(referee.id, 1), key(referee.id, 2)] });
    failKeys.add(key(referee.id, 2));
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(0);
    expect(await rowOf(row)).toMatchObject({ docs: [key(referee.id, 1), key(referee.id, 2)], purged: null });

    failKeys.clear();
    await expect(purgeRefereeIdentityDocs()).resolves.toBe(1);
    expect((await rowOf(row))!.docs).toBeNull();
  });
});

describe('① ตอนแอดมินตัดสิน — ลบไฟล์ด้วย (เดิมล้างแค่คีย์ ไฟล์ค้าง)', () => {
  let row: number;
  beforeEach(async () => {
    row = await refRow({ tournamentId: await tour('public'), docs: [key(referee.id, 1), key(referee.id, 2)] });
  });

  it('อนุมัติ → ไฟล์ถูกลบ · คีย์ถูกล้าง · บันทึกเวลา · สถานะ approved', async () => {
    const res = await as(uniAdmin).post(`/admin/referee-requests/${referee.id}/approve`).send({});
    expect(res.status).toBe(200);
    expect(deleted.sort()).toEqual([key(referee.id, 1), key(referee.id, 2)].sort());
    const r = (await rowOf(row))!;
    expect(r).toMatchObject({ docs: null, status: 'approved' });
    expect(r.purged).not.toBeNull();   // ★ พิสูจน์ลำดับใน SET: บันทึกเวลาก่อนล้างคีย์
  });

  it.each([
    ['ขอเอกสารใหม่', 'request-docs', 'needs_docs'],
    ['ปฏิเสธ', 'reject', 'rejected'],
  ])('%s → ไฟล์ถูกลบเหมือนกัน', async (_label, path, status) => {
    const res = await as(uniAdmin).post(`/admin/referee-requests/${referee.id}/${path}`).send({ reason: 'เอกสารไม่ชัด' });
    expect(res.status).toBe(200);
    expect(deleted).toHaveLength(2);
    expect((await rowOf(row))!).toMatchObject({ docs: null, status });
  });

  it('★ แถวที่ถูกถอดไปแล้ว (การตัดสินไม่แตะ) ยังถือคีย์ของตัวเอง → ไฟล์นั้นไม่ถูกลบใต้เท้า', async () => {
    const removed = await refRow({ tournamentId: await tour('public'), removed: true, docs: [key(referee.id, 2)] });
    await as(uniAdmin).post(`/admin/referee-requests/${referee.id}/approve`).send({});
    expect(deleted).toEqual([key(referee.id, 1)]);
    expect((await rowOf(removed))!.docs).toEqual([key(referee.id, 2)]);
  });

  it('ที่เก็บไฟล์ล่มตอนลบ → การอนุมัติยังสำเร็จ (ไฟล์ไปรองานกวาด)', async () => {
    failKeys.add(key(referee.id, 1));
    failKeys.add(key(referee.id, 2));
    const res = await as(uniAdmin).post(`/admin/referee-requests/${referee.id}/approve`).send({});
    expect(res.status).toBe(200);
    expect((await rowOf(row))!.status).toBe('approved');
  });
});

describe('③ งานกวาด — ไฟล์ที่ไม่มีแถวไหนชี้ถึง', () => {
  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

  it('ลบเฉพาะไฟล์ไม่มีเจ้าของที่เก่ากว่า 7 วัน · ไฟล์ที่มีแถวชี้อยู่ไม่แตะ', async () => {
    await refRow({ tournamentId: await tour('public'), docs: [key(referee.id, 1)] });
    storage.objects = [
      { key: key(referee.id, 1), lastModified: daysAgo(30) },   // มีแถวชี้อยู่
      { key: key(referee.id, 2), lastModified: daysAgo(30) },   // ✅ ไฟล์ค้างจากการตัดสินก่อนมีงานนี้
      { key: key(referee.id, 3), lastModified: daysAgo(1) },    // เพิ่งอัปโหลด ยังไม่กดส่ง
    ];
    await expect(sweepOrphanRefereeDocs()).resolves.toBe(1);
    expect(deleted).toEqual([key(referee.id, 2)]);
  });

  it('ไฟล์ที่ ① ลบพลาด → รอบกวาดเก็บให้', async () => {
    await refRow({ tournamentId: await tour('public'), docs: [key(referee.id, 1)] });
    failKeys.add(key(referee.id, 1));
    await as(uniAdmin).post(`/admin/referee-requests/${referee.id}/approve`).send({});
    expect(deleted).toEqual([]);

    failKeys.clear();
    storage.objects = [{ key: key(referee.id, 1), lastModified: daysAgo(10) }];
    await expect(sweepOrphanRefereeDocs()).resolves.toBe(1);
    expect(deleted).toEqual([key(referee.id, 1)]);
  });
});

describe('ทะเบียนงานเบื้องหลัง (ใบสั่งงานขั้น 4)', () => {
  it('ลงทะเบียนทั้งสองงานใน jobs/index.ts', () => {
    const names = backgroundJobs.map(j => j.name);
    expect(names).toContain('ลบภาพยืนยันตัวตนกรรมการของทัวร์ที่จบแล้ว');
    expect(names.some(n => n.includes('ไม่มีแถวชี้ถึง'))).toBe(true);
  });
});
