import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';

/**
 * ส่งผลการแข่งขัน POST /matches/:id/result — ใครส่งได้ขึ้นกับโหมดของแมตช์ (BR-13)
 *   onsite : กรรมการที่ถูกมอบหมายแมตช์นี้ และตอบรับแล้ว
 *   online : หัวหน้าทีมของสองทีมในแมตช์
 *
 * ★ "กรรมการ" ไม่ใช่ role ของบัญชี — ต้อง (1) active ในทัวร์นี้ (2) ได้รับแมตช์นี้ (3) ตอบรับแมตช์แล้ว
 *   unit test mock ทั้งสามชั้นนี้ทิ้ง · ที่นี่ทุกชั้นวิ่งผ่าน SQL จริง
 */

let organizer: TestUser;
let referee: TestUser;
let otherReferee: TestUser;
let leaderA: TestUser;
let leaderB: TestUser;
let outsider: TestUser;
let tour: number;
let teamA: number;
let teamB: number;
let refRow: number;
let otherRefRow: number;

beforeEach(async () => {
  const faculty = await createFaculty();
  const sport = await createSportType();
  organizer = await createUser();
  referee = await createUser();
  otherReferee = await createUser();
  leaderA = await createUser();
  leaderB = await createUser();
  outsider = await createUser();

  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  teamA = await createTeam({ leader: leaderA.id, sportTypeId: sport });
  teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport });
  refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
  otherRefRow = await addTournamentReferee({ tournamentId: tour, userId: otherReferee.id, invitedBy: organizer.id });
});

const body = () => ({ winnerTeamId: teamA, scoreData: { [teamA]: 3, [teamB]: 1 } });
const resultRow = (matchId: number) =>
  one<{ submitted_by_user_id: number; submitted_role: string; match_result_status: string }>(
    'SELECT submitted_by_user_id, submitted_role, match_result_status FROM match_results WHERE match_id = ?', [matchId]);

// ───────────────────────────── onsite ─────────────────────────────

describe('onsite — เฉพาะกรรมการที่ได้แมตช์นี้และตอบรับแล้ว', () => {
  let match: number;
  beforeEach(async () => {
    match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'onsite', status: 'finished' });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
  });

  it('กรรมการที่ได้แมตช์นี้ → 201 · ผลถูกบันทึกเป็น submitted โดยกรรมการ', async () => {
    const res = await as(referee).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(201);
    expect(await resultRow(match)).toEqual({
      submitted_by_user_id: referee.id, submitted_role: 'referee', match_result_status: 'submitted',
    });
  });

  it('กรรมการของทัวร์เดียวกัน แต่ไม่ได้แมตช์นี้ → 403 · ไม่มีผลในฐาน', async () => {
    const res = await as(otherReferee).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_SUBMITTER_ROLE');
    expect(await resultRow(match)).toBeNull();
  });

  it.each(['pending', 'declined'] as const)('ได้รับแมตช์แต่ยัง %s → 403 (ต้องตอบรับก่อน)', async (status) => {
    await assignMatchReferee({ matchId: match, tournamentRefereeId: otherRefRow, status });
    const res = await as(otherReferee).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(403);
    expect(await resultRow(match)).toBeNull();
  });

  it('กรรมการถูกถอดออกจากทัวร์แล้ว (removed_at) → 403 แม้ยังมีแถวมอบหมายแมตช์ค้างอยู่', async () => {
    await testDb().query('UPDATE tournament_referees SET removed_at = NOW() WHERE tournament_referee_id = ?', [refRow]);
    const res = await as(referee).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(403);
    expect(await resultRow(match)).toBeNull();
  });

  it('หัวหน้าทีมในแมตช์ onsite → 403 (โหมดนี้กรรมการเป็นคนส่ง)', async () => {
    const res = await as(leaderA).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_SUBMITTER_ROLE');
  });

  it('ผู้จัดทัวร์ → 403 (ผู้จัดไม่ใช่ผู้ส่งผล — ตัดสินได้เฉพาะเส้นข้อพิพาท)', async () => {
    const res = await as(organizer).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(403);
  });

  it('ไม่ล็อกอิน → 401', async () => {
    const res = await anon.post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(401);
  });

  it('แมตช์ยังไม่จบ → 409 MATCH_NOT_FINISHED แม้เป็นกรรมการตัวจริง', async () => {
    await testDb().query("UPDATE matches SET match_status = 'in_progress' WHERE match_id = ?", [match]);
    const res = await as(referee).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_NOT_FINISHED');
  });
});

// ───────────────────────────── online ─────────────────────────────

describe('online — หัวหน้าทีมของสองทีมในแมตช์', () => {
  let match: number;
  beforeEach(async () => {
    match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'online', status: 'finished' });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
  });

  it('หัวหน้าทีม A → 201 · บันทึกเป็น team_leader', async () => {
    const res = await as(leaderA).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(201);
    expect(await resultRow(match)).toMatchObject({ submitted_by_user_id: leaderA.id, submitted_role: 'team_leader' });
  });

  it('หัวหน้าทีม B ส่งได้เหมือนกัน', async () => {
    const res = await as(leaderB).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(201);
  });

  it('สมาชิกทีมที่ไม่ใช่หัวหน้า → 403', async () => {
    const member = await createUser();
    await testDb().query('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)', [teamA, member.id]);
    const res = await as(member).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(403);
    expect(await resultRow(match)).toBeNull();
  });

  it('หัวหน้าทีมอื่นที่ไม่ได้อยู่ในแมตช์นี้ → 403', async () => {
    const sport = (await one<{ sport_type_id: number }>('SELECT sport_type_id FROM teams WHERE team_id = ?', [teamA]))!.sport_type_id;
    await createTeam({ leader: outsider.id, sportTypeId: sport });
    const res = await as(outsider).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(403);
  });

  it('กรรมการของแมตช์ online ก่อนถึงเวลา escalation → 403 (ทีมเป็นคนส่งก่อน)', async () => {
    const res = await as(referee).post(`/matches/${match}/result`).send(body());
    expect(res.status).toBe(403);
    expect(await resultRow(match)).toBeNull();
  });
});

// ───────────────────────────── ข้อมูลที่ส่งมา ─────────────────────────────

describe('ผลที่ส่งมาไม่สอดคล้องกับแมตช์ → 400 ก่อนเขียนฐาน', () => {
  let match: number;
  beforeEach(async () => {
    match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'onsite', status: 'finished' });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
  });

  it.each([
    ['ผู้ชนะแต้มน้อยกว่า', () => ({ winnerTeamId: teamA, scoreData: { [teamA]: 1, [teamB]: 3 } })],
    ['เสมอ', () => ({ winnerTeamId: teamA, scoreData: { [teamA]: 2, [teamB]: 2 } })],
    ['ผู้ชนะไม่ใช่ทีมในแมตช์', () => ({ winnerTeamId: 999999, scoreData: { [teamA]: 3, [teamB]: 1 } })],
    ['key สกอร์ไม่ใช่สองทีมนี้', () => ({ winnerTeamId: teamA, scoreData: { a: 3, b: 1 } })],
    ['คะแนนติดลบ', () => ({ winnerTeamId: teamA, scoreData: { [teamA]: 3, [teamB]: -1 } })],
    ['ไม่ส่ง body', () => ({})],
  ])('%s → 400 · ไม่มีผลในฐาน', async (_label, make) => {
    const res = await as(referee).post(`/matches/${match}/result`).send(make());
    expect(res.status).toBe(400);
    expect(await resultRow(match)).toBeNull();
  });
});
