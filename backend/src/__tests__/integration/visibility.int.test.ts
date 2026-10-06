import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, makeAdmin, type TestUser,
} from './helpers/factories.js';

/**
 * ใครมองเห็นอะไร — ทัวร์ที่ยังไม่เผยแพร่ · รหัสห้องออนไลน์ · คิวงานแอดมิน · กรรมการภายนอก
 *
 * ★ กติกาที่โค้ดตั้งใจไว้ (getVisibleTournament): ทัวร์ที่ไม่ใช่ public/completed เห็นได้เฉพาะ
 *   ผู้ยื่น · แอดมินที่ครอบขอบเขต · กรรมการที่ถูกเชิญ — คนอื่นได้ 404 เหมือนไม่มีทัวร์นี้
 */

let faculty: number;
let otherFaculty: number;
let sport: number;
let organizer: TestUser;
let stranger: TestUser;

beforeEach(async () => {
  faculty = await createFaculty();
  otherFaculty = await createFaculty();
  sport = await createSportType();
  organizer = await createUser();
  stranger = await createUser();
});

// ───────────────────────────── ทัวร์ที่ยังไม่เผยแพร่ ─────────────────────────────

describe('ทัวร์ private / pending_approval — หน้าหลักเห็นเฉพาะคนที่เกี่ยวข้อง', () => {
  let tour: number;
  beforeEach(async () => {
    tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'private', name: 'ทัวร์ยังไม่เปิดตัว' });
  });

  it.each([
    ['ไม่ล็อกอิน', () => anon.get(`/tournaments/${tour}`)],
    ['คนนอก', () => as(stranger).get(`/tournaments/${tour}`)],
  ])('%s → 404 เหมือนไม่มีทัวร์นี้ (ไม่ใช่ 403)', async (_label, request) => {
    const res = await request();
    expect(res.status).toBe(404);
    expect(res.body).toEqual((await anon.get('/tournaments/999999')).body);
  });

  it('ผู้จัด · แอดมินคณะเดียวกัน · กรรมการที่ถูกเชิญ → เห็น', async () => {
    const facAdmin = await createUser();
    await makeAdmin(facAdmin.id, 'faculty', faculty);
    const invited = await createUser();
    await addTournamentReferee({ tournamentId: tour, userId: invited.id, invitedBy: organizer.id, invitationStatus: 'pending' });
    for (const who of [organizer, facAdmin, invited]) {
      expect((await as(who).get(`/tournaments/${tour}`)).status).toBe(200);
    }
  });

  it('แอดมินคณะอื่น → 404', async () => {
    const admin = await createUser();
    await makeAdmin(admin.id, 'faculty', otherFaculty);
    expect((await as(admin).get(`/tournaments/${tour}`)).status).toBe(404);
  });

  it('กรรมการที่ถูกถอดแล้ว → 404 (หมดสิทธิ์อ่าน)', async () => {
    const ex = await createUser();
    const row = await addTournamentReferee({ tournamentId: tour, userId: ex.id, invitedBy: organizer.id });
    await testDb().query('UPDATE tournament_referees SET removed_at = NOW() WHERE tournament_referee_id = ?', [row]);
    expect((await as(ex).get(`/tournaments/${tour}`)).status).toBe(404);
  });

  it('รายการทัวร์สาธารณะไม่มีทัวร์นี้', async () => {
    const res = await anon.get('/tournaments?pageSize=100');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('ทัวร์ยังไม่เปิดตัว');
  });

  it.each(['private', 'pending_approval', 'rejected'])('🔒 ขอรายการด้วย ?status=%s → 400 (รับแค่ public/completed)', async (status) => {
    const res = await anon.get(`/tournaments?status=${status}`);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('ทัวร์ยังไม่เปิดตัว');
  });

  /**
   * 🐞 ข้อมูลรั่ว (integration test เจอ 6 ต.ค.) — ยังไม่ได้แก้ production
   *   หน้าหลัก/กฎคุณสมบัติ/คอมเมนต์ ตอบ 404 กับทัวร์ที่ยังไม่เผยแพร่ (getVisibleTournament)
   *   แต่ endpoint ข้างเคียงไม่ได้ผ่านด่านเดียวกัน ⇒ คนไม่ล็อกอินอ่านได้:
   *     GET /tournaments/:id/matches   — คู่แข่งขัน ชื่อทีม
   *     GET /matches/:id               — รายละเอียดแมตช์ ชื่อทีม
   *     GET /tournaments/:id/teams     — ทีมที่ผ่านการอนุมัติ
   *     (bracket · standings · announcements ตอบ 200 ด้วย — อย่างน้อยบอกว่าทัวร์นี้มีอยู่จริง)
   *   กรณีจริง: ผู้จัดได้รับอนุมัติแล้ว (private) จับสายไว้ก่อนเผยแพร่ ⇒ คู่แข่งขันหลุดก่อนเปิดตัว
   * ทางแก้ที่เสนอ: ให้ endpoint เหล่านี้เรียก getVisibleTournament (หรือเทียบเท่า) ก่อนอ่านข้อมูล
   * ★ it.fails = ผ่านตราบที่ยังรั่ว · แก้แล้วจะแดง ⇒ เปลี่ยนเป็น it ธรรมดา
   */
  describe('🐞 endpoint ข้างเคียงยังเปิดข้อมูลของทัวร์ที่ยังไม่เผยแพร่', () => {
    let match: number;
    beforeEach(async () => {
      const a = await createTeam({ leader: (await createUser()).id, sportTypeId: sport, name: 'ทีมลับ A' });
      const b = await createTeam({ leader: (await createUser()).id, sportTypeId: sport, name: 'ทีมลับ B' });
      await insert('tournament_applications', { tournament_id: tour, team_id: a, tournament_application_status: 'approved' });
      match = await createMatch({ tournamentId: tour, teamA: a, teamB: b });
    });

    it.fails('🐞 GET /tournaments/:id/matches → ควรเป็น 404 (ตอนนี้ได้ 200 พร้อมชื่อทีม)', async () => {
      const res = await anon.get(`/tournaments/${tour}/matches`);
      expect(res.status).toBe(404);
    });

    it.fails('🐞 GET /matches/:id → ควรเป็น 404 (ตอนนี้ได้ 200 พร้อมชื่อทีม)', async () => {
      const res = await anon.get(`/matches/${match}`);
      expect(res.status).toBe(404);
    });

    it.fails('🐞 GET /tournaments/:id/teams → ควรเป็น 404 (ตอนนี้ได้ 200 พร้อมชื่อทีม)', async () => {
      const res = await anon.get(`/tournaments/${tour}/teams`);
      expect(res.status).toBe(404);
    });
  });
});

