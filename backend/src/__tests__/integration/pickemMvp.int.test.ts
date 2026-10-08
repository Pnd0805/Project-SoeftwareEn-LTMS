import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { all, insert, testDb } from './helpers/db.js';
import {
  addTournamentReferee, createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';
import { MVP_VOTING_HOURS } from '../../config/scoring.js';

/**
 * Pick'em (ทายผล) · โหวต MVP — กฎเรื่อง "ใครเล่นได้" และ "เมื่อไร"
 *
 *   ทายผล: คนใน (ผู้เล่น · สมาชิกทีม · กรรมการ · ผู้จัด) ทายไม่ได้ — กันคนที่มีผลต่อแมตช์มาเก็งผล
 *          ปิดทันทีที่แมตช์ไม่อยู่ scheduled หรือถึงเวลาแข่ง · คนละ 1 ทาย ส่งซ้ำ = แก้
 *   MVP:  สมาชิกทีมที่ลงแข่งแมตช์นั้นโหวตไม่ได้ · ผู้ถูกโหวตต้องเช็คอินลงแข่งจริง
 *          เปิด MVP_VOTING_HOURS ชม. หลังแมตช์จบจริง · คนละ 1 โหวต ส่งซ้ำ = เปลี่ยน
 *   BR-15: แต้มสะสมในระบบเท่านั้น — ไม่มี endpoint ไหนรับเงิน/ของมีค่า (ไม่มีอะไรให้เทสฝั่ง API)
 */

let organizer: TestUser;
let referee: TestUser;
let playerA: TestUser;     // ลงแข่งทีม A (เป็นหัวหน้าด้วย)
let playerB: TestUser;
let benchA: TestUser;      // อยู่ทีม A แต่ไม่ได้ส่งลงแข่ง
let fan: TestUser;
let fan2: TestUser;
let tour: number;
let teamA: number;
let teamB: number;

beforeEach(async () => {
  const faculty = await createFaculty();
  const sport = await createSportType();
  organizer = await createUser();
  referee = await createUser();
  playerA = await createUser();
  playerB = await createUser();
  benchA = await createUser();
  fan = await createUser();
  fan2 = await createUser();
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  teamA = await createTeam({ leader: playerA.id, sportTypeId: sport, members: [benchA.id] });
  teamB = await createTeam({ leader: playerB.id, sportTypeId: sport });
  for (const [team, player] of [[teamA, playerA], [teamB, playerB]] as const) {
    const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
    await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: player.id });
  }
  await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
});

// ───────────────────────────── Pick'em ─────────────────────────────

