import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, makeAdmin, type TestUser,
} from './helpers/factories.js';

/**
 * วงจรผลการแข่งขันทั้งเส้น ผ่าน API จริง → SQL จริง
 *
 *   ส่งผล ─► ยืนยัน (BR-12 · BR-13) ─► ผู้ชนะไหลไปแมตช์ถัดไป + ตารางคะแนน (ธุรกรรมเดียว)
 *                └─► โต้แย้งภายในเวลา (BR-14) ─► ผู้จัดตัดสิน / แอดมินมหาวิทยาลัยหลัง 48 ชม.
 *
 * ★ unit test คุมแต่ละชิ้นแยกกัน (middleware · service · repo) — ไฟล์นี้พิสูจน์ว่าต่อกันแล้วยังถูก
 */

let organizer: TestUser;
let referee: TestUser;
let leaderA: TestUser;   // ทีมที่ชนะในทุกเคส
let leaderB: TestUser;
let stranger: TestUser;
let tour: number;
let teamA: number;
let teamB: number;
let nextMatch: number;
let match: number;

async function setup(mode: 'onsite' | 'online') {
  const faculty = await createFaculty();
  const sport = await createSportType();
  organizer = await createUser();
  referee = await createUser();
  leaderA = await createUser();
  leaderB = await createUser();
  stranger = await createUser();
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  teamA = await createTeam({ leader: leaderA.id, sportTypeId: sport });
  teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport });
  nextMatch = await createMatch({ tournamentId: tour, teamA: null, teamB: null, round: 2, mode });
  match = await createMatch({ tournamentId: tour, teamA, teamB, mode, status: 'finished', nextMatchId: nextMatch });
  const refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
  await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
}

const score = () => ({ winnerTeamId: teamA, scoreData: { [teamA]: 3, [teamB]: 1 } });
const result = () => one<{ match_result_status: string; verified_by_user_id: number | null }>(
  'SELECT match_result_status, verified_by_user_id FROM match_results WHERE match_id = ?', [match]);
const matchRow = (id: number) => one<{ match_status: string; team_a_id: number | null; team_b_id: number | null }>(
  'SELECT match_status, team_a_id, team_b_id FROM matches WHERE match_id = ?', [id]);

// ───────────────────────────── onsite ─────────────────────────────

describe('onsite — กรรมการส่ง · หัวหน้าทีมที่ชนะยืนยัน (BR-13)', () => {
  beforeEach(async () => {
    await setup('onsite');
    expect((await as(referee).post(`/matches/${match}/result`).send(score())).status).toBe(201);
  });

  it.each([
    ['หัวหน้าทีมที่แพ้', () => leaderB],
    ['คนนอก', () => stranger],
    ['ผู้จัด (ไม่ใช่คู่กรณี)', () => organizer],
  ])('%s ยืนยัน → 403 · ผลยัง submitted · ไม่มีใครไหลไปรอบถัดไป', async (_label, who) => {
    expect((await as(who()).post(`/matches/${match}/result/verify`)).status).toBe(403);
    expect((await result())!.match_result_status).toBe('submitted');
    expect((await matchRow(nextMatch))!.team_a_id).toBeNull();
  });

  it('กรรมการที่ส่งเอง ยืนยันเองไม่ได้ → 403 SAME_PERSON_CANNOT_VERIFY', async () => {
    const res = await as(referee).post(`/matches/${match}/result/verify`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SAME_PERSON_CANNOT_VERIFY');
  });

  it('BR-12: หัวหน้าทีมที่ชนะยืนยัน → verified · แมตช์ completed · ผู้ชนะอยู่ในแมตช์ถัดไป · ตารางคะแนนขยับ', async () => {
    const res = await as(leaderA).post(`/matches/${match}/result/verify`);
    expect(res.status).toBe(200);

    expect(await result()).toEqual({ match_result_status: 'verified', verified_by_user_id: leaderA.id });
    expect((await matchRow(match))!.match_status).toBe('completed');
    const next = (await matchRow(nextMatch))!;
    expect([next.team_a_id, next.team_b_id]).toContain(teamA);
    expect([next.team_a_id, next.team_b_id]).not.toContain(teamB);

    const standing = (team: number) => one<{ won: number; lost: number; goals_for: number; goals_against: number }>(
      'SELECT won, lost, goals_for, goals_against FROM tournament_standings WHERE tournament_id = ? AND team_id = ?', [tour, team]);
    expect(await standing(teamA)).toEqual({ won: 1, lost: 0, goals_for: 3, goals_against: 1 });
    expect(await standing(teamB)).toEqual({ won: 0, lost: 1, goals_for: 1, goals_against: 3 });
  });

  it('ยืนยันซ้ำ → 409 · ผู้ชนะไม่ถูกวางซ้ำ', async () => {
    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);
    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(409);
    const next = (await matchRow(nextMatch))!;
    expect([next.team_a_id, next.team_b_id].filter(t => t === teamA)).toHaveLength(1);
  });

  it('ผลที่ยังไม่ยืนยัน: ไม่ล็อกอิน/คนนอก ได้ 404 แบบเดียวกับ "ไม่มีผล" · คู่กรณีเห็นผลที่รอยืนยัน', async () => {
    const none = await anon.get('/matches/999999/result');
    for (const res of [await anon.get(`/matches/${match}/result`), await as(stranger).get(`/matches/${match}/result`)]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(none.body);   // ไม่บอกแม้แต่ว่ามีผลรออยู่
    }
    const party = await as(leaderB).get(`/matches/${match}/result`);
    expect(party.status).toBe(200);
    expect(party.body).toMatchObject({ status: 'submitted', winnerTeamId: teamA });
  });

  it('ยืนยันแล้ว → ทุกคนเห็นผล รวมถึงคนที่ไม่ล็อกอิน', async () => {
    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);
    const res = await anon.get(`/matches/${match}/result`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ winnerTeamId: teamA });
  });
});

