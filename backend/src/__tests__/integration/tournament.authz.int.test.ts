import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { one, insert } from './helpers/db.js';
import {
  createFaculty, createSportType, createUser, createTournament, makeAdmin, type TestUser,
} from './helpers/factories.js';

/**
 * สิทธิ์ระดับบริบทของทัวร์นาเมนต์ — "เป็นผู้จัด" ไม่ใช่ role ของบัญชี แต่ผูกกับทัวร์รายการนั้น (BR-02)
 *
 * ★ ทุกเทสตรวจสองอย่าง: (1) HTTP status/code (2) **ฐานไม่เปลี่ยน** เมื่อถูกปฏิเสธ
 *   ข้อ (2) สำคัญ — ด่านที่ตอบ 403 แต่เขียนฐานไปแล้ว (เช็คสิทธิ์หลัง UPDATE) จะผ่านข้อ (1) ได้
 */

let faculty: number;
let otherFaculty: number;
let sport: number;
let orgA: TestUser;
let orgB: TestUser;
let stranger: TestUser;

beforeEach(async () => {
  faculty = await createFaculty();
  otherFaculty = await createFaculty();
  sport = await createSportType();
  orgA = await createUser();
  orgB = await createUser();
  stranger = await createUser();
});

const registrationOpen = async (id: number) =>
  (await one<{ registration_open: number }>('SELECT registration_open FROM tournaments WHERE tournament_id = ?', [id]))!.registration_open;
const statusOf = async (id: number) =>
  (await one<{ tournament_status: string }>('SELECT tournament_status FROM tournaments WHERE tournament_id = ?', [id]))!.tournament_status;

// ───────────────────────────── BR-02 ผู้จัดผูกกับทัวร์รายการนั้น ─────────────────────────────