describe("Pick'em — ทายผลแมตช์ที่ยังไม่เริ่ม", () => {
  let match: number;
  beforeEach(async () => {
    match = await createMatch({ tournamentId: tour, teamA, teamB, scheduledAt: new Date(Date.now() + 48 * 3600_000) });
  });
  const pick = (who: TestUser, a: number, b: number) =>
    as(who).post(`/matches/${match}/predictions`).send({ scoreData: { [teamA]: a, [teamB]: b } });
  const picks = () => all<{ user_id: number; predicted_winner_team_id: number }>(
    'SELECT user_id, predicted_winner_team_id FROM pickem_predictions WHERE match_id = ?', [match]);

  it('คนดูทายได้ · ทายใหม่ = แก้ของเดิม (ยังมีแถวเดียว)', async () => {
    expect((await pick(fan, 2, 1)).status).toBeLessThan(300);
    expect((await pick(fan, 0, 3)).status).toBeLessThan(300);
    expect(await picks()).toEqual([{ user_id: fan.id, predicted_winner_team_id: teamB }]);
  });

  it.each([
    ['ผู้จัด', () => organizer],
    ['กรรมการของทัวร์', () => referee],
    ['ผู้เล่นที่ลงแข่ง', () => playerA],
    ['สมาชิกทีมที่ไม่ได้ลงแข่ง', () => benchA],
  ])('🔒 คนใน (%s) ทาย → 403 PICKEM_CONFLICT · ไม่มีแถว', async (_label, who) => {
    const res = await pick(who(), 2, 1);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PICKEM_CONFLICT');
    expect(await picks()).toEqual([]);
  });

  it.each([
    ['ทายเสมอ', { a: 1, b: 1 }, 'PICK_SCORE_TIE'],
  ])('%s → 422 %s', async (_label, s, code) => {
    const res = await pick(fan, s.a, s.b);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(code);
  });

  it('ทายด้วยทีมที่ไม่ได้อยู่ในแมตช์ → 422 PICK_TEAM_NOT_IN_MATCH', async () => {
    const res = await as(fan).post(`/matches/${match}/predictions`).send({ scoreData: { [teamA]: 2, 999999: 1 } });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PICK_TEAM_NOT_IN_MATCH');
  });

  it.each([
    ['แมตช์เปิดเช็คอินแล้ว', "UPDATE matches SET match_status = 'checkin_open' WHERE match_id = ?"],
    ['ถึงเวลาแข่งแล้ว', 'UPDATE matches SET scheduled_time = NOW() - INTERVAL 1 MINUTE WHERE match_id = ?'],
  ])('ปิดทายผลแล้ว (%s) → 409 PICKEM_CLOSED · ทั้งทายใหม่และยกเลิก', async (_label, sql) => {
    expect((await pick(fan, 2, 1)).status).toBeLessThan(300);
    await testDb().query(sql, [match]);
    expect((await pick(fan, 0, 3)).status).toBe(409);
    expect((await as(fan).delete(`/matches/${match}/predictions/me`)).status).toBe(409);
    expect(await picks()).toEqual([{ user_id: fan.id, predicted_winner_team_id: teamA }]);   // เปลี่ยนใจหลังปิดไม่ได้
  });

  it('ทัวร์ไม่ public → 409 TOURNAMENT_NOT_PUBLIC', async () => {
    await testDb().query("UPDATE tournaments SET tournament_status = 'private' WHERE tournament_id = ?", [tour]);
    const res = await pick(fan, 2, 1);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOURNAMENT_NOT_PUBLIC');
  });

  it('ยกเลิกการทาย → ลบเฉพาะของตัวเอง', async () => {
    await pick(fan, 2, 1);
    await pick(fan2, 0, 1);
    expect((await as(fan).delete(`/matches/${match}/predictions/me`)).status).toBeLessThan(300);
    expect(await picks()).toEqual([{ user_id: fan2.id, predicted_winner_team_id: teamB }]);
  });

  it('สรุปผลทาย (ไม่ล็อกอิน) → มีแค่จำนวน/เปอร์เซ็นต์ ไม่บอกว่าใครทายอะไร', async () => {
    await pick(fan, 2, 1);
    await pick(fan2, 0, 1);
    const res = await anon.get(`/matches/${match}/predictions/summary`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.mine).toBeNull();
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(`"userId":${fan.id}`);
    expect(text).not.toContain(fan.email);
  });
});

// ───────────────────────────── MVP ─────────────────────────────

