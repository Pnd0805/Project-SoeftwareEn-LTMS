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

  /**
   * 🆕 BE-40 (7 ต.ค. 2569 · มติ ⑥ ค) — แอดมินที่เป็นผู้จัด อนุมัติคำขอของตัวเองได้
   *
   * มติ ค = **ไม่บล็อก** แต่ต้องไม่ให้ประวัติอ่านเหมือนมีคนที่สองตรวจ
   *   เหตุผลที่ไม่บล็อก: ระบบอาจมีแอดมินมหาวิทยาลัยคนเดียว และ root อนุมัติ amendment แทน
   *   ไม่ได้ (`adminCoversEligibility` คืน false สำหรับ root ตาม OD-34) ⇒ บล็อกแล้วตันถาวร
   *   และทีมถือมติไว้แล้วตั้งแต่ 18 ก.ย. ข้อ 8 ว่าแอดมินอนุมัติทัวร์ที่ตัวเองสร้างได้
   *
   * ★ เทสนี้ต้องเป็น integration ไม่ใช่ unit — ป้ายคิดจาก `requested_by` ที่ต้องมาจาก SQL
   *   ถ้าใครลบคอลัมน์นั้นออกจาก SELECT ฝั่ง unit (ที่ mock แถว) จะยังเขียวแต่ของจริงเป็น false เสมอ
   */
  describe('ผู้จัดที่เป็นแอดมินด้วย อนุมัติคำขอของตัวเอง (BE-40)', () => {
    const amendments = (who: TestUser) => as(who).get(`/tournaments/${tour}/amendment-requests`);
    const auditDetails = async () => (await one<{ details: unknown }>(
      `SELECT details FROM audit_logs WHERE action_type = 'tournament_amendment_approved' AND entity_id = ?`, [amendment]))!.details;

    it('อนุมัติได้ (ไม่บล็อก) · ติดป้าย selfApproved ทั้งใน response และ audit log', async () => {
      await makeAdmin(organizer.id, 'university_wide');

      expect((await as(organizer).post(`/amendment-requests/${amendment}/approve`)).status).toBe(200);
      expect(await maxTeams()).toBe(20);

      const list = await amendments(organizer);
      expect(list.body.items[0]).toMatchObject({ id: amendment, status: 'approved', selfApproved: true });
      expect(await auditDetails()).toMatchObject({ selfApproved: true });
    });

    /** ★ เคสตรงข้าม — มีคนที่สองตรวจจริง ป้ายต้องไม่ติด ไม่งั้นป้ายไม่มีความหมาย */
    it('คนอื่นอนุมัติ → selfApproved: false ทั้งสองที่', async () => {
      expect((await as(facAdmin).post(`/amendment-requests/${amendment}/approve`)).status).toBe(200);

      const list = await amendments(organizer);
      expect(list.body.items[0]).toMatchObject({ id: amendment, status: 'approved', selfApproved: false });
      expect(await auditDetails()).toMatchObject({ selfApproved: false });
    });

    /** ★ ยังไม่ถูกพิจารณา → false ไม่ใช่ null (FE เอาไปวางบนป้ายตรง ๆ · "ยังไม่ตัดสิน" ดูที่ status) */
    it('ยังรอพิจารณา → selfApproved: false', async () => {
      const list = await amendments(organizer);
      expect(list.body.items[0]).toMatchObject({ status: 'pending', selfApproved: false });
    });

    /**
     * ★ คิวของแอดมินต้องเตือน**ก่อน**กด — ป้ายหลังกดช่วยคนอ่านประวัติ ไม่ได้ช่วยคนที่กำลังจะกด
     */
    it('คิวของแอดมิน: คำขอที่ตัวเองยื่น → selfRequested: true · ของคนอื่น → false', async () => {
      await makeAdmin(organizer.id, 'university_wide');

      const mine = await as(organizer).get('/admin/amendment-requests');
      expect(mine.status).toBe(200);
      expect(mine.body.items.find((i: { id: number }) => i.id === amendment)).toMatchObject({ selfRequested: true });

      const theirs = await as(uniAdmin).get('/admin/amendment-requests');
      expect(theirs.body.items.find((i: { id: number }) => i.id === amendment)).toMatchObject({ selfRequested: false });
    });
  });

  /**
   * 🆕 FE-39 (7 ต.ค. 2569 · มติ ④ ก) — ดูผลกระทบก่อนยื่น (dry run)
   *
   * FE รายงานว่าไม่มีสัญญาสำหรับดูผลกระทบล่วงหน้า ⇒ ผู้จัดต้องกดส่งจริงก่อนจึงจะรู้ว่า
   * การแก้นี้ทำให้ทีมที่อนุมัติไปแล้วผิดเงื่อนไขย้อนหลังกี่ทีม — เป็นปุ่มที่ต้องเดาผล
   *
   * ★ สิ่งที่เทสชุดนี้ต้องตรึงให้ได้สองอย่าง
   *     ① ไม่เขียนอะไรลงฐานเลย (ถ้าเขียน มันไม่ใช่ preview)
   *     ② ตอบ**ตรงกับของจริง** — ใช้ด่านชุดเดียวกัน ไม่ใช่กฎที่เขียนซ้ำ
   *   ข้อ ② สำคัญกว่า: preview ที่บอกว่า "ผ่าน" แล้วของจริงไม่ผ่าน แย่กว่าไม่มี preview
   */
  describe('ดูผลกระทบก่อนยื่น — POST /amendment-requests/preview (FE-39)', () => {
    const preview = (who: TestUser, changes: Record<string, unknown>) =>
      as(who).post(`/tournaments/${tour}/amendment-requests/preview`)
        .send({ requestedChanges: changes, reason: 'อยากดูผลกระทบก่อน' });
    const amendmentCount = async () => (await all('SELECT 1 FROM tournament_amendment_requests')).length;

    /** ★ `beforeEach` ของบล็อกนี้ยื่นไปแล้วหนึ่งใบ ⇒ สถานะตั้งต้นคือ "มีใบค้าง" */
    it('มีใบค้างอยู่ → canSubmit false พร้อมเลขใบที่ค้าง · ไม่ใช่ blocker ของเนื้อหา', async () => {
      const res = await preview(organizer, { maxTeams: 24 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ canSubmit: false, blockers: [], pendingAmendmentId: amendment });
    });

    it('ไม่มีใบค้าง และการแก้ไม่กระทบใคร → canSubmit true', async () => {
      expect((await as(facAdmin).post(`/amendment-requests/${amendment}/reject`).send({ reason: 'x' })).status).toBe(200);

      const res = await preview(organizer, { maxTeams: 24 });

      expect(res.body).toEqual({ canSubmit: true, blockers: [], pendingAmendmentId: null });
    });

    /**
     * ★ เคสที่ FE ขอมาตรง ๆ — บอกชื่อทีมและเหตุผลรายคน **ก่อน**กดยื่น
     *   ทีมของ leaderA ถูกอนุมัติแล้วและผู้เล่นเป็นชาย ⇒ เปลี่ยนเป็น "หญิงเท่านั้น" แล้วชน
     */
    it('การแก้ทำให้ทีมที่อนุมัติแล้วผิดเงื่อนไข → บอกจำนวนทีมและเหตุผลรายคน · ไม่เขียนอะไรลงฐาน', async () => {
      expect((await as(facAdmin).post(`/amendment-requests/${amendment}/reject`).send({ reason: 'x' })).status).toBe(200);
      const app = await insert('tournament_applications',
        { tournament_id: tour, team_id: teamA, tournament_application_status: 'approved' });
      await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: leaderA.id });
      const before = await amendmentCount();

      const res = await preview(organizer, { genderRequirement: 'female' });

      expect(res.status).toBe(200);
      expect(res.body.canSubmit).toBe(false);
      expect(res.body.blockers).toEqual([expect.objectContaining({
        code: 'AMENDMENT_BREAKS_APPROVED_TEAMS',
        details: expect.objectContaining({
          affectedTeamCount: 1,
          affectedTeams: [expect.objectContaining({
            teamId: teamA,
            players: [expect.objectContaining({ userId: leaderA.id, reason: 'gender' })],
          })],
        }),
      })]);
      // ★ ① dry run จริง — ไม่มีใบใหม่เกิดขึ้น
      expect(await amendmentCount()).toBe(before);
    });

    /**
     * ★ ② หลักฐานว่า preview ตอบตรงกับของจริง — ยิงของจริงต่อท้ายด้วย payload เดียวกัน
     *   แล้วรหัสต้องตรงกัน · ถ้าวันหน้ามีคนเพิ่มด่านในเส้นจริงแต่ลืมเพิ่มใน preview เทสนี้จะแดง
     */
    it('preview บอก blocker อะไร ยื่นจริงต้องได้รหัสเดียวกัน', async () => {
      expect((await as(facAdmin).post(`/amendment-requests/${amendment}/reject`).send({ reason: 'x' })).status).toBe(200);
      const app = await insert('tournament_applications',
        { tournament_id: tour, team_id: teamA, tournament_application_status: 'approved' });
      await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: leaderA.id });

      const dry = await preview(organizer, { genderRequirement: 'female' });
      const real = await as(organizer).post(`/tournaments/${tour}/amendment-requests`)
        .send({ requestedChanges: { genderRequirement: 'female' }, reason: 'อยากดูผลกระทบก่อน' });

      expect(real.status).toBe(409);
      expect(real.body.error.code).toBe(dry.body.blockers[0].code);
    });

    it.each([
      ['ผู้ใช้ทั่วไป', () => stranger],
      ['ผู้จัดทัวร์อื่น', () => otherOrganizer],
    ])('%s → 403 (ด่านสิทธิ์ชุดเดียวกับการยื่นจริง)', async (_label, who) => {
      expect((await preview(who(), { maxTeams: 24 })).status).toBe(403);
    });

    it('เนื้อหาผิด schema → 400 เหมือนเส้นจริง (ไม่ใช่ preview ที่หลวมกว่า)', async () => {
      expect((await preview(organizer, { maxTeams: -5 })).status).toBe(400);
    });
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
