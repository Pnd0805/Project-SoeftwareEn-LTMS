import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { insert, one, testDb } from './helpers/db.js';
import {
  createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, makeAdmin, type TestUser,
} from './helpers/factories.js';

/**
 * ทัวร์ที่ "จบชีวิตแล้ว" (ปิด / ยกเลิก / ระบบปิด) ต้องไม่ล็อกใครอีก — OD-69 รอบ 5 (28 ต.ค. 2569)
 *
 * 🔴 บั๊กเดิม: ใบสมัครของทัวร์ที่ปิดแล้วค้าง `approved` ตลอดไป ⇒ ด่าน "รายชื่อที่ยังมีชีวิต" นับว่ายังแข่งอยู่
 *   ⇒ หลังทีมแข่งจบสักทัวร์ หัวหน้าเอาคนที่เคยลงแข่งออกไม่ได้ · ลบทีมไม่ได้ · ลูกทีมออกเองก็ไม่ได้ — ตลอดไป
 *   (ถอนตัวก็ไม่ได้เพราะทัวร์ปิดแล้ว = ไม่มีทางออกเลย)
 *   + ผู้จัด/กรรมการของทัวร์ที่ปิดแล้ว เข้าทีมที่เคยสมัครทัวร์นั้นไม่ได้ตลอดไป
 *   + อนุมัติใบสมัคร/คำขอแก้ไข ของทัวร์ที่ปิดไปแล้วยังกดได้
 *
 * ★ สิ่งที่ต้องไม่เปลี่ยน: รายชื่อลงแข่งของทัวร์ที่จบแล้ว **ห้ามถูกลบ** (ประวัติ/สถิติอาชีพอ่านจากตารางนี้)
 *   และทัวร์ที่ยังจัดอยู่ต้องล็อกเหมือนเดิมทุกอย่าง
 */

let organizer: TestUser;
let leaderA: TestUser;
let playerA: TestUser;
let uniAdmin: TestUser;
let sport: number;
let faculty: number;
let tour: number;
let teamA: number;
let teamB: number;
let appA: number;

const setStatus = (status: string, id = tour) =>
  testDb().query('UPDATE tournaments SET tournament_status = ?, completed_at = IF(? = \'completed\', NOW(), NULL) WHERE tournament_id = ?',
    [status, status, id]);
const removePlayerA = () => as(leaderA).delete(`/teams/${teamA}/members/${playerA.id}`);
const squadRowsOf = (userId: number, tournamentId = tour) =>
  one<{ n: number }>('SELECT COUNT(*) AS n FROM application_players WHERE tournament_id = ? AND user_id = ?', [tournamentId, userId]);

beforeEach(async () => {
  faculty = await createFaculty();
  sport = await createSportType({ minMembers: 1, maxMembers: 10 });
  organizer = await createUser();
  leaderA = await createUser();
  playerA = await createUser();
  uniAdmin = await createUser();
  await makeAdmin(uniAdmin.id, 'university_wide');

  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  teamA = await createTeam({ leader: leaderA.id, sportTypeId: sport, members: [playerA.id] });
  teamB = await createTeam({ leader: (await createUser()).id, sportTypeId: sport });
  appA = await insert('tournament_applications', { tournament_id: tour, team_id: teamA, tournament_application_status: 'approved' });
  await insert('application_players', { tournament_application_id: appA, tournament_id: tour, user_id: leaderA.id });
  await insert('application_players', { tournament_application_id: appA, tournament_id: tour, user_id: playerA.id });
  const appB = await insert('tournament_applications', { tournament_id: tour, team_id: teamB, tournament_application_status: 'approved' });
  void appB;
  await createMatch({ tournamentId: tour, teamA, teamB, status: 'completed' });
});

