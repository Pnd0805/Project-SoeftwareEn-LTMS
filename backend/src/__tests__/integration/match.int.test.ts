import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { all, insert, one } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';

/**
 * แมตช์ — "คุมแมตช์ได้" = ผู้จัดของทัวร์นั้น หรือกรรมการที่ได้แมตช์นั้น (findMatchRoles)
 *
 * ★ finish / abandon / close-checkin / open-checkin / room-code มีแค่ requireAuth ที่ route
 *   ด่านจริงอยู่ใน service ⇒ ไฟล์นี้พิสูจน์ผ่านคำขอจริง พร้อมตรวจว่าสถานะแมตช์ไม่ขยับเมื่อถูกปฏิเสธ
 * ★ ปิดท้ายด้วยการสร้างสายจริงทั้งเส้น: API → อัลกอริทึม (unit test แล้ว) → แมตช์ใน MySQL
 */

let sport: number;
let faculty: number;
let organizer: TestUser;
let referee: TestUser;
let otherReferee: TestUser;
let leaderA: TestUser;
let leaderB: TestUser;
let otherOrganizer: TestUser;
let tour: number;
let teamA: number;
let teamB: number;
let refRow: number;

beforeEach(async () => {
  faculty = await createFaculty();
  sport = await createSportType();
  organizer = await createUser();
  referee = await createUser();
  otherReferee = await createUser();
  leaderA = await createUser();
  leaderB = await createUser();
  otherOrganizer = await createUser();
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  await createTournament({ organizer: otherOrganizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  teamA = await createTeam({ leader: leaderA.id, sportTypeId: sport });
  teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport });
  refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
  await addTournamentReferee({ tournamentId: tour, userId: otherReferee.id, invitedBy: organizer.id });
});

const matchStatus = async (id: number) =>
  (await one<{ match_status: string }>('SELECT match_status FROM matches WHERE match_id = ?', [id]))!.match_status;

// ───────────────────────────── จบ / ยกเลิกแมตช์ ─────────────────────────────

