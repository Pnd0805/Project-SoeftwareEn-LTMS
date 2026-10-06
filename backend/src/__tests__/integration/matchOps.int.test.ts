import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';
import { SUBMIT_ESCALATION_HOURS } from '../../config/scoring.js';

/**
 * การคุมแมตช์ — เปิด/ปิดเช็คอิน · เริ่มแข่ง · บันทึกสถิติ · ผู้จัดตัดสินแทน · กรรมการแก้ผลทับ · ตรวจเช็คอิน
 *
 *   BR-10 ด่าน 2: เริ่มแข่งได้เมื่อกรรมการ active ครบ (onsite + กีฬาที่มีสถิติ = 2 · อื่น ๆ = 1)
 *   BR-11:        บันทึกสถิติแบบ onsite ต้องมีกรรมการยืนยันแล้วอย่างน้อย 2 คน
 *   ผู้เล่นมาไม่ครบ: ฝั่งเดียวขาด → อีกฝั่งชนะบาย · ขาดทั้งคู่ → เริ่มไม่ได้
 */

let organizer: TestUser;
let ref1: TestUser;
let ref2: TestUser;
let playerA: TestUser;
let playerB: TestUser;
let stranger: TestUser;
let plainSport: number;       // ไม่มีสถิติ ⇒ onsite ใช้กรรมการ 1 คน
let statSport: number;        // มีสถิติ ⇒ onsite ใช้กรรมการ 2 คน
let statDef: number;
let faculty: number;

beforeEach(async () => {
  faculty = await createFaculty();
  plainSport = await createSportType({ minMembers: 1, maxMembers: 5 });
  statSport = await createSportType({ minMembers: 1, maxMembers: 5 });
  statDef = await insert('sport_stat_definitions', {
    sport_type_id: statSport, stat_key: 'goals', stat_label_th: 'ประตู', data_type: 'integer', display_order: 1,
  });
  organizer = await createUser();
  ref1 = await createUser();
  ref2 = await createUser();
  playerA = await createUser();
  playerB = await createUser();
  stranger = await createUser();
});

/** ทัวร์ public + สองทีมที่ผ่านอนุมัติ (ผู้เล่นคนละ 1) + แมตช์ + กรรมการตามจำนวนที่ขอ */
async function setup(o: { sport: number; mode?: 'onsite' | 'online'; status?: 'scheduled' | 'checkin_open' | 'in_progress' | 'finished'; referees?: number; fixture?: boolean }) {
  const tour = await createTournament({ organizer: organizer.id, sportTypeId: o.sport, facultyId: faculty, status: 'public' });
  const teamA = await createTeam({ leader: playerA.id, sportTypeId: o.sport });
  const teamB = await createTeam({ leader: playerB.id, sportTypeId: o.sport });
  for (const [team, player] of [[teamA, playerA], [teamB, playerB]] as const) {
    const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
    await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: player.id });
  }
  const fixture = o.fixture ?? true;
  const match = await createMatch({
    tournamentId: tour, teamA, teamB, mode: o.mode ?? 'onsite', status: o.status ?? 'scheduled',
    ...(fixture ? { scheduledAt: new Date(Date.now() + 3600_000), venue: 'สนามกลาง' } : {}),
  });
  const refs = [ref1, ref2].slice(0, o.referees ?? 1);
  for (const r of refs) {
    const row = await addTournamentReferee({ tournamentId: tour, userId: r.id, invitedBy: organizer.id });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: row });
  }
  return { tour, teamA, teamB, match };
}
const statusOf = async (match: number) =>
  (await one<{ match_status: string }>('SELECT match_status FROM matches WHERE match_id = ?', [match]))!.match_status;
const checkIn = (match: number, user: TestUser) =>
  insert('match_checkins', { match_id: match, user_id: user.id, method: 'qr_onsite', match_checkin_status: 'success' });

// ───────────────────────────── เปิด / ปิดเช็คอิน ─────────────────────────────

