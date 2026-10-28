import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType, createTeam, createTournament,
  createUser, makeAdmin, type TestUser,
} from './helpers/factories.js';

/**
 * ยกเลิกทัวร์ — ผลกระทบลูกโซ่ต่อ "ส่วนอื่นของระบบ" (OD-69 · ตรวจ 28 ต.ค. 2569)
 *
 * ยกเลิกแล้วแมตช์ถูก "แช่แข็ง" ค้างสถานะเดิม (scheduled ฯลฯ) ⇒ คิวรีที่มองหา "แมตช์ที่ยังไม่จบ"
 * จะเห็นมันเป็นของจริงตลอดไป ถ้าไม่ตัดออก จะเกิดบั๊กในที่ที่ไม่เกี่ยวกับทัวร์นั้นเลย:
 *   ① หน้างานค้างของแอดมิน      — แมตช์พิพาทที่ไม่มีใครแก้ได้ ค้างอยู่ตลอดไป
 *   ② กรรมการ                    — รับแมตช์ทัวร์อื่นเวลาเดียวกันไม่ได้ (ชนกับงานที่ไม่มีวันเกิด)
 *   ③ ผู้จัดทัวร์อื่น               — จัดตารางสนาม/เวลาเดียวกันไม่ได้
 *   ④ ขอโอน/แลกแมตช์กรรมการ     — ยื่นได้ แจ้งอีกคน แล้วไปติดตอนตอบ
 *   ⑤ หน้าแมตช์ของฉัน             — โชว์แมตช์ที่ถูกแช่แข็งเป็น "กำลังจะแข่ง" ตลอดไป
 *   ⑥ กล่องคำเชิญกรรมการ          — ขึ้นคำเชิญที่กดรับไม่ได้
 *   ⑦ กู้คืน                       — ทีม/ผู้เล่นที่เปลี่ยนไประหว่างถูกยกเลิก ต้องถูกรายงาน (มติ 28 ต.ค.)
 * ทุกข้อพิสูจน์สองทาง: "ก่อนยกเลิกยังเป็นแบบเดิม" และ "หลังยกเลิกถูกตัดออก" (+ กู้คืนแล้วกลับมา)
 */

let orgX: TestUser;
let orgY: TestUser;
let referee: TestUser;
let referee2: TestUser;
let leaderA: TestUser;
let playerA: TestUser;
let leaderB: TestUser;
let uniAdmin: TestUser;
let tourX: number;     // ทัวร์ที่จะถูกยกเลิก
let tourY: number;     // ทัวร์อื่นที่ไม่เกี่ยว
let teamA: number;
let teamB: number;
let matchX: number;    // แมตช์ที่จะถูกแช่แข็ง (เวลา T สนามกลาง · กรรมการรับแล้ว)
let trX: number;
let tr2X: number;
let sport: number;
let T: Date;

const SHARED_VENUE = 'สนามกลางมหาวิทยาลัย';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const cancelX = () => as(orgX).post(`/tournaments/${tourX}/cancel`).send({ reason: 'ทดสอบผลกระทบ' });
const restoreX = () => as(uniAdmin).post(`/admin/tournaments/${tourX}/restore`).send({});
/** รายการจาก response ไม่ว่าจะเป็น array ตรง ๆ หรือ { items } */
const list = (body: unknown): Array<Record<string, any>> =>
  (Array.isArray(body) ? body : (body as { items: unknown[] }).items) as Array<Record<string, any>>;
const matchIdsOf = (body: unknown) => list(body).map(m => m['id'] ?? m['matchId']);