// ───────────────────────────── online ─────────────────────────────

describe('online — ใครเขียน อีกฝ่ายรับรอง', () => {
  beforeEach(async () => {
    await setup('online');
    expect((await as(leaderA).post(`/matches/${match}/result`).send(score())).status).toBe(201);
  });

  it('หัวหน้าทีมส่ง → หัวหน้าทีมอีกฝั่งยืนยันไม่ได้ (ต้องเป็นกรรมการ)', async () => {
    const res = await as(leaderB).post(`/matches/${match}/result/verify`);
    expect(res.status).toBe(403);
    expect((await result())!.match_result_status).toBe('submitted');
  });

  it('หัวหน้าทีมส่ง → กรรมการของแมตช์ยืนยัน → verified', async () => {
    expect((await as(referee).post(`/matches/${match}/result/verify`)).status).toBe(200);
    expect((await result())!.match_result_status).toBe('verified');
  });
});

// ───────────────────────────── โต้แย้ง ─────────────────────────────

describe('BR-14 โต้แย้งผล', () => {
  beforeEach(async () => {
    await setup('onsite');
    expect((await as(referee).post(`/matches/${match}/result`).send(score())).status).toBe(201);
    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);
  });

  const dispute = (who: TestUser) =>
    as(who).post(`/matches/${match}/result/dispute`).send({ reason: 'กรรมการนับแต้มผิด' });

  it('หัวหน้าทีมที่แพ้ โต้แย้งภายในเวลา → disputed', async () => {
    expect((await dispute(leaderB)).status).toBeLessThan(300);
    expect((await result())!.match_result_status).toBe('disputed');
  });

  it('คนนอกโต้แย้ง → 403 · ผลยัง verified', async () => {
    expect((await dispute(stranger)).status).toBe(403);
    expect((await result())!.match_result_status).toBe('verified');
  });

  /**
   * 🆕 BE-17 (แก้ 7 ต.ค. 2569 · มติ ⑤ ก) — คนที่ส่งผลเอง โต้แย้งผลของตัวเองได้
   *
   * QA: กรรมการส่งผล → หัวหน้าทีมยืนยัน → **กรรมการคนเดิม** กดโต้แย้ง ได้ 200 กลับเป็น disputed
   * ⇒ ขัดกับหลักที่ระบบบังคับทุกที่ว่าคนส่งผล ≠ คนยืนยัน · ถ้าคนส่งค้านเองได้
   *   เท่ากับพลิกผลที่คนอื่นยืนยันแล้วได้ฝ่ายเดียว โดยข้ามกลไกตรวจสอบทั้งหมด
   *
   * ★ บล็อกนี้กรรมการเป็นคนส่งผล (ดู beforeEach) ⇒ เป็นคนที่ต้องถูกกัน
   */
  it('คนที่ส่งผลเอง โต้แย้งผลตัวเอง → 403 CANNOT_DISPUTE_OWN_RESULT · ผลยัง verified', async () => {
    const res = await dispute(referee);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CANNOT_DISPUTE_OWN_RESULT');
    expect((await result())!.match_result_status).toBe('verified');
  });

  /**
   * 🆕 แก้ข้อความ 7 ต.ค. 2569 (FE ทักมา · มติ ② ก)
   *
   * ข้อความเดิมบอกว่า "ให้แก้ผลทับพร้อมระบุเหตุผล" — แต่บล็อกนี้ผลถูก verify ไปแล้ว
   * ⇒ ส่งใหม่ทับไม่ได้ (MATCH_RESULT_ALREADY_VERIFIED) · override ก็ไม่ได้
   *   (RESULT_NOT_OVERRIDABLE และ onsite ยังติด OVERRIDE_ONSITE_NOT_ALLOWED อีกชั้น)
   * ⇒ คำแนะนำเดิมพาไปทางตัน ซึ่งแย่กว่าไม่แนะนำอะไรเลย
   *
   * ★ ตัวแยกคือ **สถานะของผล** ไม่ใช่โหมด · `extra` ส่งทั้งสองค่ากลับไปให้ FE พาไปจอที่ถูก
   */
  it('ผลถูกยืนยันแล้ว → ข้อความต้องไม่บอกให้แก้ผลทับ แต่ชี้ไปทางที่ทำได้จริง', async () => {
    const res = await dispute(referee);

    expect(res.body.error.message).not.toContain('แก้ผลทับ');
    expect(res.body.error.message).toContain('ให้หัวหน้าทีมหรือกรรมการอีกคนเป็นผู้โต้แย้ง');
    // ★ errorHandler กระจาย extra เข้าไปใน error ตรง ๆ (`...err.extra`) ไม่ได้ห่อไว้อีกชั้น
    expect(res.body.error).toMatchObject({ resultStatus: 'verified', mode: 'onsite' });
  });

  /**
   * ★ ด่านนี้ต้องแคบ — ปิดแค่ "คนส่ง" ไม่ใช่กรรมการทั้งหมด
   *   หัวหน้าทีมที่กด verify ไปแล้ว ยังโต้แย้งได้ (เขาไม่ใช่คนส่ง) และนั่นคือเจตนาเดิมของ BR-14
   *   ถ้าเทสนี้แดง แปลว่าด่านกว้างเกินและปิดทางค้านที่ควรมี
   */
  it('หัวหน้าทีมที่ยืนยันผลไปแล้ว ยังโต้แย้งได้ (ไม่ใช่คนส่ง)', async () => {
    expect((await dispute(leaderA)).status).toBeLessThan(300);
    expect((await result())!.match_result_status).toBe('disputed');
  });

  it('โต้แย้งซ้ำระหว่างที่ยังไม่ตัดสิน → 409 DISPUTE_ALREADY_ACTIVE', async () => {
    expect((await dispute(leaderB)).status).toBeLessThan(300);
    const again = await dispute(leaderB);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('DISPUTE_ALREADY_ACTIVE');
  });

  it('พ้นเวลาที่ทัวร์กำหนด (นับจากเวลายืนยัน) → 409 DISPUTE_WINDOW_CLOSED', async () => {
    await testDb().query('UPDATE tournaments SET dispute_window_hours = 1 WHERE tournament_id = ?', [tour]);
    await testDb().query('UPDATE match_results SET verified_at = NOW() - INTERVAL 2 HOUR WHERE match_id = ?', [match]);
    const res = await dispute(leaderB);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISPUTE_WINDOW_CLOSED');
    expect((await result())!.match_result_status).toBe('verified');
  });

  it('ไม่มีเหตุผล → 400', async () => {
    expect((await as(leaderB).post(`/matches/${match}/result/dispute`).send({})).status).toBe(400);
    expect((await result())!.match_result_status).toBe('verified');
  });

  describe('ตัดสินข้อพิพาท — ผู้จัดก่อน · แอดมินมหาวิทยาลัยหลัง 48 ชม.', () => {
    let uniAdmin: TestUser;
    beforeEach(async () => {
      expect((await dispute(leaderB)).status).toBeLessThan(300);
      uniAdmin = await createUser();
      await makeAdmin(uniAdmin.id, 'university_wide');
    });

    const resolve = (who: TestUser) =>
      as(who).post(`/matches/${match}/result/resolve`).send({ resolution: 'uphold', resolutionNote: 'ตรวจวิดีโอแล้ว ผลถูกต้อง' });

    it.each([
      ['หัวหน้าทีมที่โต้แย้ง', () => leaderB],
      ['หัวหน้าทีมที่ชนะ', () => leaderA],
      ['กรรมการของแมตช์', () => referee],
    ])('%s ตัดสินเอง → 403 · ยัง disputed', async (_label, who) => {
      expect((await resolve(who())).status).toBe(403);
      expect((await result())!.match_result_status).toBe('disputed');
    });

    it('แอดมินมหาวิทยาลัยก่อนครบ 48 ชม. → 403 ORGANIZER_STILL_HAS_TIME', async () => {
      const res = await resolve(uniAdmin);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ORGANIZER_STILL_HAS_TIME');
      expect((await result())!.match_result_status).toBe('disputed');
    });

    it('แอดมินคณะ → 403 แม้พ้น 48 ชม.', async () => {
      const facAdmin = await createUser();
      await makeAdmin(facAdmin.id, 'faculty', await createFaculty());
      await testDb().query('UPDATE match_results SET dispute_raised_at = NOW() - INTERVAL 49 HOUR WHERE match_id = ?', [match]);
      expect((await resolve(facAdmin)).status).toBe(403);
    });

    it('ผู้จัดตัดสินยืนผลเดิม → กลับเป็น verified', async () => {
      expect((await resolve(organizer)).status).toBe(200);
      expect((await result())!.match_result_status).toBe('verified');
    });

    it('พ้น 48 ชม. แล้ว แอดมินมหาวิทยาลัยตัดสินแทนได้', async () => {
      await testDb().query('UPDATE match_results SET dispute_raised_at = NOW() - INTERVAL 49 HOUR WHERE match_id = ?', [match]);
      expect((await resolve(uniAdmin)).status).toBe(200);
      expect((await result())!.match_result_status).toBe('verified');
    });
  });
});