// ───────────────────────────── รหัสห้องออนไลน์ ─────────────────────────────

describe('รหัสห้อง (online) — เห็นเฉพาะทีมงานและผู้เล่นในรายชื่อ', () => {
  it('กรรมการ · ผู้จัด · ผู้เล่นในรายชื่อเห็น · คนนอก/ไม่ล็อกอิน/สมาชิกทีมที่ไม่ได้ลงแข่งไม่เห็น', async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const player = await createUser();
    const bench = await createUser();
    const referee = await createUser();
    const teamA = await createTeam({ leader: player.id, sportTypeId: sport, members: [bench.id] });
    const teamB = await createTeam({ leader: (await createUser()).id, sportTypeId: sport });
    const app = await insert('tournament_applications', { tournament_id: tour, team_id: teamA, tournament_application_status: 'approved' });
    await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: player.id });
    const match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'online' });
    await testDb().query("UPDATE matches SET room_code = 'ROOM-SECRET-7' WHERE match_id = ?", [match]);
    const refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });

    const sees = async (request: () => Promise<{ status: number; body: unknown }>) => {
      const res = await request();
      expect(res.status).toBe(200);
      return JSON.stringify(res.body).includes('ROOM-SECRET-7');
    };
    expect(await sees(() => as(referee).get(`/matches/${match}`))).toBe(true);
    expect(await sees(() => as(organizer).get(`/matches/${match}`))).toBe(true);
    expect(await sees(() => as(player).get(`/matches/${match}`))).toBe(true);
    expect(await sees(() => as(bench).get(`/matches/${match}`))).toBe(false);
    expect(await sees(() => as(stranger).get(`/matches/${match}`))).toBe(false);
    expect(await sees(() => anon.get(`/matches/${match}`))).toBe(false);
  });
});

// ───────────────────────────── คิวงานแอดมิน ─────────────────────────────

describe('คิวคำขอทัวร์ของแอดมิน — เห็นตามขอบเขต', () => {
  beforeEach(async () => {
    await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'pending_approval', name: 'คำขอคณะ A' });
    await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: otherFaculty, status: 'pending_approval', name: 'คำขอคณะ B' });
  });

  it('ผู้ใช้ทั่วไป → 403', async () => {
    expect((await as(stranger).get('/admin/tournament-requests')).status).toBe(403);
    expect((await as(stranger).get('/admin/amendment-requests')).status).toBe(403);
  });

  it('แอดมินคณะ A เห็นเฉพาะคำขอของคณะ A', async () => {
    const admin = await createUser();
    await makeAdmin(admin.id, 'faculty', faculty);
    const text = JSON.stringify((await as(admin).get('/admin/tournament-requests?pageSize=100')).body);
    expect(text).toContain('คำขอคณะ A');
    expect(text).not.toContain('คำขอคณะ B');
  });

  it('แอดมินมหาวิทยาลัยเห็นทุกคณะ', async () => {
    const admin = await createUser();
    await makeAdmin(admin.id, 'university_wide');
    const text = JSON.stringify((await as(admin).get('/admin/tournament-requests?pageSize=100')).body);
    expect(text).toContain('คำขอคณะ A');
    expect(text).toContain('คำขอคณะ B');
  });
});

