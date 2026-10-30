import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * OD-73 (29 ต.ค. 2569) — ลบรูปบัตรตอนเช็คอินออนไลน์เมื่อแมตช์จบเกิน 3 วัน · ยิงฐานจริง
 *
 * ★ ต้องเป็น integration เพราะเกณฑ์ทั้งหมดอยู่ใน SQL (แมตช์ completed · 3 วัน · ทัวร์จบ/ยกเลิก/ถูกลบ)
 * ★ S3 ถูกบล็อกใน integration (setup/perFile.ts) ⇒ mock แค่ฟังก์ชันที่แตะที่เก็บไฟล์ ที่เหลือของจริง
 * 🔴 ข้อที่สำคัญที่สุด: ลบแล้ว **ผลเช็คอินต้องไม่เปลี่ยน** (สถานะ · ชนิดบัตร · กรรมการที่ตรวจ)
 */
const deleted = vi.hoisted(() => [] as string[]);
const failKeys = vi.hoisted(() => new Set<string>());
const storage = vi.hoisted(() => ({ objects: [] as { key: string; lastModified: Date | null }[] }));
vi.mock('../../services/upload.service.js', async (orig) => ({
  ...(await orig<typeof import('../../services/upload.service.js')>()),
  deleteObjectConfirmed: vi.fn(async (k: string) => { if (failKeys.has(k)) return false; deleted.push(k); return true; }),
  listObjectsByPrefix: vi.fn(async () => storage.objects),
  getPresignedDownloadUrl: vi.fn(async (k: string) => `signed:${k}`),
}));

import { as } from './helpers/api.js';
import { insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';
import { purgeCheckinDocuments, sweepOrphanCheckinDocs } from '../../services/checkinDocs.service.js';
import { backgroundJobs } from '../../jobs/index.js';

let organizer: TestUser;
let referee: TestUser;
let playerA: TestUser;
let playerB: TestUser;
let sport: number;
let faculty: number;

const docKey = (match: number, n: number) => `checkin_document/${match}/0000000${n}-0000-4000-8000-000000000000.jpg`;

beforeEach(async () => {
  deleted.length = 0;
  failKeys.clear();
  storage.objects = [];
  faculty = await createFaculty();
  sport = await createSportType({ minMembers: 1, maxMembers: 5 });
  organizer = await createUser();
  referee = await createUser();
  playerA = await createUser();
  playerB = await createUser();
});

type MatchStatus = 'checkin_open' | 'in_progress' | 'finished' | 'completed' | 'disputed';
/** แมตช์ออนไลน์ที่จบไปแล้ว `endedDaysAgo` วัน (เวลาจบจริง) */
async function onlineMatch(o: { status: MatchStatus; endedDaysAgo?: number; tournamentStatus?: 'public' | 'completed' | 'cancelled' }) {
  const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: o.tournamentStatus ?? 'public' });
  const teamA = await createTeam({ leader: playerA.id, sportTypeId: sport });
  const teamB = await createTeam({ leader: playerB.id, sportTypeId: sport });
  const match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'online', status: o.status });
  if (o.endedDaysAgo !== undefined) {
    await testDb().query(`UPDATE matches SET actual_end_time = NOW() - INTERVAL ${o.endedDaysAgo} DAY WHERE match_id = ?`, [match]);
  }
  return { tour, teamA, teamB, match };
}

/** แถวเช็คอินด้วยรูปบัตร — ผ่านการตรวจแล้วโดยกรรมการ (ค่าตั้งต้น) */
const checkinRow = (match: number, user: TestUser, key: string | null, status: 'success' | 'pending' | 'rejected' = 'success') =>
  insert('match_checkins', {
    match_id: match, user_id: user.id, method: 'photo_online', match_checkin_status: status,
    document_type: 'student_id', document_s3_key: key,
    verified_by_referee_id: status === 'pending' ? null : referee.id, verified_at: status === 'pending' ? null : new Date(),
  });

type Row = { key: string | null; status: string; type: string | null; by: number | null; method: string };
const rowOf = (id: number) => one<Row>(
  `SELECT document_s3_key AS \`key\`, match_checkin_status AS status, document_type AS type,
          verified_by_referee_id AS \`by\`, method FROM match_checkins WHERE match_checkin_id = ?`, [id]);