describe('เปิด/ปิดเช็คอิน', () => {
  it.each([
    ['ผู้จัด', () => organizer],
    ['กรรมการของแมตช์', () => ref1],
  ])('%s เปิดเช็คอิน → checkin_open', async (_label, who) => {
    const { match } = await setup({ sport: plainSport });
    expect((await as(who()).post(`/matches/${match}/open-checkin`)).status).toBe(200);
    expect(await statusOf(match)).toBe('checkin_open');
  });

  it.each([
    ['หัวหน้าทีมที่แข่ง', () => playerA],
    ['คนนอก', () => stranger],
  ])('%s เปิดเช็คอิน → 403 · ยัง scheduled', async (_label, who) => {
    const { match } = await setup({ sport: plainSport });
    expect((await as(who()).post(`/matches/${match}/open-checkin`)).status).toBe(403);
    expect(await statusOf(match)).toBe('scheduled');
  });

  it('ยังไม่ได้ตั้งเวลา/สนาม → 409 SCHEDULE_INCOMPLETE (ไม่แจ้งผู้เล่นทั้งที่ไม่รู้ว่าแข่งเมื่อไหร่)', async () => {
    const { match } = await setup({ sport: plainSport, fixture: false });
    const res = await as(organizer).post(`/matches/${match}/open-checkin`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SCHEDULE_INCOMPLETE');
    expect(await statusOf(match)).toBe('scheduled');
  });

  it('ปิดเช็คอิน: มีคนเช็คอินแล้ว → กรรมการปิดไม่ได้ (409 CHECKIN_NOT_EMPTY) · ผู้จัดปิดได้', async () => {
    const { match } = await setup({ sport: plainSport, status: 'checkin_open' });
    await checkIn(match, playerA);
    const byRef = await as(ref1).post(`/matches/${match}/close-checkin`);
    expect(byRef.status).toBe(409);
    expect(byRef.body.error.code).toBe('CHECKIN_NOT_EMPTY');
    expect(await statusOf(match)).toBe('checkin_open');
    expect((await as(organizer).post(`/matches/${match}/close-checkin`)).status).toBe(200);
    expect(await statusOf(match)).toBe('scheduled');
  });
});

// ───────────────────────────── เริ่มแข่ง ─────────────────────────────

describe('POST /matches/:id/start — BR-10 ด่าน 2 · ผู้เล่นมาไม่ครบ', () => {
  it('ทั้งสองทีมเช็คอินครบ · กรรมการครบ → in_progress', async () => {
    const { match } = await setup({ sport: plainSport, status: 'checkin_open' });
    await checkIn(match, playerA);
    await checkIn(match, playerB);
    expect((await as(ref1).post(`/matches/${match}/start`)).status).toBe(200);
    expect(await statusOf(match)).toBe('in_progress');
  });

  it('ผู้จัด (ไม่ใช่กรรมการ) เริ่มแข่ง → 403 NOT_REFEREE · คนเริ่มแข่งคือกรรมการ', async () => {
    const { match } = await setup({ sport: plainSport, status: 'checkin_open' });
    await checkIn(match, playerA);
    await checkIn(match, playerB);
    const res = await as(organizer).post(`/matches/${match}/start`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_REFEREE');
    expect(await statusOf(match)).toBe('checkin_open');
  });

  it('BR-10: กีฬามีสถิติ แข่ง onsite มีกรรมการแค่ 1 คน → 409 INSUFFICIENT_REFEREES · ไม่มีใครแพ้บาย', async () => {
    const { match } = await setup({ sport: statSport, status: 'checkin_open', referees: 1 });
    await checkIn(match, playerA);   // ทีม B ไม่มาด้วย — ต้องไม่ถูกตัดสินแพ้บายเพราะฝั่งผู้จัดหากรรมการไม่ครบ
    const res = await as(ref1).post(`/matches/${match}/start`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_REFEREES');
    expect(await statusOf(match)).toBe('checkin_open');
    expect(await all('SELECT 1 FROM match_results WHERE match_id = ?', [match])).toHaveLength(0);
  });

  it('BR-10: กีฬามีสถิติ กรรมการ 2 คน → เริ่มได้', async () => {
    const { match } = await setup({ sport: statSport, status: 'checkin_open', referees: 2 });
    await checkIn(match, playerA);
    await checkIn(match, playerB);
    expect((await as(ref1).post(`/matches/${match}/start`)).status).toBe(200);
  });

  it('ทีม B ไม่มีใครเช็คอิน → ทีม A ชนะบายทันที · แมตช์ completed · ผลเป็น walkover', async () => {
    const { match, teamA } = await setup({ sport: plainSport, status: 'checkin_open' });
    await checkIn(match, playerA);
    const res = await as(ref1).post(`/matches/${match}/start`);
    expect(res.status).toBe(200);
    expect(res.body.walkover).toMatchObject({ reason: 'insufficient_checkins' });
    expect(await statusOf(match)).toBe('completed');
    expect(await one('SELECT winner_team_id, match_result_status FROM match_results WHERE match_id = ?', [match]))
      .toEqual({ winner_team_id: teamA, match_result_status: 'walkover' });
  });

  it('ขาดทั้งสองทีม → 409 INSUFFICIENT_CHECKINS · ไม่มีผู้ชนะ', async () => {
    const { match } = await setup({ sport: plainSport, status: 'checkin_open' });
    const res = await as(ref1).post(`/matches/${match}/start`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_CHECKINS');
    expect(await all('SELECT 1 FROM match_results WHERE match_id = ?', [match])).toHaveLength(0);
  });
});

// ───────────────────────────── บันทึกสถิติ ─────────────────────────────

describe('POST /matches/:id/stats — BR-11', () => {
  const body = (userId: number, def = statDef) => ({ playerStats: [{ userId, values: [{ statDefinitionId: def, value: 2 }] }] });
  const statsRows = (match: number) => all('SELECT user_id FROM player_match_stats WHERE match_id = ?', [match]);

  it('onsite กรรมการยืนยันแค่ 1 คน → 409 INSUFFICIENT_REFEREES · ไม่มีสถิติ', async () => {
    const { match } = await setup({ sport: statSport, status: 'in_progress', referees: 1 });
    const res = await as(ref1).post(`/matches/${match}/stats`).send(body(playerA.id));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_REFEREES');
    expect(await statsRows(match)).toHaveLength(0);
  });

  it('กรรมการ 2 คน → บันทึกได้', async () => {
    const { match } = await setup({ sport: statSport, status: 'in_progress', referees: 2 });
    expect((await as(ref2).post(`/matches/${match}/stats`).send(body(playerA.id))).status).toBeLessThan(300);
    expect(await statsRows(match)).toHaveLength(1);
  });

  it.each([
    ['ผู้จัด', () => organizer],
    ['ผู้เล่น (บันทึกสถิติตัวเอง)', () => playerA],
  ])('%s บันทึก → 403 · ไม่มีสถิติ', async (_label, who) => {
    const { match } = await setup({ sport: statSport, status: 'in_progress', referees: 2 });
    expect((await as(who()).post(`/matches/${match}/stats`).send(body(playerA.id))).status).toBe(403);
    expect(await statsRows(match)).toHaveLength(0);
  });

  it('รายการสถิติของกีฬาอื่น → 400 UNKNOWN_STAT_DEFINITION', async () => {
    const { match } = await setup({ sport: statSport, status: 'in_progress', referees: 2 });
    const foreign = await insert('sport_stat_definitions', {
      sport_type_id: plainSport, stat_key: 'aces', stat_label_th: 'เอซ', data_type: 'integer', display_order: 1,
    });
    const res = await as(ref1).post(`/matches/${match}/stats`).send(body(playerA.id, foreign));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_STAT_DEFINITION');
  });

  it('ผู้เล่นที่ไม่ได้อยู่ในทีมที่แข่ง → 404 USER_NOT_IN_MATCH · ไม่มีสถิติ', async () => {
    const { match } = await setup({ sport: statSport, status: 'in_progress', referees: 2 });
    const res = await as(ref1).post(`/matches/${match}/stats`).send(body(stranger.id));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_IN_MATCH');
    expect(await statsRows(match)).toHaveLength(0);
  });
});

// ───────────────────────────── แก้ผลทับ / ผู้จัดตัดสินแทน ─────────────────────────────

describe('กรรมการแก้ผลทับ (online) และผู้จัดตัดสินแทนเมื่อไม่มีใครส่งผล', () => {
  it('override: กรรมการแก้ผลที่หัวหน้าทีมส่งได้ · หัวหน้าทีมอีกฝั่งแก้ไม่ได้', async () => {
    const { match, teamA, teamB } = await setup({ sport: plainSport, mode: 'online', status: 'finished' });
    expect((await as(playerA).post(`/matches/${match}/result`).send({ winnerTeamId: teamA, scoreData: { [teamA]: 3, [teamB]: 0 } })).status).toBe(201);
    const fix = { winnerTeamId: teamB, scoreData: { [teamA]: 1, [teamB]: 2 }, reason: 'ดูคลิปแล้ว ทีม B ชนะ' };

    expect((await as(playerB).post(`/matches/${match}/result/override`).send(fix)).status).toBe(403);
    expect((await one<{ w: number }>('SELECT winner_team_id AS w FROM match_results WHERE match_id = ?', [match]))!.w).toBe(teamA);
    expect((await as(ref1).post(`/matches/${match}/result/override`).send(fix)).status).toBe(200);
    expect((await one<{ w: number }>('SELECT winner_team_id AS w FROM match_results WHERE match_id = ?', [match]))!.w).toBe(teamB);
  });

  it('override แมตช์ onsite → 409 OVERRIDE_ONSITE_NOT_ALLOWED', async () => {
    const { match } = await setup({ sport: plainSport, mode: 'onsite', status: 'finished' });
    const res = await as(ref1).post(`/matches/${match}/result/override`).send({ winnerTeamId: 1, scoreData: { 1: 1, 2: 0 }, reason: 'x' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OVERRIDE_ONSITE_NOT_ALLOWED');
  });

  describe('ผู้จัดตัดสินแทน', () => {
    const decide = (who: TestUser, match: number, body: Record<string, unknown>) =>
      as(who).post(`/matches/${match}/result/organizer`).send(body);
    const endedHoursAgo = (match: number, hours: number) =>
      testDb().query('UPDATE matches SET actual_end_time = NOW() - INTERVAL ? HOUR WHERE match_id = ?', [hours, match]);

    it(`ยังไม่พ้น ${SUBMIT_ESCALATION_HOURS} ชม. หลังแมตช์จบ → 409 ESCALATION_NOT_OPEN`, async () => {
      const { match, teamA, teamB } = await setup({ sport: plainSport, mode: 'online', status: 'finished' });
      await endedHoursAgo(match, 1);
      const res = await decide(organizer, match, { outcome: 'result', reason: 'ไม่มีใครส่ง', winnerTeamId: teamA, scoreData: { [teamA]: 1, [teamB]: 0 } });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ESCALATION_NOT_OPEN');
    });

    it('พ้นกำหนดแล้ว: ผู้จัดตัดสินได้ · กรรมการ/หัวหน้าทีมใช้เส้นนี้ไม่ได้', async () => {
      const { match, teamA, teamB } = await setup({ sport: plainSport, mode: 'online', status: 'finished' });
      await endedHoursAgo(match, SUBMIT_ESCALATION_HOURS + 1);
      const body = { outcome: 'result', reason: 'ไม่มีใครส่งผล', winnerTeamId: teamA, scoreData: { [teamA]: 1, [teamB]: 0 } };
      for (const who of [ref1, playerA]) expect((await decide(who, match, body)).status).toBe(403);
      expect(await all('SELECT 1 FROM match_results WHERE match_id = ?', [match])).toHaveLength(0);
      expect((await decide(organizer, match, body)).status).toBe(200);
      expect((await one<{ w: number }>('SELECT winner_team_id AS w FROM match_results WHERE match_id = ?', [match]))!.w).toBe(teamA);
    });

    it('ปรับแพ้ทั้งสองทีมกับแมตช์ onsite → 409 FORFEIT_NOT_ALLOWED_ONSITE (ไม่มีผลเป็นความรับผิดชอบฝั่งผู้จัด)', async () => {
      const { match } = await setup({ sport: plainSport, mode: 'onsite', status: 'finished' });
      await endedHoursAgo(match, SUBMIT_ESCALATION_HOURS + 1);
      const res = await decide(organizer, match, { outcome: 'double_forfeit', reason: 'ไม่มีผล' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('FORFEIT_NOT_ALLOWED_ONSITE');
    });
  });
});

// ───────────────────────────── ตรวจเช็คอินแบบรูป ─────────────────────────────

describe('ตรวจเช็คอิน (รูปบัตร) — กรรมการของแมตช์นั้น · เช็คอินต้องเป็นของแมตช์ใน URL', () => {
  it('กรรมการยืนยัน/ปฏิเสธได้ · คนอื่นไม่ได้ · ปฏิเสธต้องมีเหตุผล', async () => {
    const { match } = await setup({ sport: plainSport, mode: 'online', status: 'checkin_open' });
    const pendingA = await insert('match_checkins', { match_id: match, user_id: playerA.id, method: 'photo_online', match_checkin_status: 'pending' });
    const pendingB = await insert('match_checkins', { match_id: match, user_id: playerB.id, method: 'photo_online', match_checkin_status: 'pending' });
    const statusOfCheckin = async (id: number) =>
      (await one<{ s: string }>('SELECT match_checkin_status AS s FROM match_checkins WHERE match_checkin_id = ?', [id]))!.s;

    for (const who of [organizer, playerB]) {
      expect((await as(who).post(`/matches/${match}/checkins/${pendingA}/verify`)).status).toBe(403);
    }
    expect(await statusOfCheckin(pendingA)).toBe('pending');

    expect((await as(ref1).post(`/matches/${match}/checkins/${pendingA}/verify`)).status).toBe(200);
    expect(await statusOfCheckin(pendingA)).toBe('success');

    expect((await as(ref1).post(`/matches/${match}/checkins/${pendingB}/reject`).send({})).status).toBe(400);
    expect((await as(ref1).post(`/matches/${match}/checkins/${pendingB}/reject`).send({ reason: 'รูปไม่ชัด' })).status).toBe(200);
    expect(await statusOfCheckin(pendingB)).toBe('rejected');
  });

  it('🔒 กรรมการแมตช์ A ส่งเช็คอินของแมตช์ B ผ่าน URL ของ A → 404 · เช็คอินของ B ไม่ถูกแตะ', async () => {
    const { match } = await setup({ sport: plainSport, mode: 'online', status: 'checkin_open' });
    const other = await createMatch({ tournamentId: (await one<{ t: number }>('SELECT tournament_id AS t FROM matches WHERE match_id = ?', [match]))!.t,
      teamA: null, teamB: null, mode: 'online', status: 'checkin_open', round: 2 });
    const foreign = await insert('match_checkins', { match_id: other, user_id: stranger.id, method: 'photo_online', match_checkin_status: 'pending' });

    const res = await as(ref1).post(`/matches/${match}/checkins/${foreign}/verify`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CHECKIN_NOT_FOUND');
    expect((await one<{ s: string }>('SELECT match_checkin_status AS s FROM match_checkins WHERE match_checkin_id = ?', [foreign]))!.s).toBe('pending');
  });
});

// ───────────────────────────── รูปแบบแมตช์ / ไลฟ์สด ─────────────────────────────

describe('รูปแบบแมตช์ (BO) และลิงก์ไลฟ์ — ผู้จัดเท่านั้น', () => {
  it('กรรมการตั้งไม่ได้ · ผู้จัดตั้งได้', async () => {
    const { match } = await setup({ sport: plainSport });
    expect((await as(ref1).patch(`/matches/${match}/format`).send({ bestOf: 3 })).status).toBe(403);
    expect((await as(ref1).put(`/matches/${match}/livestream`).send({ youtubeUrl: 'https://youtu.be/x' })).status).toBe(403);
    expect((await as(organizer).patch(`/matches/${match}/format`).send({ bestOf: 3 })).status).toBe(200);
    expect((await one<{ best_of: number }>('SELECT best_of FROM matches WHERE match_id = ?', [match]))!.best_of).toBe(3);
  });

  it('BO ที่ไม่ใช่ 1/3/5/7 → 400', async () => {
    const { match } = await setup({ sport: plainSport });
    expect((await as(organizer).patch(`/matches/${match}/format`).send({ bestOf: 4 })).status).toBe(400);
  });

  /**
   * 🆕 มติ 7 ต.ค. 2569 (②ก) — กีฬาที่ไม่ได้แข่งเป็นรอบ ตั้ง BO ไม่ได้
   *   ก่อนมตินี้ best_of ไม่ผูกกับกีฬาเลย ⇒ ตั้ง BO5 ให้ฟุตบอลได้และไม่มีใครรู้
   * ★ ธงอยู่ที่ตารางกีฬา ⇒ เทสสร้างกีฬาที่ปิดธงไว้ แล้วยิงผ่าน HTTP จริงทั้งเส้น
   */
  it('กีฬาที่ไม่ได้แข่งเป็นรอบ: ตั้ง BO → 400 · ส่ง null ได้', async () => {
    const pointsSport = await createSportType({ supportsBestOf: false });
    const { match } = await setup({ sport: pointsSport });

    const blocked = await as(organizer).patch(`/matches/${match}/format`).send({ bestOf: 3 });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error?.code ?? blocked.body.code).toBe('BEST_OF_NOT_SUPPORTED');
    expect((await one<{ best_of: number | null }>('SELECT best_of FROM matches WHERE match_id = ?', [match]))!.best_of).toBeNull();

    // ★ ปลดรูปแบบต้องทำได้เสมอ — ไม่งั้นแก้ของที่ตั้งผิดไว้ก่อนมีด่านนี้ไม่ได้
    expect((await as(organizer).patch(`/matches/${match}/format`).send({ bestOf: null })).status).toBe(200);
  });
});
