import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { insert, one, testDb } from './helpers/db.js';
import {
  createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, makeAdmin, type TestUser,
} from './helpers/factories.js';

/**
 * วงจรชีวิตทัวร์นาเมนต์ — แก้ไข · ปิดรับสมัคร · ยกเลิกเผยแพร่ · ปิดการแข่งขัน · ลบ · กฎคุณสมบัติ · ปฏิเสธคำขอ
 *
 *   ลบ:         ได้เฉพาะก่อนเผยแพร่ และยังไม่มีใบสมัคร/แมตช์
 *   unpublish:  ต้องปิดรับสมัครก่อน
 *   complete:   ทุกแมตช์ต้องจบ — แล้ว lockCompletedTournament แช่แข็งทุก write ใต้ทัวร์/แมตช์ (ยกเว้นประกาศ/ความเห็น)
 */

let faculty: number;
let sport: number;
let organizer: TestUser;
let otherOrganizer: TestUser;
let stranger: TestUser;

beforeEach(async () => {
  faculty = await createFaculty();
  sport = await createSportType();
  organizer = await createUser();
  otherOrganizer = await createUser();
  stranger = await createUser();
  await createTournament({ organizer: otherOrganizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
});

const tourRow = (id: number) => one<{ tournament_status: string; registration_open: number; venue: string; requested_by_user_id: number; deleted_at: Date | null; max_teams: number }>(
  'SELECT tournament_status, registration_open, venue, requested_by_user_id, deleted_at, max_teams FROM tournaments WHERE tournament_id = ?', [id]);

// ───────────────────────────── แก้ไขข้อมูลทั่วไป ─────────────────────────────

describe('PATCH /tournaments/:id — แก้ได้เฉพาะข้อมูลทั่วไป', () => {
  let tour: number;
  beforeEach(async () => {
    tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  });

  it('ผู้จัดแก้สนามได้ · ผู้จัดทัวร์อื่นแก้ไม่ได้', async () => {
    expect((await as(otherOrganizer).patch(`/tournaments/${tour}`).send({ venue: 'ถูกแก้' })).status).toBe(403);
    expect((await as(organizer).patch(`/tournaments/${tour}`).send({ venue: 'สนามใหม่' })).status).toBe(200);
    expect((await tourRow(tour))!.venue).toBe('สนามใหม่');
  });

  it('🔒 ส่งฟิลด์ต้องห้ามมาด้วย (schema นี้ใช้ .passthrough()) → ไม่มีผลกับฐาน', async () => {
    const res = await as(organizer).patch(`/tournaments/${tour}`).send({
      venue: 'สนามใหม่',
      tournament_status: 'completed', tournamentStatus: 'completed', status: 'completed',
      requested_by_user_id: stranger.id, requestedByUserId: stranger.id,
      max_teams: 999, maxTeams: 999, registration_open: 1,
    });
    expect(res.status).toBe(200);
    expect(await tourRow(tour)).toMatchObject({
      venue: 'สนามใหม่', tournament_status: 'public', requested_by_user_id: organizer.id, max_teams: 16, registration_open: 0,
    });
  });
});

// ───────────────────────────── รับสมัคร / เผยแพร่ ─────────────────────────────

describe('ปิดรับสมัคร → ยกเลิกเผยแพร่', () => {
  let tour: number;
  beforeEach(async () => {
    tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public', registrationOpen: true });
  });

  it('unpublish ระหว่างเปิดรับสมัคร → 409 REGISTRATION_OPEN', async () => {
    const res = await as(organizer).post(`/tournaments/${tour}/unpublish`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REGISTRATION_OPEN');
    expect((await tourRow(tour))!.tournament_status).toBe('public');
  });

  it('ปิดรับสมัคร → unpublish ได้ → หายจากรายการสาธารณะ', async () => {
    expect((await as(otherOrganizer).post(`/tournaments/${tour}/close-registration`)).status).toBe(403);
    expect((await as(organizer).post(`/tournaments/${tour}/close-registration`)).status).toBe(200);
    expect((await tourRow(tour))!.registration_open).toBe(0);
    expect((await as(organizer).post(`/tournaments/${tour}/close-registration`)).status).toBe(409);

    expect((await as(organizer).post(`/tournaments/${tour}/unpublish`)).status).toBe(200);
    expect((await tourRow(tour))!.tournament_status).toBe('private');
    expect(JSON.stringify((await anon.get('/tournaments?pageSize=100')).body)).not.toContain(`"id":${tour},`);
  });
});

// ───────────────────────────── ปิดการแข่งขัน + ล็อก ─────────────────────────────

describe('POST /tournaments/:id/complete — แล้วทุกอย่างถูกแช่แข็ง', () => {
  let tour: number;
  let match: number;
  beforeEach(async () => {
    tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const a = await createTeam({ leader: (await createUser()).id, sportTypeId: sport });
    const b = await createTeam({ leader: (await createUser()).id, sportTypeId: sport });
    match = await createMatch({ tournamentId: tour, teamA: a, teamB: b, status: 'in_progress' });
  });

  it('ยังมีแมตช์ไม่จบ → 409 MATCHES_UNFINISHED', async () => {
    const res = await as(organizer).post(`/tournaments/${tour}/complete`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCHES_UNFINISHED');
    expect((await tourRow(tour))!.tournament_status).toBe('public');
  });

  describe('หลังปิดการแข่งขันแล้ว', () => {
    beforeEach(async () => {
      await testDb().query("UPDATE matches SET match_status = 'completed' WHERE match_id = ?", [match]);
      expect((await as(otherOrganizer).post(`/tournaments/${tour}/complete`)).status).toBe(403);
      expect((await as(organizer).post(`/tournaments/${tour}/complete`)).status).toBe(200);
      expect((await tourRow(tour))!.tournament_status).toBe('completed');
    });

    it.each([
      ['แก้ข้อมูลทัวร์', (t: number) => as(organizer).patch(`/tournaments/${t}`).send({ venue: 'แก้หลังจบ' })],
      ['เปิดรับสมัคร', (t: number) => as(organizer).post(`/tournaments/${t}/open-registration`)],
      ['ตั้งตารางแมตช์ (ทางเส้นของแมตช์)', (_t: number) => as(organizer).patch(`/matches/${match}/schedule`).send({ venue: 'x' })],
    ])('%s → 409 TOURNAMENT_COMPLETED', async (_label, request) => {
      const res = await request(tour);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TOURNAMENT_COMPLETED');
    });

    it('ยังประกาศได้ (ยกเว้นที่ตั้งใจไว้)', async () => {
      expect((await as(organizer).post(`/tournaments/${tour}/announcements`).send({ title: 'ขอบคุณ', body: 'จบแล้ว' })).status).toBe(201);
    });
  });
});

// ───────────────────────────── ลบ ─────────────────────────────

describe('DELETE /tournaments/:id — ผู้ยื่นเท่านั้น · ก่อนเผยแพร่ · ยังไม่มีกิจกรรม', () => {
  it('คำขอที่ยัง pending → ผู้ยื่นลบได้ · คนอื่นลบไม่ได้', async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'pending_approval' });
    expect((await as(stranger).delete(`/tournaments/${tour}`)).status).toBe(403);
    expect((await tourRow(tour))!.deleted_at).toBeNull();
    expect((await as(organizer).delete(`/tournaments/${tour}`)).status).toBeLessThan(300);
    expect((await tourRow(tour))!.deleted_at).not.toBeNull();
  });

  it('ทัวร์ที่เผยแพร่อยู่ → 409 TOURNAMENT_MUST_BE_UNPUBLISHED', async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const res = await as(organizer).delete(`/tournaments/${tour}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOURNAMENT_MUST_BE_UNPUBLISHED');
  });

  it('มีใบสมัครแล้ว → 409 TOURNAMENT_HAS_ACTIVITY (ทีมที่สมัครจะไม่หายไปเงียบ ๆ)', async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'private' });
    const team = await createTeam({ leader: (await createUser()).id, sportTypeId: sport });
    await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'pending' });
    const res = await as(organizer).delete(`/tournaments/${tour}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOURNAMENT_HAS_ACTIVITY');
    expect((await tourRow(tour))!.deleted_at).toBeNull();
  });
});

// ───────────────────────────── กฎคุณสมบัติ / ปฏิเสธคำขอ ─────────────────────────────

describe('กฎคุณสมบัติและการปฏิเสธคำขอ', () => {
  it('ตั้งกฎได้เฉพาะช่วง pending · ผ่านแล้วต้องยื่นแก้ไข (USE_AMENDMENT_REQUEST)', async () => {
    const pending = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'pending_approval' });
    const rules = { rules: [{ type: 'year', value: 2 }] };
    expect((await as(stranger).put(`/tournaments/${pending}/eligibility-rules`).send(rules)).status).toBe(403);
    expect((await as(organizer).put(`/tournaments/${pending}/eligibility-rules`).send(rules)).status).toBe(200);

    const approved = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'private' });
    const res = await as(organizer).put(`/tournaments/${approved}/eligibility-rules`).send(rules);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USE_AMENDMENT_REQUEST');
  });

  it('ปฏิเสธคำขอทัวร์: แอดมินคณะอื่น 403 · แอดมินในขอบเขตปฏิเสธได้ (ต้องมีเหตุผล)', async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'pending_approval' });
    const outsider = await createUser();
    await makeAdmin(outsider.id, 'faculty', await createFaculty());
    const admin = await createUser();
    await makeAdmin(admin.id, 'university_wide');

    expect((await as(outsider).post(`/tournaments/${tour}/reject`).send({ reason: 'x' })).status).toBe(403);
    expect((await as(organizer).post(`/tournaments/${tour}/reject`).send({ reason: 'x' })).status).toBe(403);
    expect((await as(admin).post(`/tournaments/${tour}/reject`).send({})).status).toBe(400);
    expect((await tourRow(tour))!.tournament_status).toBe('pending_approval');
    expect((await as(admin).post(`/tournaments/${tour}/reject`).send({ reason: 'วันชนกับสอบ' })).status).toBe(200);
    expect((await tourRow(tour))!.tournament_status).toBe('rejected');
  });
});