// ───────────────────────────── กรรมการภายนอก ─────────────────────────────

describe('กรรมการภายนอก — ต้องผ่านการยืนยันตัวตนจากแอดมินมหาวิทยาลัยก่อนทำหน้าที่', () => {
  let external: TestUser;
  let match: number;
  let teamA: number;
  let teamB: number;
  beforeEach(async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    external = await createUser({ userType: 'external' });
    teamA = await createTeam({ leader: (await createUser()).id, sportTypeId: sport });
    teamB = await createTeam({ leader: (await createUser()).id, sportTypeId: sport });
    match = await createMatch({ tournamentId: tour, teamA, teamB, status: 'finished' });
    // 🔴 มติ 6 ต.ค. 2569 (ทางเลือก ข) — แอดมินอนุมัติคนที่ยังไม่ส่งเอกสารไม่ได้ (409 DOCS_NOT_SUBMITTED)
    //   ⇒ fixture ต้องมีเอกสารแล้ว ไม่งั้นเทส "อนุมัติ → ส่งผลได้" จะติดด่านใหม่ ไม่ใช่ติดเรื่องที่ทดสอบ
    //   ไม่ใช่การลดความเข้มของเทส — เคส "ไม่มีเอกสารแล้วอนุมัติ" มีเทสของตัวเองข้างล่าง
    const row = await insert('tournament_referees', {
      tournament_id: tour, user_id: external.id, invited_by: organizer.id,
      invitation_status: 'accepted', is_external: 1, external_approval_status: 'pending',
      external_verification_docs: JSON.stringify(['referee_identity/doc-1.jpg']),
    });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: row });
  });
  const submit = () => as(external).post(`/matches/${match}/result`).send({ winnerTeamId: teamA, scoreData: { [teamA]: 2, [teamB]: 0 } });
  const approvalOf = async () => (await one<{ s: string }>(
    'SELECT external_approval_status AS s FROM tournament_referees WHERE user_id = ?', [external.id]))!.s;

  it('ยังไม่ผ่านการยืนยัน → ส่งผลไม่ได้ (403)', async () => {
    expect((await submit()).status).toBe(403);
  });

  it.each([
    ['แอดมินคณะ', 'faculty'],
    ['ผู้จัด', null],
  ] as const)('%s อนุมัติตัวตน → 403 · ยัง pending', async (_label, scope) => {
    const who = scope ? await createUser() : organizer;
    if (scope) await makeAdmin(who.id, scope, faculty);
    expect((await as(who).post(`/admin/referee-requests/${external.id}/approve`)).status).toBe(403);
    expect(await approvalOf()).toBe('pending');
  });

  /** มติ 6 ต.ค. 2569 (ทางเลือก ข) — ไม่มีเอกสาร = อนุมัติไม่ได้ ต้องรอ/ทวงเอกสารก่อน */
  it('ยังไม่ส่งเอกสาร → แอดมินมหาวิทยาลัยอนุมัติไม่ได้ (409) · ยัง pending', async () => {
    await testDb().query('UPDATE tournament_referees SET external_verification_docs = NULL WHERE user_id = ?', [external.id]);
    const admin = await createUser();
    await makeAdmin(admin.id, 'university_wide');

    const res = await as(admin).post(`/admin/referee-requests/${external.id}/approve`);

    expect(res.status).toBe(409);
    expect(await approvalOf()).toBe('pending');
    expect((await submit()).status).toBe(403);   // ★ ยังส่งผลไม่ได้ ด่านเดิมยังทำงาน
  });

  it('แอดมินมหาวิทยาลัยอนุมัติ → approved · แล้วส่งผลแมตช์ที่ได้รับมอบหมายได้ทันที', async () => {
    const admin = await createUser();
    await makeAdmin(admin.id, 'university_wide');
    expect((await as(admin).post(`/admin/referee-requests/${external.id}/approve`)).status).toBe(200);
    expect(await approvalOf()).toBe('approved');
    expect((await submit()).status).toBe(201);
  });
});