beforeEach(async () => {
  const faculty = await createFaculty();
  sport = await createSportType({ minMembers: 1, maxMembers: 10 });
  orgX = await createUser();
  orgY = await createUser();
  referee = await createUser();
  referee2 = await createUser();
  leaderA = await createUser();
  playerA = await createUser();
  leaderB = await createUser();
  uniAdmin = await createUser();
  await makeAdmin(uniAdmin.id, 'university_wide');

  tourX = await createTournament({ organizer: orgX.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  tourY = await createTournament({ organizer: orgY.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  // T = 10:00 เวลาไทยของวันแรกของทัวร์ Y (ต้องอยู่ในช่วงวันทัวร์ ไม่งั้นจัดตารางติด OUTSIDE_TOURNAMENT_DATES)
  T = new Date(`${day(20)}T10:00:00+07:00`);

  teamA = await createTeam({ leader: leaderA.id, sportTypeId: sport, members: [playerA.id] });
  teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport });
  const appA = await insert('tournament_applications', { tournament_id: tourX, team_id: teamA, tournament_application_status: 'approved' });
  await insert('application_players', { tournament_application_id: appA, tournament_id: tourX, user_id: leaderA.id });
  await insert('application_players', { tournament_application_id: appA, tournament_id: tourX, user_id: playerA.id });
  const appB = await insert('tournament_applications', { tournament_id: tourX, team_id: teamB, tournament_application_status: 'approved' });
  await insert('application_players', { tournament_application_id: appB, tournament_id: tourX, user_id: leaderB.id });

  matchX = await createMatch({ tournamentId: tourX, teamA, teamB, scheduledAt: T, venue: SHARED_VENUE });
  trX = await addTournamentReferee({ tournamentId: tourX, userId: referee.id, invitedBy: orgX.id });
  tr2X = await addTournamentReferee({ tournamentId: tourX, userId: referee2.id, invitedBy: orgX.id });
  await assignMatchReferee({ matchId: matchX, tournamentRefereeId: trX });
});

describe('① หน้างานค้างของแอดมิน — แมตช์พิพาทของทัวร์ที่ถูกยกเลิก', () => {
  it('ก่อนยกเลิก: แมตช์พิพาทเลยกำหนดขึ้นในงานค้าง · หลังยกเลิก: หายไป · กู้คืน: กลับมา', async () => {
    const disputed = await createMatch({ tournamentId: tourX, teamA, teamB, status: 'disputed' });
    await insert('match_results', {
      match_id: disputed, submitted_by_user_id: referee.id, submitted_role: 'referee', match_result_status: 'disputed',
      dispute_raised_at: new Date(Date.now() - 10 * 86_400_000),
    });
    const stalled = async () => (await as(uniAdmin).get('/admin/oversight/stalled')).body.disputesPastDeadline.matchIds as number[];

    expect(await stalled()).toContain(disputed);
    await cancelX();
    expect(await stalled()).not.toContain(disputed);
    await restoreX();
    expect(await stalled()).toContain(disputed);
  });
});

describe('② กรรมการ — งานในทัวร์ที่ถูกยกเลิกไม่บล็อกการรับแมตช์ทัวร์อื่น', () => {
  let invitationY: number;
  let matchY: number;
  beforeEach(async () => {
    matchY = await createMatch({ tournamentId: tourY, teamA: null, teamB: null, scheduledAt: T, venue: 'สนามอีกที่' });
    invitationY = await addTournamentReferee({ tournamentId: tourY, userId: referee.id, invitedBy: orgY.id, invitationStatus: 'pending' });
    await insert('match_referees', { match_id: matchY, tournament_referee_id: invitationY, assignment_status: 'pending' });
  });
  const acceptY = () => as(referee).post(`/referee-invitations/${invitationY}/accept`).send({ matchIds: [matchY] });

  it('ก่อนยกเลิก: ชนเวลา → 409 REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT (ด่านเดิมยังทำงาน)', async () => {
    const res = await acceptY();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT');
  });

  it('หลังยกเลิกทัวร์ X: รับแมตช์ของทัวร์ Y เวลาเดียวกันได้', async () => {
    await cancelX();
    const res = await acceptY();
    expect(res.status).toBeLessThan(300);
  });
});

describe('③ ผู้จัดทัวร์อื่น — แมตช์ที่ถูกแช่แข็งไม่บล็อกสนาม/เวลา', () => {
  const scheduleY = async () => {
    const teamC = await createTeam({ leader: (await createUser()).id, sportTypeId: sport });
    const teamD = await createTeam({ leader: (await createUser()).id, sportTypeId: sport });
    const matchY = await createMatch({ tournamentId: tourY, teamA: teamC, teamB: teamD });
    return as(orgY).patch(`/matches/${matchY}/schedule`).send({
      scheduledTime: T.toISOString(), scheduledEndTime: new Date(T.getTime() + 3600_000).toISOString(), venue: SHARED_VENUE,
    });
  };

  it('ก่อนยกเลิก: สนามเดียวกันเวลาซ้อน → 409 SCHEDULE_CONFLICT (ด่านเดิมยังทำงาน)', async () => {
    const res = await scheduleY();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SCHEDULE_CONFLICT');
  });

  it('หลังยกเลิกทัวร์ X: จัดสนาม/เวลาเดียวกันได้', async () => {
    await cancelX();
    expect((await scheduleY()).status).toBeLessThan(300);
  });
});

describe('④ ขอโอน/แลกแมตช์กรรมการ — กันตั้งแต่ตอนยื่น', () => {
  it('หลังยกเลิก → 409 TOURNAMENT_CANCELLED · ไม่มีคำขอ · ไม่มีแจ้งเตือนถึงกรรมการอีกคน', async () => {
    await cancelX();
    const before = await one<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', [referee2.id]);
    const res = await as(referee).post('/referee-requests').send({ myMatchId: matchX, toTournamentRefereeId: tr2X });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOURNAMENT_CANCELLED');
    expect(await one<{ n: number }>('SELECT COUNT(*) AS n FROM referee_change_requests WHERE tournament_id = ?', [tourX])).toEqual({ n: 0 });
    expect(await one<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', [referee2.id])).toEqual(before);
  });
});

describe('⑤ หน้าแมตช์ของฉัน — ไม่โชว์แมตช์ที่ถูกแช่แข็ง', () => {
  it('ผู้เล่น (/me/matches): ก่อนเห็น · หลังยกเลิกไม่เห็น · กู้คืนเห็นอีก', async () => {
    const mine = async () => matchIdsOf((await as(playerA).get('/me/matches')).body);
    expect(await mine()).toContain(matchX);
    await cancelX();
    expect(await mine()).not.toContain(matchX);
    await restoreX();
    expect(await mine()).toContain(matchX);
  });

  it('กรรมการ (/me/matches และ /me/referee-matches): แมตช์ที่ยังไม่แข่งหาย · แมตช์ที่แข่งจบแล้วยังอยู่เป็นประวัติ', async () => {
    const played = await createMatch({ tournamentId: tourX, teamA, teamB, status: 'completed', scheduledAt: new Date(Date.now() - 86_400_000) });
    await assignMatchReferee({ matchId: played, tournamentRefereeId: trX });
    expect(matchIdsOf((await as(referee).get('/me/matches')).body)).toContain(matchX);

    await cancelX();
    expect(matchIdsOf((await as(referee).get('/me/matches')).body)).not.toContain(matchX);
    const refMatches = matchIdsOf((await as(referee).get('/me/referee-matches')).body);
    expect(refMatches).not.toContain(matchX);
    expect(refMatches).toContain(played);
  });
});

describe('⑥ กล่องคำเชิญกรรมการ', () => {
  it('คำเชิญที่ยังไม่ตอบของทัวร์ที่ถูกยกเลิกไม่ขึ้น · กู้คืนแล้วกลับมา', async () => {
    const invitee = await createUser();
    const inv = await addTournamentReferee({ tournamentId: tourX, userId: invitee.id, invitedBy: orgX.id, invitationStatus: 'pending' });
    const ids = async () => list((await as(invitee).get('/me/referee-invitations')).body).map(i => i['id']);
    expect(await ids()).toContain(inv);
    await cancelX();
    expect(await ids()).not.toContain(inv);
    await restoreX();
    expect(await ids()).toContain(inv);
  });
});

describe('⑦ กู้คืน — รายงานทีมที่เปลี่ยนไประหว่างถูกยกเลิก (มติ 28 ต.ค.)', () => {
  it('ไม่มีอะไรเปลี่ยน → issues ว่าง · ไม่มีแจ้งเตือนพิเศษถึงผู้จัด', async () => {
    await cancelX();
    const res = await restoreX();
    expect(res.body.issues).toEqual({ deletedTeams: [], playersLeftTeam: [] });
    expect(await one<{ n: number }>(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'tournament_restored'`, [orgX.id]))
      .toEqual({ n: 1 });
  });

  it('ทีมถูกลบ + ผู้เล่นออกจากทีม ระหว่างถูกยกเลิก → กู้คืนได้ · บอกแอดมินใน response · บอกผู้จัดเป็นแจ้งเตือน', async () => {
    await cancelX();
    // ปลดล็อกแล้ว (ข้อ 9) — สองอย่างนี้ทำได้เพราะทัวร์ถูกยกเลิก
    expect((await as(leaderB).delete(`/teams/${teamB}`)).status).toBeLessThan(300);
    expect((await as(leaderA).delete(`/teams/${teamA}/members/${playerA.id}`)).status).toBeLessThan(300);

    const res = await restoreX();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('public');
    expect(res.body.issues.deletedTeams).toEqual([{ teamId: teamB, teamName: expect.any(String) }]);
    expect(res.body.issues.playersLeftTeam).toEqual([{ teamId: teamA, teamName: expect.any(String), userId: playerA.id, fullName: expect.any(String) }]);

    const notes = await testDb().query(
      `SELECT message FROM notifications WHERE user_id = ? AND type = 'tournament_restored' ORDER BY notification_id`, [orgX.id]);
    const messages = (notes[0] as { message: string }[]).map(n => n.message);
    expect(messages).toHaveLength(2);   // แจ้งทั่วไป 1 + แจ้งเรื่องทีมที่ต้องตรวจ 1
    expect(messages[1]).toContain('ทีมที่ถูกลบไปแล้ว');
    expect(messages[1]).toContain('ออกจากทีมไปแล้ว');
  });
});