describe('POST /matches/:id/finish — ผู้จัดหรือกรรมการของแมตช์เท่านั้น', () => {
  let match: number;
  beforeEach(async () => {
    match = await createMatch({ tournamentId: tour, teamA, teamB, status: 'in_progress' });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
  });

  it.each([
    ['ผู้จัดของทัวร์นี้', () => organizer],
    ['กรรมการที่ได้แมตช์นี้', () => referee],
  ])('%s → 200 · แมตช์เป็น finished', async (_label, who) => {
    const res = await as(who()).post(`/matches/${match}/finish`);
    expect(res.status).toBe(200);
    expect(await matchStatus(match)).toBe('finished');
  });

  it.each([
    ['กรรมการของทัวร์ที่ไม่ได้แมตช์นี้', () => otherReferee],
    ['หัวหน้าทีมที่แข่งอยู่', () => leaderA],
    ['ผู้จัดของทัวร์อื่น', () => otherOrganizer],
  ])('%s → 403 NOT_MATCH_PARTICIPANT · แมตช์ยังแข่งอยู่', async (_label, who) => {
    const res = await as(who()).post(`/matches/${match}/finish`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_MATCH_PARTICIPANT');
    expect(await matchStatus(match)).toBe('in_progress');
  });

  it('ไม่ล็อกอิน → 401', async () => {
    expect((await anon.post(`/matches/${match}/finish`)).status).toBe(401);
    expect(await matchStatus(match)).toBe('in_progress');
  });

  it('แมตช์ยังไม่เริ่ม → 409 MATCH_NOT_IN_PROGRESS แม้เป็นผู้จัด', async () => {
    const scheduled = await createMatch({ tournamentId: tour, teamA, teamB, status: 'scheduled' });
    const res = await as(organizer).post(`/matches/${scheduled}/finish`);
    expect(res.status).toBe(409);
    expect(await matchStatus(scheduled)).toBe('scheduled');
  });

  it('ยกเลิกกลางคัน: คนนอก → 403 · กรรมการของแมตช์ → กลับเป็น scheduled', async () => {
    expect((await as(leaderB).post(`/matches/${match}/abandon`).send({ reason: 'ฝนตก' })).status).toBe(403);
    expect(await matchStatus(match)).toBe('in_progress');
    expect((await as(referee).post(`/matches/${match}/abandon`).send({ reason: 'ฝนตก' })).status).toBe(200);
    expect(await matchStatus(match)).toBe('scheduled');
  });

  /**
   * 🆕 BE-24 (แก้ 7 ต.ค. 2569 · มติ ⑪ ก) — ยกเลิกกลางคันต้องล้างตารางด้วย
   *
   * เดิมคืนสถานะเป็น `scheduled` แต่เก็บเวลา/สนามไว้ ⇒ กรรมการเปิดเช็คอินใหม่ได้ทันที
   * ขัดกับแจ้งเตือนที่ระบบเองส่งว่า "รอผู้จัดนัดเวลาใหม่ แล้วต้องเช็คอินใหม่ในวันแข่งจริง"
   * ⇒ ข้อความของระบบเถียงกับพฤติกรรมของระบบ (QA 6 ต.ค.)
   */
  it('ยกเลิกกลางคันแล้ว เวลาและสนามถูกล้าง · เปิดเช็คอินใหม่ไม่ได้จนผู้จัดนัดเวลาใหม่', async () => {
    /**
     * ★ ต้องสร้างแมตช์ที่ **มีตารางจริง** — แมตช์ของ describe นี้เกิดมาโดยไม่มีเวลา/สนาม
     *   ถ้าใช้ตัวนั้น เทสจะเขียวทั้งที่ยังไม่ได้แก้อะไร (null อยู่แล้วตั้งแต่ต้น)
     * ★ เวลานัด +5 นาที ⇒ ถ้าโค้ดไม่ล้างตาราง การเปิดเช็คอินซ้ำจะ **สำเร็จ** (อยู่ในหน้าต่าง)
     *   ซึ่งคือพฤติกรรมเดิมที่เป็นปัญหา ⇒ เทสนี้แยกสองกรณีออกจากกันได้จริง
     */
    const scheduledMatch = await createMatch({
      tournamentId: tour, teamA, teamB, status: 'in_progress',
      scheduledAt: new Date(Date.now() + 5 * 60_000), venue: 'สนามกลาง' });
    await assignMatchReferee({ matchId: scheduledMatch, tournamentRefereeId: refRow });

    expect((await as(referee).post(`/matches/${scheduledMatch}/abandon`).send({ reason: 'ฝนตก' })).status).toBe(200);

    expect(await one('SELECT scheduled_time AS t, scheduled_end_time AS e, venue AS v FROM matches WHERE match_id = ?', [scheduledMatch]))
      .toEqual({ t: null, e: null, v: null });

    // ★ ผลที่ตามมาซึ่งเป็นเหตุผลของการแก้: เปิดเช็คอินซ้ำทันทีไม่ได้อีกแล้ว
    const again = await as(referee).post(`/matches/${scheduledMatch}/open-checkin`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('SCHEDULE_INCOMPLETE');
  });

  it('แมตช์ไม่มีอยู่ → 404', async () => {
    expect((await as(organizer).post('/matches/999999/finish')).status).toBe(404);
  });
});

// ───────────────────────────── ด่านผู้จัดของแมตช์ ─────────────────────────────

describe('requireOrganizerOfMatch — ตารางเวลา / ปรับแพ้', () => {
  let match: number;
  beforeEach(async () => {
    match = await createMatch({ tournamentId: tour, teamA, teamB, status: 'scheduled' });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
  });

  it.each([
    ['กรรมการของแมตช์ (ไม่ใช่ผู้จัด)', () => referee],
    ['ผู้จัดของทัวร์อื่น', () => otherOrganizer],
    ['หัวหน้าทีม', () => leaderA],
  ])('ตั้งสนาม: %s → 403 NOT_ORGANIZER · สนามไม่เปลี่ยน', async (_label, who) => {
    const res = await as(who()).patch(`/matches/${match}/schedule`).send({ venue: 'สนามใหม่' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ORGANIZER');
    expect((await one<{ venue: string | null }>('SELECT venue FROM matches WHERE match_id = ?', [match]))!.venue).toBeNull();
  });

  it('ตั้งตารางครั้งแรกไม่ครบ (มีแต่สนาม) → 400 SCHEDULE_INCOMPLETE แม้เป็นผู้จัด', async () => {
    const res = await as(organizer).patch(`/matches/${match}/schedule`).send({ venue: 'สนามใหม่' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SCHEDULE_INCOMPLETE');
  });

  it('ตั้งตาราง: ผู้จัด · ครบสามอย่างในช่วงวันแข่ง → 200 · ฐานเปลี่ยนจริง', async () => {
    const day = (await one<{ d: string }>('SELECT event_start_date AS d FROM tournaments WHERE tournament_id = ?', [tour]))!.d;
    const res = await as(organizer).patch(`/matches/${match}/schedule`).send({
      scheduledTime: `${day}T10:00:00+07:00`, scheduledEndTime: `${day}T11:00:00+07:00`, venue: 'สนามใหม่',
    });
    expect(res.status).toBe(200);
    expect((await one<{ venue: string }>('SELECT venue FROM matches WHERE match_id = ?', [match]))!.venue).toBe('สนามใหม่');
  });

  it('ปรับแพ้: กรรมการทำไม่ได้ (อำนาจผู้จัดเท่านั้น)', async () => {
    expect((await as(referee).post(`/matches/${match}/forfeit`)).status).toBe(403);
    expect(await matchStatus(match)).toBe('scheduled');
  });
});

// ───────────────────────────── รหัสห้อง (online) ─────────────────────────────

describe('PUT /matches/:id/room-code', () => {
  it('กรรมการของแมตช์ตั้งได้ · หัวหน้าทีมตั้งไม่ได้', async () => {
    const match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'online' });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });

    expect((await as(leaderA).put(`/matches/${match}/room-code`).send({ roomCode: 'HACK' })).status).toBe(403);
    expect((await as(referee).put(`/matches/${match}/room-code`).send({ roomCode: 'ROOM-42' })).status).toBe(200);
    expect((await one<{ room_code: string }>('SELECT room_code FROM matches WHERE match_id = ?', [match]))!.room_code).toBe('ROOM-42');
  });

  it('แมตช์ onsite → 409 MATCH_NOT_ONLINE', async () => {
    const match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'onsite' });
    const res = await as(organizer).put(`/matches/${match}/room-code`).send({ roomCode: 'X' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_NOT_ONLINE');
  });
});

// ───────────────────────────── สร้างสายทั้งเส้น ─────────────────────────────

describe('POST /tournaments/:id/bracket — อัลกอริทึมจัดสายผ่าน API ถึง MySQL', () => {
  let teams: number[];
  beforeEach(async () => {
    teams = [];
    for (let i = 0; i < 8; i++) {
      const leader = await createUser();
      const team = await createTeam({ leader: leader.id, sportTypeId: sport });
      await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
      teams.push(team);
    }
  });

  it('ผู้จัด · 8 ทีม single elimination → 7 แมตช์ (4+2+1) · รอบแรกมีทุกทีมครั้งเดียว', async () => {
    const res = await as(organizer).post(`/tournaments/${tour}/bracket`).send({ seedingMethod: 'random' });
    expect(res.status).toBe(201);

    const matches = await all<{ round_number: number; team_a_id: number | null; team_b_id: number | null }>(
      'SELECT round_number, team_a_id, team_b_id FROM matches WHERE tournament_id = ? ORDER BY round_number', [tour]);
    expect(matches).toHaveLength(7);
    expect(matches.filter(m => m.round_number === 1)).toHaveLength(4);
    const firstRound = matches.filter(m => m.round_number === 1).flatMap(m => [m.team_a_id, m.team_b_id]);
    expect([...firstRound].sort()).toEqual([...teams].sort());
  });

  it.each([
    ['กรรมการ', () => referee],
    ['หัวหน้าทีมที่สมัคร', () => leaderA],
    ['ผู้จัดของทัวร์อื่น', () => otherOrganizer],
  ])('%s สร้างสาย → 403 · ไม่มีแมตช์เกิดขึ้น', async (_label, who) => {
    const res = await as(who()).post(`/tournaments/${tour}/bracket`).send({ seedingMethod: 'random' });
    expect(res.status).toBe(403);
    expect(await all('SELECT 1 FROM matches WHERE tournament_id = ?', [tour])).toHaveLength(0);
  });

  it('สร้างซ้ำโดยไม่ส่ง replace → 409 BRACKET_ALREADY_EXISTS · สายเดิมไม่เปลี่ยน', async () => {
    expect((await as(organizer).post(`/tournaments/${tour}/bracket`).send({ seedingMethod: 'random' })).status).toBe(201);
    const before = await all('SELECT match_id FROM matches WHERE tournament_id = ? ORDER BY match_id', [tour]);
    const again = await as(organizer).post(`/tournaments/${tour}/bracket`).send({ seedingMethod: 'random' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('BRACKET_ALREADY_EXISTS');
    expect(await all('SELECT match_id FROM matches WHERE tournament_id = ? ORDER BY match_id', [tour])).toEqual(before);
  });

  it('ทีม approved ต่ำกว่าขั้นต่ำ → 422 TEAM_COUNT_MISMATCH · ไม่มีแมตช์', async () => {
    const lonely = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    await insert('tournament_applications', { tournament_id: lonely, team_id: teams[0], tournament_application_status: 'approved' });
    const res = await as(organizer).post(`/tournaments/${lonely}/bracket`).send({ seedingMethod: 'random' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TEAM_COUNT_MISMATCH');
    expect(await all('SELECT 1 FROM matches WHERE tournament_id = ?', [lonely])).toHaveLength(0);
  });
});