describe('ก. ทัวร์ที่ปิดแล้วไม่ล็อกผู้เล่น/ทีมอีก — แต่ประวัติอยู่ครบ', () => {
  it('ก่อนปิด (ทัวร์ยังจัดอยู่): เอาผู้เล่นในรายชื่อออก / ลบทีม ไม่ได้ — กฎเดิมยังทำงาน', async () => {
    const res = await removePlayerA();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEMBER_LOCKED_IN_TOURNAMENT');
    const del = await as(leaderA).delete(`/teams/${teamA}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('TEAM_LOCKED_IN_TOURNAMENT');
  });

  it('หลังปิด: หัวหน้าเอาผู้เล่นออกได้ · รายชื่อลงแข่งของทัวร์นั้นยังอยู่ (ประวัติ)', async () => {
    await setStatus('completed');
    expect((await removePlayerA()).status).toBeLessThan(300);
    expect(await one('SELECT 1 AS x FROM team_members WHERE team_id = ? AND user_id = ?', [teamA, playerA.id])).toBeNull();
    expect(await squadRowsOf(playerA.id)).toEqual({ n: 1 });
  });

  it('หลังปิด: ลูกทีมออกจากทีมเองได้ · ประวัติยังอยู่', async () => {
    await setStatus('completed');
    expect((await as(playerA).delete(`/teams/${teamA}/members/me`)).status).toBeLessThan(300);
    expect(await squadRowsOf(playerA.id)).toEqual({ n: 1 });
  });

  it('หลังปิด: ลบทีมได้ · ใบสมัคร/รายชื่อยังอยู่ · หน้าแมตช์ของทัวร์ยังเห็นชื่อทีม', async () => {
    const teamName = (await one<{ name: string }>('SELECT name FROM teams WHERE team_id = ?', [teamA]))!.name;
    await setStatus('completed');
    expect((await as(leaderA).delete(`/teams/${teamA}`)).status).toBeLessThan(300);
    expect(await one(`SELECT tournament_application_status AS s FROM tournament_applications WHERE tournament_application_id = ?`, [appA]))
      .toEqual({ s: 'approved' });
    expect(await squadRowsOf(leaderA.id)).toEqual({ n: 1 });
    const matches = await anon.get(`/tournaments/${tour}/matches`);
    expect(matches.status).toBe(200);
    expect(JSON.stringify(matches.body)).toContain(teamName);
  });

  it('ทัวร์ที่ระบบปิดเอง (auto_deleted) ก็ปลดด้วย', async () => {
    await setStatus('auto_deleted');
    expect((await removePlayerA()).status).toBeLessThan(300);
  });

  it('★ ปลดเฉพาะทัวร์ที่จบ — ถ้ายังมีอีกทัวร์ที่จัดอยู่ ยังล็อกเหมือนเดิม', async () => {
    const live = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const appLive = await insert('tournament_applications', { tournament_id: live, team_id: teamA, tournament_application_status: 'approved' });
    await insert('application_players', { tournament_application_id: appLive, tournament_id: live, user_id: playerA.id });
    await setStatus('completed');

    const res = await removePlayerA();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEMBER_LOCKED_IN_TOURNAMENT');
    expect(JSON.stringify(res.body)).toContain(String(live));
    expect(JSON.stringify(res.body)).not.toContain(`"tournamentId":${tour}`);
  });

  it('ผู้จัดของทัวร์ที่ปิดแล้ว เข้าทีมที่เคยสมัครทัวร์นั้นได้ (ก่อนปิดเข้าไม่ได้)', async () => {
    const invite = () => as(leaderA).post(`/teams/${teamA}/invitations`).send({ invitedUserId: organizer.id });
    expect((await invite()).body.error?.code).toBe('TEAM_CONFLICT_OF_INTEREST');
    await setStatus('completed');
    expect((await invite()).status).toBeLessThan(300);
  });
});

describe('ข. ทัวร์ที่ปิดแล้ว — ใบสมัคร/คำขอแก้ไขที่ค้าง กดอนุมัติไม่ได้', () => {
  let appPending: number;
  let leaderC: TestUser;
  beforeEach(async () => {
    leaderC = await createUser();
    const teamC = await createTeam({ leader: leaderC.id, sportTypeId: sport });
    appPending = await insert('tournament_applications', { tournament_id: tour, team_id: teamC, tournament_application_status: 'pending' });
  });
  const statusOf = async () => (await one<{ s: string }>(
    'SELECT tournament_application_status AS s FROM tournament_applications WHERE tournament_application_id = ?', [appPending]))!.s;

  it('ก่อนปิด: ผู้จัดอนุมัติได้ตามปกติ', async () => {
    expect((await as(organizer).post(`/applications/${appPending}/approve`)).status).toBeLessThan(300);
  });

  it.each([
    ['ผู้จัดอนุมัติ', () => as(organizer).post(`/applications/${appPending}/approve`)],
    ['ผู้จัดปฏิเสธ', () => as(organizer).post(`/applications/${appPending}/reject`).send({ reason: 'ทัวร์จบแล้ว' })],
    ['หัวหน้าทีมยกเลิก', () => as(leaderC).post(`/applications/${appPending}/cancel`)],
  ])('หลังปิด: %s → 409 TOURNAMENT_COMPLETED · ใบไม่เปลี่ยน', async (_label, call) => {
    await setStatus('completed');
    const res = await call();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOURNAMENT_COMPLETED');
    expect(await statusOf()).toBe('pending');
  });

  it('หลังปิด: คนที่ไม่เกี่ยวยังได้ 403 ก่อน (ไม่บอกสถานะทัวร์)', async () => {
    await setStatus('completed');
    expect((await as(await createUser()).post(`/applications/${appPending}/approve`)).status).toBe(403);
  });

  it('คำขอแก้ไขที่ค้างตอนปิดทัวร์: แอดมินอนุมัติไม่ได้ (409) · ปฏิเสธได้', async () => {
    expect((await as(organizer).post(`/tournaments/${tour}/amendment-requests`)
      .send({ requestedChanges: { maxTeams: 20 }, reason: 'ขอเพิ่มทีม' })).status).toBe(201);
    const amendment = (await one<{ id: number }>(
      'SELECT tournament_amendment_request_id AS id FROM tournament_amendment_requests WHERE tournament_id = ?', [tour]))!.id;
    await setStatus('completed');

    const approve = await as(uniAdmin).post(`/amendment-requests/${amendment}/approve`);
    expect(approve.status).toBe(409);
    expect(approve.body.error.code).toBe('TOURNAMENT_COMPLETED');
    expect((await one<{ max_teams: number }>('SELECT max_teams FROM tournaments WHERE tournament_id = ?', [tour]))!.max_teams).toBe(16);

    expect((await as(uniAdmin).post(`/amendment-requests/${amendment}/reject`).send({ reason: 'ทัวร์จบแล้ว' })).status).toBeLessThan(300);
  });
});
