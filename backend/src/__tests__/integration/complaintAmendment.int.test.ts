import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, makeAdmin, type TestUser,
} from './helpers/factories.js';
import { ORG_RESOLVE_HOURS } from '../../config/scoring.js';

/**
 * เรื่องร้องเรียนผล (หลังพ้นช่วงโต้แย้ง) · คำขอแก้ไขทัวร์นาเมนต์ (C09)
 *
 *   ร้องเรียน: หัวหน้าทีม/กรรมการของแมตช์ยื่น → ผู้จัดแนบความเห็น → แอดมินมหาวิทยาลัยตัดสิน
 *   แก้ไขทัวร์: ผู้จัดยื่น → แอดมินที่ครอบขอบเขตอนุมัติ (route มีแค่ requireAuth · ด่านอยู่ใน service)
 */

let faculty: number;
let otherFaculty: number;
let organizer: TestUser;
let otherOrganizer: TestUser;
let referee: TestUser;
let leaderA: TestUser;
let leaderB: TestUser;
let stranger: TestUser;
let uniAdmin: TestUser;
let facAdmin: TestUser;
let otherFacAdmin: TestUser;
let tour: number;
let teamA: number;
let teamB: number;
let match: number;

beforeEach(async () => {
  faculty = await createFaculty();
  otherFaculty = await createFaculty();
  const sport = await createSportType();
  organizer = await createUser();
  otherOrganizer = await createUser();
  referee = await createUser();
  leaderA = await createUser();
  leaderB = await createUser();
  stranger = await createUser();
  uniAdmin = await createUser();
  facAdmin = await createUser();
  otherFacAdmin = await createUser();
  await makeAdmin(uniAdmin.id, 'university_wide');
  await makeAdmin(facAdmin.id, 'faculty', faculty);
  await makeAdmin(otherFacAdmin.id, 'faculty', otherFaculty);

  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  await createTournament({ organizer: otherOrganizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  teamA = await createTeam({ leader: leaderA.id, sportTypeId: sport });
  teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport });
  match = await createMatch({ tournamentId: tour, teamA, teamB, status: 'completed' });
  const refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
  await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });

  // ผลที่ยืนยันแล้วเมื่อ 2 วันก่อน · ทัวร์ให้โต้แย้งได้ 24 ชม. ⇒ พ้นช่วงโต้แย้งแล้ว ต้องใช้การร้องเรียน
  await testDb().query('UPDATE tournaments SET dispute_window_hours = 24 WHERE tournament_id = ?', [tour]);
  await insert('match_results', {
    match_id: match, winner_team_id: teamA, score_data: JSON.stringify({ [teamA]: 3, [teamB]: 1 }),
    submitted_by_user_id: referee.id, submitted_role: 'referee', match_result_status: 'verified',
    verified_by_user_id: leaderA.id, verified_at: new Date(Date.now() - 48 * 3600_000),
  });
});

// ───────────────────────────── ร้องเรียน ─────────────────────────────

const file = (who: TestUser, body: Record<string, unknown> = { reason: 'กรรมการนับประตูผิด มีคลิปยืนยัน' }) =>
  as(who).post(`/matches/${match}/result/complaints`).send(body);
const complaints = () => all<{ match_result_complaint_id: number; filed_by: number }>(
  'SELECT match_result_complaint_id, filed_by FROM match_result_complaints');

describe('ยื่นเรื่องร้องเรียน — เฉพาะคู่กรณีของแมตช์ และหลังพ้นช่วงโต้แย้ง', () => {
  it.each([
    ['หัวหน้าทีมที่แพ้', () => leaderB],
    ['กรรมการของแมตช์', () => referee],
  ])('%s ยื่นได้ · บันทึกผู้ยื่นเป็นคนที่ล็อกอิน', async (_label, who) => {
    expect((await file(who())).status).toBe(201);
    expect(await complaints()).toEqual([expect.objectContaining({ filed_by: who().id })]);
  });

  it.each([
    ['คนนอก', () => stranger],
    ['ผู้จัดของทัวร์ (ผู้จัดแนบความเห็นได้ ไม่ใช่ผู้ยื่น)', () => organizer],
  ])('%s ยื่น → 403 NOT_COMPLAINT_PARTY · ไม่มีเรื่อง', async (_label, who) => {
    const res = await file(who());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_COMPLAINT_PARTY');
    expect(await complaints()).toEqual([]);
  });

  it('ยังอยู่ในช่วงโต้แย้ง → 409 USE_DISPUTE_INSTEAD', async () => {
    await testDb().query('UPDATE match_results SET verified_at = NOW() WHERE match_id = ?', [match]);
    const res = await file(leaderB);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USE_DISPUTE_INSTEAD');
  });

  it('🔒 หลักฐานเป็นไฟล์ของแมตช์อื่น → 400 · ไม่มีเรื่อง', async () => {
    const res = await file(leaderB, { reason: 'ดูคลิป', evidenceKeys: [`dispute_evidence/${match + 1}/clip.mp4`] });
    expect(res.status).toBe(400);
    expect(await complaints()).toEqual([]);
  });
});

