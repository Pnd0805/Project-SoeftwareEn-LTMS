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

// ───────────────────────────── ① แถวที่หมดหน้าที่ ─────────────────────────────

describe('① งานเบื้องหลัง — แมตช์จบเกิน 3 วัน', () => {
  it('🔴 แมตช์ completed จบไป 4 วัน → ลบไฟล์ · ล้างคีย์ · **ผลเช็คอินไม่เปลี่ยน**', async () => {
    const { match } = await onlineMatch({ status: 'completed', endedDaysAgo: 4 });
    const id = await checkinRow(match, playerA, docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(1);

    expect(deleted).toEqual([docKey(match, 1)]);
    expect(await rowOf(id)).toEqual({ key: null, status: 'success', type: 'student_id', by: referee.id, method: 'photo_online' });
  });

  it('จบไป 2 วัน (ยังไม่ครบ 3) → เก็บไว้', async () => {
    const { match } = await onlineMatch({ status: 'completed', endedDaysAgo: 2 });
    const id = await checkinRow(match, playerA, docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(0);

    expect(deleted).toEqual([]);
    expect((await rowOf(id))!.key).toBe(docKey(match, 1));
  });

  it.each(['in_progress', 'finished', 'disputed'] as const)('แมตช์ยัง %s (ผลยังไม่เป็นที่สุด) แม้นานแล้ว → เก็บไว้', async (status) => {
    const { match } = await onlineMatch({ status, endedDaysAgo: 30 });
    await checkinRow(match, playerA, docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(0);
    expect(deleted).toEqual([]);
  });

  it('ไม่มีเวลาจบจริง (แพ้บายก่อนแข่ง) → นับจากเวลาจบตามตาราง', async () => {
    const { match } = await onlineMatch({ status: 'completed' });
    await testDb().query(
      `UPDATE matches SET scheduled_time = NOW() - INTERVAL 5 DAY, scheduled_end_time = NOW() - INTERVAL 4 DAY WHERE match_id = ?`, [match]);
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
    const { match } = await onlineMatch({ status: 'completed', endedDaysAgo: 4 });
    const id = await checkinRow(match, playerA, docKey(match, 1));
    failKeys.add(docKey(match, 1));

    expect(await purgeCheckinDocuments()).toBe(0);
    expect((await rowOf(id))!.key).toBe(docKey(match, 1));

    failKeys.clear();
    expect(await purgeCheckinDocuments()).toBe(1);
    expect((await rowOf(id))!.key).toBeNull();
  });

  it('รันซ้ำ → ไม่มีอะไรเข้าเกณฑ์อีก', async () => {
    const { match } = await onlineMatch({ status: 'completed', endedDaysAgo: 4 });
    await checkinRow(match, playerA, docKey(match, 1));
    await checkinRow(match, playerB, null);   // เช็คอินแบบอื่นที่ไม่มีรูป — ไม่แตะ

    expect(await purgeCheckinDocuments()).toBe(1);
    expect(await purgeCheckinDocuments()).toBe(0);
    expect(deleted).toHaveLength(1);
  });

  it('🔴 key ที่ไม่ใช่รูปเช็คอินของแมตช์นี้ (เช่นรูปโปรไฟล์ของคนอื่น) → ไม่ลบไฟล์นั้น แค่ตัดการชี้', async () => {
    const { match } = await onlineMatch({ status: 'completed', endedDaysAgo: 4 });
    const avatar = `avatar/${playerB.id}/00000001-0000-4000-8000-000000000000.jpg`;
    const id = await checkinRow(match, playerA, avatar);

    expect(await purgeCheckinDocuments()).toBe(1);

    expect(deleted).toEqual([]);
    expect((await rowOf(id))!.key).toBeNull();
  });

  it('🔴 ไฟล์เดียวกันที่แถวของแมตช์ที่ยังไม่จบชี้อยู่ด้วย → ไม่ลบ ทั้งสองแถวคงเดิม', async () => {
    const old = await onlineMatch({ status: 'completed', endedDaysAgo: 4 });
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
    const { tour, match } = await onlineMatch({ status: 'completed', endedDaysAgo: 4 });
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
  expect(names).toContain('ลบรูปบัตรเช็คอินของแมตช์ที่จบเกิน 3 วัน (OD-73)');
  expect(names).toContain('ลบรูปบัตรเช็คอินที่ไม่มีแถวชี้ถึง (OD-73)');
});
