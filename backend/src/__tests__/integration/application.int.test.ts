import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, createFaculty, createSportType, createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';

/**
 * สมัครเข้าร่วมทัวร์ · อนุมัติ/ปฏิเสธใบสมัคร
 *
 * ★ approve / reject / cancel / withdraw มีแค่ requireAuth ที่ route — ด่านสิทธิ์ทั้งหมดอยู่ใน service
 *   ⇒ unit test ของ controller mock service ทิ้ง ไม่เคยพิสูจน์ว่าคำขอจริงถูกกันไว้ ไฟล์นี้พิสูจน์
 * ★ BR-08 (Hard Filter) · BR-09 (สมัครด้วยทีมเท่านั้น) · BR-04 (ทีมต้อง Ready) ผ่าน API จริง
 */

let faculty: number;
let otherFaculty: number;
let sport: number;              // ส่งลงแข่ง 2-4 คน
let organizer: TestUser;
let leader: TestUser;
let p1: TestUser;
let p2: TestUser;
let team: number;
let tour: number;

beforeEach(async () => {
  faculty = await createFaculty();
  otherFaculty = await createFaculty();
  sport = await createSportType({ minMembers: 2, maxMembers: 4 });
  organizer = await createUser();
  leader = await createUser({ facultyId: faculty, year: 2 });
  p1 = await createUser({ facultyId: faculty, year: 2 });
  p2 = await createUser({ facultyId: faculty, year: 3 });
  team = await createTeam({ leader: leader.id, sportTypeId: sport, members: [p1.id, p2.id] });
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public', registrationOpen: true });
});

const apply = (who: TestUser, body: Record<string, unknown>, tournamentId = tour) =>
  as(who).post(`/tournaments/${tournamentId}/applications`).send(body);
const squad = () => ({ teamId: team, playerIds: [leader.id, p1.id] });
const applicationOf = (teamId: number, tournamentId = tour) =>
  one<{ tournament_application_id: number; tournament_application_status: string }>(
    'SELECT tournament_application_id, tournament_application_status FROM tournament_applications WHERE team_id = ? AND tournament_id = ?',
    [teamId, tournamentId]);

// ───────────────────────────── ยื่นใบสมัคร ─────────────────────────────