describe('อ่าน · ความเห็นผู้จัด · คำตัดสิน', () => {
  let complaint: number;
  beforeEach(async () => {
    expect((await file(leaderB)).status).toBe(201);
    complaint = (await complaints())[0]!.match_result_complaint_id;
  });
  const row = () => one<{ complaint_status: string; organizer_statement: string | null; decided_by: number | null }>(
    'SELECT complaint_status, organizer_statement, decided_by FROM match_result_complaints WHERE match_result_complaint_id = ?', [complaint]);

  it('อ่าน: ผู้ยื่น/ผู้จัด/แอดมินมหาวิทยาลัยได้ · คนนอกไม่ได้', async () => {
    for (const who of [leaderB, organizer, uniAdmin]) expect((await as(who).get(`/match-result-complaints/${complaint}`)).status).toBe(200);
    expect((await as(stranger).get(`/match-result-complaints/${complaint}`)).status).toBe(403);
  });

  it('ความเห็นผู้จัด: ผู้จัดของทัวร์นี้ใส่ได้ · คู่กรณีและผู้จัดทัวร์อื่นใส่ไม่ได้', async () => {
    for (const who of [leaderA, leaderB, otherOrganizer]) {
      expect((await as(who).put(`/match-result-complaints/${complaint}/statement`).send({ statement: 'ปลอม' })).status).toBe(403);
    }
    expect((await row())!.organizer_statement).toBeNull();
    expect((await as(organizer).put(`/match-result-complaints/${complaint}/statement`).send({ statement: 'ตรวจคลิปแล้ว' })).status).toBe(200);
    expect((await row())!.organizer_statement).toBe('ตรวจคลิปแล้ว');
  });

  it.each([
    ['ผู้จัด', () => organizer],
    ['แอดมินคณะ (แม้คณะเดียวกับทัวร์)', () => facAdmin],
    ['ผู้ยื่นเอง', () => leaderB],
  ])('ตัดสิน: %s → 403 · เรื่องยังไม่ถูกตัดสิน', async (_label, who) => {
    const res = await as(who()).post(`/match-result-complaints/${complaint}/decision`).send({ outcome: 'no_merit', note: 'ไม่มีมูล' });
    expect(res.status).toBe(403);
    expect((await row())!.decided_by).toBeNull();
  });

  it('ตัดสิน: แอดมินมหาวิทยาลัย ระหว่างที่ผู้จัดยังมีเวลาแนบความเห็น → 403 ORGANIZER_STILL_HAS_TIME', async () => {
    const res = await as(uniAdmin).post(`/match-result-complaints/${complaint}/decision`).send({ outcome: 'no_merit', note: 'ไม่มีมูล' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORGANIZER_STILL_HAS_TIME');
    expect((await row())!.decided_by).toBeNull();
  });

  it('ตัดสิน: พ้นเวลาของผู้จัดแล้ว → แอดมินมหาวิทยาลัยตัดสินได้ · บันทึกผู้ตัดสิน', async () => {
    // ★ เวลาของผู้จัดนับจาก created_at เสมอ (escalatesAt) — แนบความเห็นแล้วก็ไม่ได้ปลดล็อกเร็วขึ้น
    await testDb().query(
      'UPDATE match_result_complaints SET created_at = NOW() - INTERVAL ? HOUR WHERE match_result_complaint_id = ?',
      [ORG_RESOLVE_HOURS + 1, complaint]);
    const res = await as(uniAdmin).post(`/match-result-complaints/${complaint}/decision`).send({ outcome: 'no_merit', note: 'ไม่มีมูล' });
    expect(res.status).toBe(200);
    expect((await row())!.decided_by).toBe(uniAdmin.id);
  });

  it('เรื่องไม่มีมูลแต่ขอแก้ผล → 400 (schema กันไว้)', async () => {
    const res = await as(uniAdmin).post(`/match-result-complaints/${complaint}/decision`).send({
      outcome: 'no_merit', remedy: 'amend_result', note: 'x', winnerTeamId: teamB, scoreData: { [teamA]: 1, [teamB]: 3 },
    });
    expect(res.status).toBe(400);
    expect((await row())!.decided_by).toBeNull();
  });
});

// ───────────────────────────── คำขอแก้ไขทัวร์ ─────────────────────────────

describe('คำขอแก้ไขทัวร์นาเมนต์ — ผู้จัดยื่น · แอดมินที่ครอบขอบเขตอนุมัติ', () => {
  let amendment: number;
  const request = (who: TestUser) => as(who).post(`/tournaments/${tour}/amendment-requests`)
    .send({ requestedChanges: { maxTeams: 20 }, reason: 'มีทีมสนใจเยอะ' });
  const maxTeams = async () =>
    (await one<{ max_teams: number }>('SELECT max_teams FROM tournaments WHERE tournament_id = ?', [tour]))!.max_teams;

  beforeEach(async () => {
    await insert('tournament_eligibility_rules', { tournament_id: tour, rule_type: 'faculty', rule_value: faculty });
    expect((await request(organizer)).status).toBe(201);
    amendment = (await one<{ id: number }>('SELECT tournament_amendment_request_id AS id FROM tournament_amendment_requests'))!.id;
  });

  it('ผู้จัดทัวร์อื่นยื่นแก้ทัวร์นี้ → 403', async () => {
    expect((await request(otherOrganizer)).status).toBe(403);
    expect(await all('SELECT 1 FROM tournament_amendment_requests')).toHaveLength(1);
  });

  /**
   * 🆕 BE-38 (7 ต.ค. 2569 · มติ ⑦ ค) — ยื่นคำขอเนื้อหาเดิมซ้ำได้ 201 ทั้งสองครั้ง
   *   และใบที่สองยังค้างหลังใบแรกอนุมัติแล้ว (baseline ทัวร์ 14 มี 3 ใบเหมือนกันค้างอยู่)
   *   ⇒ แอดมินอ่านเรื่องเดียวกันหลายรอบ และอนุมัติใบที่สองจะทับการแก้ของใบแรกโดยไม่มีใครรู้
   *
   * ★ `beforeEach` ของบล็อกนี้ยื่นไปแล้วหนึ่งใบ ⇒ ใบนี้คือ "ใบที่สอง"
   * ★ สองชั้น: ด่านที่ service ให้ข้อความ · UNIQUE ของ migration 048 กัน race
   */
  it('ยื่นซ้ำขณะใบเดิมยังรอพิจารณา → 409 AMENDMENT_ALREADY_PENDING · มีใบเดียว', async () => {
    const again = await request(organizer);

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('AMENDMENT_ALREADY_PENDING');
    expect(await all('SELECT 1 FROM tournament_amendment_requests')).toHaveLength(1);
  });

  /** ★ ใบเดิมถูกตัดสินแล้ว ต้องยื่นใหม่ได้ — ด่านนี้กัน "ค้างซ้อน" ไม่ใช่กันการยื่นอีกครั้ง */
  it('ใบเดิมถูกปฏิเสธแล้ว → ยื่นใหม่ได้', async () => {
    expect((await as(facAdmin).post(`/amendment-requests/${amendment}/reject`).send({ reason: 'สนามไม่พอ' })).status).toBe(200);

    expect((await request(organizer)).status).toBe(201);
    expect(await all('SELECT 1 FROM tournament_amendment_requests')).toHaveLength(2);
  });

  it.each([
    ['ผู้ใช้ทั่วไป', () => stranger],
    ['ผู้จัดที่ยื่นเอง (อนุมัติคำขอตัวเอง)', () => organizer],
    ['แอดมินคณะอื่น', () => otherFacAdmin],
  ])('อนุมัติ: %s → 403 · ทัวร์ไม่เปลี่ยน', async (_label, who) => {
    expect((await as(who()).post(`/amendment-requests/${amendment}/approve`)).status).toBe(403);
    expect(await maxTeams()).toBe(16);
  });

  it('อนุมัติ: แอดมินคณะเดียวกัน (ทัวร์จำกัดเฉพาะคณะนี้) → ทัวร์เปลี่ยนจริง', async () => {
    expect((await as(facAdmin).post(`/amendment-requests/${amendment}/approve`)).status).toBe(200);
    expect(await maxTeams()).toBe(20);
  });

  it('อนุมัติซ้ำ → 409 ALREADY_DECIDED', async () => {
    expect((await as(uniAdmin).post(`/amendment-requests/${amendment}/approve`)).status).toBe(200);
    expect((await as(uniAdmin).post(`/amendment-requests/${amendment}/approve`)).status).toBe(409);
  });

  it('ปฏิเสธต้องมีเหตุผล · ปฏิเสธแล้วทัวร์ไม่เปลี่ยน', async () => {
    expect((await as(uniAdmin).post(`/amendment-requests/${amendment}/reject`).send({})).status).toBe(400);
    expect((await as(uniAdmin).post(`/amendment-requests/${amendment}/reject`).send({ reason: 'สนามไม่พอ' })).status).toBe(200);
    expect(await maxTeams()).toBe(16);
  });
});