describe('โหวต MVP — หลังแมตช์จบ · ผู้ถูกโหวตต้องเช็คอินลงแข่งจริง', () => {
  let match: number;
  beforeEach(async () => {
    match = await createMatch({ tournamentId: tour, teamA, teamB, status: 'completed' });
    await testDb().query('UPDATE matches SET actual_end_time = NOW() - INTERVAL 1 HOUR WHERE match_id = ?', [match]);
    for (const p of [playerA, playerB]) {
      await insert('match_checkins', { match_id: match, user_id: p.id, method: 'qr_onsite', match_checkin_status: 'success' });
    }
  });
  const vote = (who: TestUser, candidate: number) => as(who).post(`/matches/${match}/mvp-votes`).send({ userId: candidate });
  const votes = () => all<{ user_id: number; voted_for_user_id: number }>(
    "SELECT user_id, voted_for_user_id FROM tournament_feedback WHERE match_id = ? AND feedback_type = 'mvp_vote'", [match]);

  it('คนดูโหวต · โหวตใหม่ = เปลี่ยนคน (ยังมีแถวเดียว)', async () => {
    expect((await vote(fan, playerA.id)).status).toBeLessThan(300);
    expect((await vote(fan, playerB.id)).status).toBeLessThan(300);
    expect(await votes()).toEqual([{ user_id: fan.id, voted_for_user_id: playerB.id }]);
  });

  it.each([
    ['ผู้เล่นที่ลงแข่ง (โหวตตัวเอง/เพื่อนร่วมทีม)', () => playerA],
    ['สมาชิกทีมที่ไม่ได้ลงแข่ง', () => benchA],
    ['ผู้เล่นทีมคู่แข่ง', () => playerB],
  ])('🔒 %s โหวต → 403 MVP_VOTER_NOT_ELIGIBLE', async (_label, who) => {
    const res = await vote(who(), playerA.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MVP_VOTER_NOT_ELIGIBLE');
    expect(await votes()).toEqual([]);
  });

  it('โหวตให้คนที่ไม่ได้เช็คอินลงแข่ง → 422 MVP_CANDIDATE_NOT_ELIGIBLE', async () => {
    const res = await vote(fan, benchA.id);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MVP_CANDIDATE_NOT_ELIGIBLE');
  });

  it('แมตช์ยังไม่จบ → 409 MVP_VOTING_NOT_OPEN', async () => {
    await testDb().query("UPDATE matches SET actual_end_time = NULL, match_status = 'in_progress' WHERE match_id = ?", [match]);
    const res = await vote(fan, playerA.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MVP_VOTING_NOT_OPEN');
  });

  it(`พ้น ${MVP_VOTING_HOURS} ชม. หลังจบ → 409 MVP_VOTING_CLOSED`, async () => {
    await testDb().query('UPDATE matches SET actual_end_time = NOW() - INTERVAL ? HOUR WHERE match_id = ?', [MVP_VOTING_HOURS + 1, match]);
    const res = await vote(fan, playerA.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MVP_VOTING_CLOSED');
  });

  it('ไม่ล็อกอินโหวตไม่ได้ · แต่ดูผลโหวตได้', async () => {
    expect((await anon.post(`/matches/${match}/mvp-votes`).send({ userId: playerA.id })).status).toBe(401);
    expect((await anon.get(`/matches/${match}/mvp-votes`)).status).toBe(200);
  });

  /**
   * 🆕 การแก้ 7 ต.ค. 2569 (BE-28) — คนที่กรรมการเช็คอินให้ด้วยมือ ต้องเป็นตัวเลือก MVP ด้วย
   *
   * `match_checkin_status = 'exception'` คือเช็คอินที่กรรมการกดแทนผู้เล่นตอนกล้อง/เน็ตพัง
   * (M19, UC-04 E2b) ⇒ "เช็คอินแล้ว" เหมือน 'success' และโค้ดที่อื่นทั้งหมดนับรวมเสมอ
   * แต่ `findMvpCandidatesOfMatch` กรอง `= 'success'` ที่เดียว ⇒ แมตช์ที่กรรมการเช็คอินให้
   * ทุกคนได้ `candidates: []` หน้าเว็บขึ้น "No MVP candidates yet" และโหวตใครก็ไม่ได้
   *
   * ★ ยิงผ่าน HTTP จริงทั้งเส้น เพราะบั๊กอยู่ใน SQL — เทส unit ที่ mock repo จะไม่เห็นอะไรเลย
   */
  describe('เช็คอินด้วยมือ (exception) นับเป็นตัวเลือก MVP (BE-28)', () => {
    const setCheckin = (userId: number, status: string) =>
      testDb().query('UPDATE match_checkins SET match_checkin_status = ? WHERE match_id = ? AND user_id = ?',
                     [status, match, userId]);

    it('กรรมการเช็คอินให้ทุกคน → ยังมีตัวเลือกครบ และโหวตได้', async () => {
      await setCheckin(playerA.id, 'exception');
      await setCheckin(playerB.id, 'exception');

      const list = await anon.get(`/matches/${match}/mvp-votes`);
      expect(list.status).toBe(200);
      expect(list.body.candidates.map((c: { userId: number }) => c.userId).sort())
        .toEqual([playerA.id, playerB.id].sort());

      expect((await vote(fan, playerA.id)).status).toBeLessThan(300);
    });

    /** ★ เช็คอินผสมกัน — เคสที่มองไม่ออกจากหน้าเว็บ เพราะหายไปแค่บางคน */
    it('เช็คอินผสม qr + มือ → มีทั้งสองคน', async () => {
      await setCheckin(playerB.id, 'exception');

      const list = await anon.get(`/matches/${match}/mvp-votes`);
      expect(list.body.candidates.map((c: { userId: number }) => c.userId).sort())
        .toEqual([playerA.id, playerB.id].sort());
    });

    /**
     * ★ ด่านไม่ได้หายไป — 'rejected' (กรรมการปฏิเสธการเช็คอิน) ยังต้องไม่เข้า
     *   ถ้าใครแก้เป็น "เอาทุกแถวใน match_checkins" เทสนี้จะแดง
     */
    it.each(['rejected', 'pending'])('สถานะ %s ยังไม่นับเป็นตัวเลือก', async (status) => {
      await setCheckin(playerB.id, status);

      const list = await anon.get(`/matches/${match}/mvp-votes`);
      expect(list.body.candidates.map((c: { userId: number }) => c.userId)).toEqual([playerA.id]);

      const res = await vote(fan, playerB.id);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('MVP_CANDIDATE_NOT_ELIGIBLE');
    });
  });
});