/** ผลแมตช์ — `verifiedHoursAgo` = ยืนยันไปแล้วกี่ชั่วโมง · ไม่ส่ง = ยังไม่ยืนยัน (สถานะตาม status) */
async function result(match: number, teamA: number, o: { status?: 'verified' | 'disputed' | 'submitted'; verifiedHoursAgo?: number } = {}) {
  return insert('match_results', {
    match_id: match, winner_team_id: teamA, score_data: JSON.stringify({ [teamA]: 1 }),
    submitted_by_user_id: referee.id, submitted_role: 'referee', match_result_status: o.status ?? 'verified',
    verified_by_user_id: o.verifiedHoursAgo === undefined ? null : playerA.id,
    verified_at: o.verifiedHoursAgo === undefined ? null : new Date(Date.now() - o.verifiedHoursAgo * 3600_000),
  });
}
const DAY = 24;

// ───────────────────────────── ① แถวที่หมดหน้าที่ ─────────────────────────────

/**
 * 🔴 QA 30 ต.ค. 2569 (D2) — แทนที่กฎเดิมของ OD-73 ("แมตช์ completed เกิน 3 วันนับจากแมตช์จบ")
 *   ระยะโต้แย้งเริ่มนับตอนยืนยันผล (ผู้จัดตั้งได้ถึง 72 ชม.) และร้องเรียนได้จนกว่าทัวร์จะปิด
 *   ⇒ ลบเมื่อ verified_at + dispute_window_hours + 3 วัน ผ่านไปแล้ว และไม่มีเรื่องค้าง
 */