describe('POST /tournaments/:id/applications — ใครยื่นได้', () => {
  it('หัวหน้าทีม · ทีม Ready · รายชื่อผ่านเงื่อนไข → 201 · ใบสมัคร pending + รายชื่อผู้เล่นในฐาน', async () => {
    const res = await apply(leader, squad());
    expect(res.status).toBe(201);
    const app = await applicationOf(team);
    expect(app!.tournament_application_status).toBe('pending');
    const players = await all<{ user_id: number }>(
      'SELECT user_id FROM application_players WHERE tournament_application_id = ? ORDER BY user_id', [app!.tournament_application_id]);
    expect(players.map(p => p.user_id).sort()).toEqual([leader.id, p1.id].sort());
  });

  it('สมาชิกทีมที่ไม่ใช่หัวหน้า → 403 NOT_TEAM_LEADER · ไม่มีใบสมัคร', async () => {
    const res = await apply(p1, squad());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_TEAM_LEADER');
    expect(await applicationOf(team)).toBeNull();
  });

  it('ไม่ล็อกอิน → 401', async () => {
    expect((await anon.post(`/tournaments/${tour}/applications`).send(squad())).status).toBe(401);
    expect(await applicationOf(team)).toBeNull();
  });

  it('BR-09: ไม่ระบุทีม (สมัครรายบุคคล) → 400 ที่ schema', async () => {
    const res = await apply(leader, { playerIds: [leader.id] });
    expect(res.status).toBe(400);
  });

  it('BR-04: ทีมยัง Forming → 409 TEAM_NOT_READY', async () => {
    await testDb().query("UPDATE teams SET readiness_status = 'Forming' WHERE team_id = ?", [team]);
    const res = await apply(leader, squad());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_NOT_READY');
    expect(await applicationOf(team)).toBeNull();
  });

  it.each([
    ['ธงยังไม่เปิด', 'UPDATE tournaments SET registration_open = 0 WHERE tournament_id = ?'],
    ['หมดช่วงรับสมัคร', 'UPDATE tournaments SET registration_end = NOW() - INTERVAL 1 HOUR WHERE tournament_id = ?'],
    ['ยังไม่ถึงช่วงรับสมัคร', 'UPDATE tournaments SET registration_start = NOW() + INTERVAL 1 DAY WHERE tournament_id = ?'],
  ])('ไม่อยู่ในช่วงรับสมัคร (%s) → 409 REGISTRATION_CLOSED', async (_label, sql) => {
    await testDb().query(sql, [tour]);
    const res = await apply(leader, squad());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REGISTRATION_CLOSED');
  });

  it('ทีมคนละกีฬากับทัวร์ → 409 SPORT_TYPE_MISMATCH', async () => {
    const otherSport = await createSportType({ minMembers: 2, maxMembers: 4 });
    const otherTour = await createTournament({ organizer: organizer.id, sportTypeId: otherSport, facultyId: faculty, status: 'public', registrationOpen: true });
    const res = await apply(leader, squad(), otherTour);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SPORT_TYPE_MISMATCH');
  });

  it('สมัครซ้ำ → 409 ALREADY_APPLIED · มีใบเดียว', async () => {
    expect((await apply(leader, squad())).status).toBe(201);
    const again = await apply(leader, squad());
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_APPLIED');
    expect(await all('SELECT 1 FROM tournament_applications WHERE team_id = ?', [team])).toHaveLength(1);
  });

  it('ส่งรายชื่อคนที่ไม่ได้อยู่ในทีม → 422 PLAYER_NOT_IN_TEAM', async () => {
    const outsider = await createUser({ facultyId: faculty });
    const res = await apply(leader, { teamId: team, playerIds: [leader.id, outsider.id] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PLAYER_NOT_IN_TEAM');
  });

  it('จำนวนผู้เล่นต่ำกว่าขั้นต่ำของกีฬา → 422 SQUAD_SIZE_INVALID', async () => {
    const res = await apply(leader, { teamId: team, playerIds: [leader.id] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SQUAD_SIZE_INVALID');
  });

  it('ผู้จัดของทัวร์นี้อยู่ในทีม → 409 TEAM_CONFLICT_OF_INTEREST (แม้ไม่ได้ส่งลงแข่ง)', async () => {
    await testDb().query('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)', [team, organizer.id]);
    const res = await apply(leader, squad());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_CONFLICT_OF_INTEREST');
  });

  it('กรรมการของทัวร์นี้อยู่ในทีม → 409 TEAM_CONFLICT_OF_INTEREST', async () => {
    await addTournamentReferee({ tournamentId: tour, userId: p2.id, invitedBy: organizer.id });
    const res = await apply(leader, squad());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_CONFLICT_OF_INTEREST');
  });
});

// ───────────────────────────── BR-08 Hard Filter ─────────────────────────────

describe('BR-08 Hard Filter — ตรวจอัตโนมัติรายบุคคล ผ่าน API จริง', () => {
  const failReasons = (body: { error: { details?: { userId: number; reason: string }[] } }) =>
    (body.error.details ?? []).map(d => d.reason);

  it('เพศ: ทัวร์หญิงล้วน · ส่งผู้ชายลงแข่ง → 422 reason gender', async () => {
    await testDb().query("UPDATE tournaments SET gender_requirement = 'female' WHERE tournament_id = ?", [tour]);
    const res = await apply(leader, squad());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('HARD_FILTER_FAILED');
    expect(failReasons(res.body)).toContain('gender');
    expect(await applicationOf(team)).toBeNull();
  });

  it('อายุ: เกินอายุสูงสุด (คำนวณ ณ วันปิดรับสมัคร) → 422 reason age', async () => {
    await testDb().query('UPDATE tournaments SET max_age = 18 WHERE tournament_id = ?', [tour]);
    const res = await apply(leader, squad());   // เกิด 2004 ⇒ อายุ 22
    expect(res.status).toBe(422);
    expect(failReasons(res.body)).toContain('age');
  });

  it('ชั้นปี: ทัวร์รับเฉพาะปี 2 · ส่งคนปี 3 → 422 reason year เฉพาะคนนั้น', async () => {
    await insert('tournament_eligibility_rules', { tournament_id: tour, rule_type: 'year', rule_value: 2 });
    const res = await apply(leader, { teamId: team, playerIds: [leader.id, p2.id] });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([expect.objectContaining({ userId: p2.id, reason: 'year' })]);
  });

  it('คณะ: ทัวร์รับเฉพาะคณะ A · ส่งคนคณะ B → 422 reason faculty', async () => {
    await insert('tournament_eligibility_rules', { tournament_id: tour, rule_type: 'faculty', rule_value: faculty });
    await testDb().query('UPDATE users SET faculty_id = ? WHERE user_id = ?', [otherFaculty, p1.id]);
    const res = await apply(leader, squad());
    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual([expect.objectContaining({ userId: p1.id, reason: 'faculty' })]);
  });

  it('ตรวจเฉพาะคนที่ส่งลงแข่ง — สมาชิกที่ไม่ผ่านแต่ไม่ได้ลงแข่ง ไม่ทำให้ทีมสมัครไม่ได้', async () => {
    await insert('tournament_eligibility_rules', { tournament_id: tour, rule_type: 'year', rule_value: 2 });
    const res = await apply(leader, squad());   // leader กับ p1 ปี 2 · p2 ปี 3 อยู่ในทีมแต่ไม่ได้ส่ง
    expect(res.status).toBe(201);
  });

  it('ผ่านทุกเงื่อนไขพร้อมกัน → 201', async () => {
    await testDb().query("UPDATE tournaments SET gender_requirement = 'male', min_age = 18, max_age = 30 WHERE tournament_id = ?", [tour]);
    await insert('tournament_eligibility_rules', { tournament_id: tour, rule_type: 'year', rule_value: 2 });
    await insert('tournament_eligibility_rules', { tournament_id: tour, rule_type: 'faculty', rule_value: faculty });
    expect((await apply(leader, squad())).status).toBe(201);
  });
});

// ───────────────────────────── ตัดสินใบสมัคร ─────────────────────────────

describe('อนุมัติ/ปฏิเสธ/ยกเลิกใบสมัคร — ด่านสิทธิ์อยู่ใน service', () => {
  let appId: number;
  beforeEach(async () => {
    expect((await apply(leader, squad())).status).toBe(201);
    appId = (await applicationOf(team))!.tournament_application_id;
  });

  it('ผู้จัดของทัวร์นี้อนุมัติ → 200 · approved ในฐาน', async () => {
    const res = await as(organizer).post(`/applications/${appId}/approve`);
    expect(res.status).toBe(200);
    expect((await applicationOf(team))!.tournament_application_status).toBe('approved');
  });

  it.each([
    ['หัวหน้าทีมที่ยื่นเอง', () => leader],
    ['สมาชิกทีม', () => p1],
  ])('%s อนุมัติใบของตัวเอง → 403 NOT_ORGANIZER · ยัง pending', async (_label, who) => {
    const res = await as(who()).post(`/applications/${appId}/approve`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ORGANIZER');
    expect((await applicationOf(team))!.tournament_application_status).toBe('pending');
  });

  it('ผู้จัดของ "ทัวร์อื่น" → 403 · ยัง pending', async () => {
    const otherOrg = await createUser();
    await createTournament({ organizer: otherOrg.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const res = await as(otherOrg).post(`/applications/${appId}/approve`);
    expect(res.status).toBe(403);
    expect((await applicationOf(team))!.tournament_application_status).toBe('pending');
  });

  it('ปฏิเสธต้องมีเหตุผล → 400 APPLICATION_REJECT_REASON_REQUIRED', async () => {
    const res = await as(organizer).post(`/applications/${appId}/reject`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('APPLICATION_REJECT_REASON_REQUIRED');
    expect((await applicationOf(team))!.tournament_application_status).toBe('pending');
  });

  it('ผู้จัดปฏิเสธพร้อมเหตุผล → rejected · เก็บเหตุผล · ปลดรายชื่อผู้เล่น', async () => {
    const res = await as(organizer).post(`/applications/${appId}/reject`).send({ reason: 'เอกสารไม่ครบ' });
    expect(res.status).toBe(200);
    expect(await one('SELECT tournament_application_status AS s, rejection_reason AS r FROM tournament_applications WHERE tournament_application_id = ?', [appId]))
      .toEqual({ s: 'rejected', r: 'เอกสารไม่ครบ' });
    expect(await all('SELECT 1 FROM application_players WHERE tournament_application_id = ?', [appId])).toHaveLength(0);
  });

  it('ตัดสินซ้ำ → 409 ALREADY_DECIDED', async () => {
    expect((await as(organizer).post(`/applications/${appId}/approve`)).status).toBe(200);
    const again = await as(organizer).post(`/applications/${appId}/reject`).send({ reason: 'เปลี่ยนใจ' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_DECIDED');
  });

  it('ยกเลิกใบสมัครได้เฉพาะหัวหน้าทีม — ผู้จัดยกเลิกแทนไม่ได้', async () => {
    expect((await as(organizer).post(`/applications/${appId}/cancel`)).status).toBe(403);
    expect((await applicationOf(team))!.tournament_application_status).toBe('pending');
    expect((await as(leader).post(`/applications/${appId}/cancel`)).status).toBe(200);
    expect((await applicationOf(team))!.tournament_application_status).toBe('cancelled');
  });

  it('ใบสมัครไม่มีอยู่ → 404', async () => {
    expect((await as(organizer).post('/applications/999999/approve')).status).toBe(404);
  });

  /**
   * 🆕 BE-03 (7 ต.ค. 2569) — อนุมัติเกินโควตา `max_teams` ไม่ได้
   *
   * QA: ทัวร์ maxTeams 4 อนุมัติครบ 5 ใบได้ แล้วจับสายออกมา 4 แมตช์สำหรับ 5 ทีม
   * ⇒ ทีมที่เกินมาไม่มีที่ยืนในสาย และไม่มีใครรู้จนถึงวันแข่ง
   *
   * ★ ต้องเป็นเทส integration — ด่านอยู่ในทรานแซกชันของ repo (นับ + เขียนภายใต้ `FOR UPDATE`)
   *   เทสที่ mock repo จะตรึงได้แค่ว่า service แปลคำตอบถูก ไม่ได้ตรึงว่าโควตาทำงานจริง
   */
  describe('โควตาทัวร์ (BE-03)', () => {
    it('อนุมัติใบที่ทำให้เกิน maxTeams → 409 TOURNAMENT_FULL · ใบนั้นยัง pending', async () => {
      // ทัวร์ที่รับได้ทีมเดียว
      const small = await createTournament({
        organizer: organizer.id, sportTypeId: sport, facultyId: faculty,
        status: 'public', registrationOpen: true, minTeams: 1, maxTeams: 1 });

      const leaderB = await createUser({ facultyId: faculty, year: 2 });
      const pB = await createUser({ facultyId: faculty, year: 2 });
      const teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport, members: [pB.id] });

      expect((await apply(leader, squad(), small)).status).toBe(201);
      expect((await apply(leaderB, { teamId: teamB, playerIds: [leaderB.id, pB.id] }, small)).status).toBe(201);

      const first = (await applicationOf(team, small))!.tournament_application_id;
      const second = (await applicationOf(teamB, small))!.tournament_application_id;

      expect((await as(organizer).post(`/applications/${first}/approve`)).status).toBe(200);

      const full = await as(organizer).post(`/applications/${second}/approve`);
      expect(full.status).toBe(409);
      expect(full.body.error.code).toBe('TOURNAMENT_FULL');
      expect(full.body.error.maxTeams ?? full.body.error.extra?.maxTeams).toBe(1);

      // ★ สำคัญกว่า status code: ฐานต้องไม่มีทีมเกินโควตา
      expect((await applicationOf(teamB, small))!.tournament_application_status).toBe('pending');
      expect(await all('SELECT 1 FROM tournament_applications WHERE tournament_id = ? AND tournament_application_status = ?', [small, 'approved']))
        .toHaveLength(1);
    });

    /**
     * ★ เคสที่ด่านแบบ "เช็คใน service แล้วเขียนทีหลัง" จะหลุด — กดอนุมัติสองใบ**พร้อมกัน**
     *   ทั้งสองคำขอจะนับได้ 0 (ยังไม่เกิน 1) แล้วเขียนทั้งคู่ ⇒ ได้ 2 ทีมทั้งที่มีด่าน
     *   เทสนี้คือเหตุผลที่ด่านต้องอยู่ในทรานแซกชันพร้อม FOR UPDATE
     */
    it('กดอนุมัติสองใบพร้อมกัน → ผ่านได้ใบเดียว', async () => {
      const small = await createTournament({
        organizer: organizer.id, sportTypeId: sport, facultyId: faculty,
        status: 'public', registrationOpen: true, minTeams: 1, maxTeams: 1 });

      const leaderB = await createUser({ facultyId: faculty, year: 2 });
      const pB = await createUser({ facultyId: faculty, year: 2 });
      const teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport, members: [pB.id] });

      expect((await apply(leader, squad(), small)).status).toBe(201);
      expect((await apply(leaderB, { teamId: teamB, playerIds: [leaderB.id, pB.id] }, small)).status).toBe(201);

      const first = (await applicationOf(team, small))!.tournament_application_id;
      const second = (await applicationOf(teamB, small))!.tournament_application_id;

      const [a, b] = await Promise.all([
        as(organizer).post(`/applications/${first}/approve`),
        as(organizer).post(`/applications/${second}/approve`),
      ]);

      expect([a!.status, b!.status].sort()).toEqual([200, 409]);
      expect(await all('SELECT 1 FROM tournament_applications WHERE tournament_id = ? AND tournament_application_status = ?', [small, 'approved']))
        .toHaveLength(1);
    });
  });

  it('รายการใบสมัครของทัวร์ ดูได้เฉพาะผู้จัด', async () => {
    expect((await as(leader).get(`/tournaments/${tour}/applications`)).status).toBe(403);
    expect((await as(organizer).get(`/tournaments/${tour}/applications`)).status).toBe(200);
  });
});