describe('POST /tournaments/:id/open-registration — requireOrganizer', () => {
  let tourA: number;
  beforeEach(async () => {
    tourA = await createTournament({ organizer: orgA.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    await createTournament({ organizer: orgB.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  });

  it('ผู้จัดของทัวร์นี้ → 200 และฐานเปิดรับสมัครจริง', async () => {
    const res = await as(orgA).post(`/tournaments/${tourA}/open-registration`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: tourA, registrationOpen: true });
    expect(await registrationOpen(tourA)).toBe(1);
  });

  it('ผู้จัดของ "ทัวร์อื่น" → 403 NOT_ORGANIZER · ฐานไม่เปลี่ยน', async () => {
    const res = await as(orgB).post(`/tournaments/${tourA}/open-registration`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ORGANIZER');
    expect(await registrationOpen(tourA)).toBe(0);
  });

  it('ผู้ใช้ทั่วไป → 403 · ฐานไม่เปลี่ยน', async () => {
    const res = await as(stranger).post(`/tournaments/${tourA}/open-registration`);
    expect(res.status).toBe(403);
    expect(await registrationOpen(tourA)).toBe(0);
  });

  it('ไม่ล็อกอิน → 401', async () => {
    const res = await anon.post(`/tournaments/${tourA}/open-registration`);
    expect(res.status).toBe(401);
    expect(await registrationOpen(tourA)).toBe(0);
  });

  it('ทัวร์ไม่มีอยู่ → 404 (ไม่ใช่ 403 — ไม่ปนกับเรื่องสิทธิ์)', async () => {
    const res = await as(orgA).post('/tournaments/999999/open-registration');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TOURNAMENT_NOT_FOUND');
  });

  it('id ไม่ใช่ตัวเลข → 400 ไม่ใช่ 500', async () => {
    const res = await as(orgA).post('/tournaments/abc/open-registration');
    expect(res.status).toBe(400);
  });
});

describe('BR-01 + BR-02 — ผู้ยื่นยังไม่เป็นผู้จัดจนกว่าจะได้รับอนุมัติ', () => {
  it.each(['pending_approval', 'rejected'] as const)('ทัวร์ของตัวเองที่ยัง %s → จัดการไม่ได้ (403)', async (status) => {
    const tour = await createTournament({ organizer: orgA.id, sportTypeId: sport, facultyId: faculty, status });
    const res = await as(orgA).post(`/tournaments/${tour}/publish`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ORGANIZER');
    expect(await statusOf(tour)).toBe(status);
  });

  it('สร้างทัวร์ผ่าน API ด้วยบัญชีธรรมดา → เกิดเป็น pending_approval ในฐาน', async () => {
    const day = 24 * 3600 * 1000;
    const iso = (d: number) => new Date(Date.now() + d * day).toISOString();
    const res = await as(orgA).post('/tournaments').send({
      name: 'ฟุตบอลคณะ', sportTypeId: sport, bracketFormat: 'single_elimination',
      scopeType: 'faculty', organizingFacultyId: faculty,
      registrationStart: iso(1), registrationEnd: iso(10),
      eventStartDate: iso(20).slice(0, 10), eventEndDate: iso(21).slice(0, 10),
      maxTeams: 16, minTeams: 4, venue: 'สนามกลาง', genderRequirement: 'any',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending_approval');
    expect(await statusOf(res.body.id)).toBe('pending_approval');
  });
});

// ───────────────────────────── อนุมัติทัวร์ — เช็คสิทธิ์ใน service ไม่ใช่ middleware ─────────────────────────────

/**
 * ★ route นี้มีแค่ requireAuth — ด่านแอดมินอยู่ใน service (getTournamentAdmin)
 *   unit test ของ controller mock service ทิ้ง ⇒ ไม่มีเทสไหนเคยพิสูจน์ว่าคำขอจริงผ่านด่านนั้น
 */
describe('POST /tournaments/:id/approve — สิทธิ์แอดมินตามขอบเขต', () => {
  let tour: number;
  beforeEach(async () => {
    tour = await createTournament({ organizer: orgA.id, sportTypeId: sport, facultyId: faculty, status: 'pending_approval' });
    await insert('tournament_eligibility_rules', { tournament_id: tour, rule_type: 'faculty', rule_value: faculty });
  });

  it('ผู้ใช้ทั่วไป (ไม่ใช่แอดมิน) → 403 · ทัวร์ยัง pending', async () => {
    const res = await as(stranger).post(`/tournaments/${tour}/approve`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ADMIN_SCOPE');
    expect(await statusOf(tour)).toBe('pending_approval');
  });

  it('ผู้ยื่นเอง (ไม่ใช่แอดมิน) อนุมัติทัวร์ตัวเองไม่ได้ → 403', async () => {
    const res = await as(orgA).post(`/tournaments/${tour}/approve`);
    expect(res.status).toBe(403);
    expect(await statusOf(tour)).toBe('pending_approval');
  });

  it('แอดมินคณะอื่น → 403 · ทัวร์ยัง pending', async () => {
    const admin = await createUser();
    await makeAdmin(admin.id, 'faculty', otherFaculty);
    const res = await as(admin).post(`/tournaments/${tour}/approve`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ADMIN_SCOPE');
    expect(await statusOf(tour)).toBe('pending_approval');
  });

  it('แอดมินคณะเดียวกัน → 200 · ฐานเป็น private พร้อมผู้อนุมัติ', async () => {
    const admin = await createUser();
    await makeAdmin(admin.id, 'faculty', faculty);
    const res = await as(admin).post(`/tournaments/${tour}/approve`);
    expect(res.status).toBe(200);
    const row = await one<{ tournament_status: string; approved_by: number }>(
      'SELECT tournament_status, approved_by FROM tournaments WHERE tournament_id = ?', [tour]);
    expect(row).toEqual({ tournament_status: 'private', approved_by: admin.id });
  });

  it('อนุมัติแล้ว ผู้ยื่นกลายเป็นผู้จัด — เปิดรับสมัครได้หลัง publish เท่านั้น (ด่านสถานะ ไม่ใช่ด่านสิทธิ์)', async () => {
    const admin = await createUser();
    await makeAdmin(admin.id, 'university_wide');
    expect((await as(admin).post(`/tournaments/${tour}/approve`)).status).toBe(200);

    const res = await as(orgA).post(`/tournaments/${tour}/open-registration`);
    expect(res.status).toBe(409);   // ผ่านด่านผู้จัดแล้ว ติดแค่ว่ายังไม่ public
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('อนุมัติซ้ำ → 409 ไม่ข้ามขั้น', async () => {
    const admin = await createUser();
    await makeAdmin(admin.id, 'university_wide');
    expect((await as(admin).post(`/tournaments/${tour}/approve`)).status).toBe(200);
    const again = await as(admin).post(`/tournaments/${tour}/approve`);
    expect(again.status).toBe(409);
  });
});