describe('① งานเบื้องหลัง — หมดเวลาโต้แย้ง + กันชน และไม่มีเรื่องค้าง', () => {
  it('🔴 เทส 1: ยืนยันผลแล้ว หมดเวลาโต้แย้ง (24 ชม.) + กันชน 3 วัน → ลบไฟล์ · ล้างคีย์ · **ผลเช็คอินไม่เปลี่ยน**', async () => {
    const { match, teamA } = await onlineMatch({ status: 'completed', endedDaysAgo: 10 });
    await result(match, teamA, { verifiedHoursAgo: 4 * DAY + 1 });
    const id = await checkinRow(match, playerA, docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(1);

    expect(deleted).toEqual([docKey(match, 1)]);
    expect(await rowOf(id)).toEqual({ key: null, status: 'success', type: 'student_id', by: referee.id, method: 'photo_online' });
  });

  it('🔴 เทส 2: ยังไม่หมดเวลาโต้แย้ง (ผู้จัดตั้ง 72 ชม.) → ไม่ลบ แม้แมตช์จบไปนานแล้ว', async () => {
    const { tour, match, teamA } = await onlineMatch({ status: 'completed', endedDaysAgo: 10 });
    await testDb().query('UPDATE tournaments SET dispute_window_hours = 72 WHERE tournament_id = ?', [tour]);
    await result(match, teamA, { verifiedHoursAgo: 4 * DAY + 1 });   // 72 ชม. + 3 วัน = 6 วัน ยังไม่ถึง
    const id = await checkinRow(match, playerA, docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(0);
    expect((await rowOf(id))!.key).toBe(docKey(match, 1));
  });

  it('หมดเวลาโต้แย้งแล้วแต่ยังไม่พ้นกันชน 3 วัน → ไม่ลบ', async () => {
    const { match, teamA } = await onlineMatch({ status: 'completed', endedDaysAgo: 10 });
    await result(match, teamA, { verifiedHoursAgo: 3 * DAY });   // 24 ชม. + 3 วัน = 4 วัน ยังไม่ถึง
    await checkinRow(match, playerA, docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(0);
  });

  it('🔴 เทส 3: มีเรื่องร้องเรียนค้าง (open) → ไม่ลบ แม้หมดเวลาโต้แย้งนานแล้ว · ตัดสินแล้วค่อยลบ', async () => {
    const { match, teamA } = await onlineMatch({ status: 'completed', endedDaysAgo: 30 });
    const res = await result(match, teamA, { verifiedHoursAgo: 20 * DAY });
    const complaint = await insert('match_result_complaints', {
      match_id: match, match_result_id: res, filed_by: playerB.id, reason: 'นับประตูผิด', complaint_status: 'open',
    });
    await checkinRow(match, playerA, docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(0);

    await testDb().query(`UPDATE match_result_complaints SET complaint_status = 'no_merit' WHERE match_result_complaint_id = ?`, [complaint]);
    expect(await purgeCheckinDocuments()).toBe(1);
  });

  it('🔴 เทส 4: มีข้อโต้แย้งค้าง (ผล disputed) → ไม่ลบ แม้จบไปนานเกินทางสำรอง', async () => {
    const { match, teamA } = await onlineMatch({ status: 'disputed', endedDaysAgo: 60 });
    await result(match, teamA, { status: 'disputed' });
    await checkinRow(match, playerA, docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(0);
  });

  it('🔴 เทส 5: ไม่เคยยืนยันผล · จบเกิน 30 วัน → ลบตามทางสำรอง (ไม่ค้างตลอดไป) · 29 วันยังไม่ลบ', async () => {
    const old = await onlineMatch({ status: 'finished', endedDaysAgo: 31 });
    const recent = await onlineMatch({ status: 'finished', endedDaysAgo: 29 });
    await result(old.match, old.teamA, { status: 'submitted' });
    await checkinRow(old.match, playerA, docKey(old.match, 1));
    await checkinRow(recent.match, playerA, docKey(recent.match, 1));

    expect(await purgeCheckinDocuments()).toBe(1);
    expect(deleted).toEqual([docKey(old.match, 1)]);
  });

  it('ไม่มีเวลาจบจริง (แพ้บายก่อนแข่ง) · ไม่มีผลยืนยัน → ทางสำรองนับจากเวลาจบตามตาราง', async () => {
    const { match } = await onlineMatch({ status: 'completed' });
    await testDb().query(
      `UPDATE matches SET scheduled_time = NOW() - INTERVAL 32 DAY, scheduled_end_time = NOW() - INTERVAL 31 DAY WHERE match_id = ?`, [match]);
    await checkinRow(match, playerA, docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(1);
  });

  it('ทัวร์ถูกยกเลิกไป 4 วัน · แมตช์ค้างที่เปิดเช็คอิน (ถูกแช่แข็ง) · รูปรอตรวจ → ลบ', async () => {
    const { tour, match } = await onlineMatch({ status: 'checkin_open', tournamentStatus: 'cancelled' });
    await testDb().query(
      `UPDATE tournaments SET cancelled_at = NOW() - INTERVAL 4 DAY, cancelled_from_status = 'public' WHERE tournament_id = ?`, [tour]);
    const id = await checkinRow(match, playerA, docKey(match, 1), 'pending');

    expect(await purgeCheckinDocuments()).toBe(1);
    expect(await rowOf(id)).toMatchObject({ key: null, status: 'pending' });
  });

  it('ทัวร์ถูกลบไป 4 วัน → ลบ', async () => {
    const { tour, match } = await onlineMatch({ status: 'checkin_open' });
    await testDb().query(`UPDATE tournaments SET deleted_at = NOW() - INTERVAL 4 DAY WHERE tournament_id = ?`, [tour]);
    await checkinRow(match, playerA, docKey(match, 1), 'pending');

    expect(await purgeCheckinDocuments()).toBe(1);
  });

  it('🔴 ลบไฟล์พลาด → แถวคงเดิม (ลบไฟล์ก่อนล้างคีย์) · รอบหน้าลองใหม่ได้', async () => {
    const { match, teamA } = await onlineMatch({ status: 'completed', endedDaysAgo: 10 });
    await result(match, teamA, { verifiedHoursAgo: 5 * DAY });
    const id = await checkinRow(match, playerA, docKey(match, 1));
    failKeys.add(docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(0);
    expect((await rowOf(id))!.key).toBe(docKey(match, 1));

    failKeys.clear();
    expect(await purgeCheckinDocuments()).toBe(1);
    expect((await rowOf(id))!.key).toBeNull();
  });

  it('รันซ้ำ → ไม่มีอะไรเข้าเกณฑ์อีก', async () => {
    const { match, teamA } = await onlineMatch({ status: 'completed', endedDaysAgo: 10 });
    await result(match, teamA, { verifiedHoursAgo: 5 * DAY });
    await checkinRow(match, playerA, docKey(match, 1));
    await checkinRow(match, playerB, null);   // เช็คอินแบบอื่นที่ไม่มีรูป — ไม่แตะ

    expect(await purgeCheckinDocuments()).toBe(1);
    expect(await purgeCheckinDocuments()).toBe(0);
    expect(deleted).toHaveLength(1);
  });

  it('🔴 key ที่ไม่ใช่รูปเช็คอินของแมตช์นี้ (เช่นรูปโปรไฟล์ของคนอื่น) → ไม่ลบไฟล์นั้น แค่ตัดการชี้', async () => {
    const { match, teamA } = await onlineMatch({ status: 'completed', endedDaysAgo: 10 });
    await result(match, teamA, { verifiedHoursAgo: 5 * DAY });
    const avatar = `avatar/${playerB.id}/00000001-0000-4000-8000-000000000000.jpg`;
    const id = await checkinRow(match, playerA, avatar);

    expect(await purgeCheckinDocuments()).toBe(1);

    expect(deleted).toEqual([]);
    expect((await rowOf(id))!.key).toBeNull();
  });

  it('🔴 ไฟล์เดียวกันที่แถวของแมตช์ที่ยังไม่จบชี้อยู่ด้วย → ไม่ลบ ทั้งสองแถวคงเดิม', async () => {
    const old = await onlineMatch({ status: 'completed', endedDaysAgo: 10 });
    await result(old.match, old.teamA, { verifiedHoursAgo: 5 * DAY });
    const live = await onlineMatch({ status: 'checkin_open' });
    const shared = docKey(old.match, 1);
    const a = await checkinRow(old.match, playerA, shared);
    const b = await checkinRow(live.match, playerB, shared, 'pending');

    expect(await purgeCheckinDocuments()).toBe(0);

    expect(deleted).toEqual([]);
    expect((await rowOf(a))!.key).toBe(shared);
    expect((await rowOf(b))!.key).toBe(shared);
  });

  it('API: หลังลบ กรรมการเปิดรายการเช็คอินได้ตามปกติ · documentUrl = null · สถานะเดิม', async () => {
    const { tour, match, teamA } = await onlineMatch({ status: 'completed', endedDaysAgo: 10 });
    await result(match, teamA, { verifiedHoursAgo: 5 * DAY });
    const refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
    await checkinRow(match, playerA, docKey(match, 1));

    const before = await as(referee).get(`/matches/${match}/checkins`);
    expect(before.status).toBe(200);
    expect(JSON.stringify(before.body)).toContain(`signed:${docKey(match, 1)}`);

    await purgeCheckinDocuments();

    const after = await as(referee).get(`/matches/${match}/checkins`);
    expect(after.status).toBe(200);
    expect(JSON.stringify(after.body)).not.toContain('checkin_document/');
    expect(after.body.items).toHaveLength(1);
    expect(after.body.items[0]).toMatchObject({ documentUrl: null });
  });
});

// ───────────────────────────── ② ไฟล์ไม่มีเจ้าของ ─────────────────────────────

describe('② งานกวาดไฟล์ใต้ checkin_document/ ที่ไม่มีแถวชี้ถึง', () => {
  const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 3600 * 1000);

  it('ไม่มีแถวชี้ + เก่ากว่า 1 วัน → ลบ · ยังมีแถวชี้ / เพิ่งอัป / ไม่ใช่รูปไฟล์เช็คอิน → ไม่แตะ', async () => {
    const { match } = await onlineMatch({ status: 'checkin_open' });
    await checkinRow(match, playerA, docKey(match, 1), 'pending');
    storage.objects = [
      { key: docKey(match, 1), lastModified: daysAgo(5) },                    // ยังมีแถวชี้
      { key: docKey(match, 2), lastModified: daysAgo(2) },                    // ไม่มีเจ้าของ เก่า → ลบ
      { key: docKey(match, 3), lastModified: new Date(Date.now() - 3600_000) }, // ไม่มีเจ้าของ เพิ่งอัป (กำลังกรอก)
      { key: `checkin_document/${match}/readme.txt`, lastModified: daysAgo(30) }, // ไม่ใช่รูปไฟล์เช็คอิน
      { key: docKey(match, 4), lastModified: null },                          // ไม่รู้อายุ
    ];

    expect(await sweepOrphanCheckinDocs()).toBe(1);
    expect(deleted).toEqual([docKey(match, 2)]);
  });

  it('🔴 ส่งรูปใหม่ทับแถวที่ถูกปฏิเสธ → รูปเก่าไม่มีแถวชี้แล้ว → งานกวาดเก็บได้', async () => {
    const { match } = await onlineMatch({ status: 'checkin_open' });
    const id = await checkinRow(match, playerA, docKey(match, 1), 'rejected');
    await testDb().query(`UPDATE match_checkins SET document_s3_key = ?, match_checkin_status = 'pending' WHERE match_checkin_id = ?`,
      [docKey(match, 2), id]);   // reCheckin ทับ key
    storage.objects = [
      { key: docKey(match, 1), lastModified: daysAgo(2) },
      { key: docKey(match, 2), lastModified: daysAgo(2) },
    ];

    expect(await sweepOrphanCheckinDocs()).toBe(1);
    expect(deleted).toEqual([docKey(match, 1)]);
  });
});

it('ลงทะเบียนในงานเบื้องหลังทั้งสองงาน', () => {
  const names = backgroundJobs.map(j => j.name);
  expect(names).toContain('ลบรูปบัตรเช็คอินที่หมดเวลาโต้แย้ง/ร้องเรียนแล้ว (OD-73 · QA D2)');
  expect(names).toContain('ลบรูปบัตรเช็คอินที่ไม่มีแถวชี้ถึง (OD-73)');
});
