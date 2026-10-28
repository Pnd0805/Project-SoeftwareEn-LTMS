import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, makeAdmin,
  type TestUser,
} from './helpers/factories.js';

/**
 * ยกเลิกทัวร์ (migration 053 · มติ 28 ต.ค. 2569)
 *
 *   ผู้จัด / แอดมินมหาวิทยาลัยกดยกเลิก (เหตุผลบังคับ) → สถานะ cancelled · ทุกอย่าง "แช่แข็ง" ไม่ล้าง
 *   แจ้งทุกคนที่ทัวร์มีผลกับเขา ยกเว้นคนกด · ทุกคนเปิดดูได้ · ผู้เล่นถูกปลดล็อก
 *   ยังใช้ได้: ความเห็น · ประกาศ · รีวิวผู้จัด (7 วัน) — ที่เหลือ 409 TOURNAMENT_CANCELLED
 *   ยกเลิกแล้วย้อนไม่ได้ (ตัดระบบกู้คืนออก 28 ต.ค. — กันกดผิดด้วยการยืนยันหลายชั้นที่ FE)
 *
 * ★ ต้องเป็น integration เพราะการ "แช่แข็ง" กระจายอยู่หลายชั้น (middleware · service · SQL ของ repo)
 *   unit ที่ mock repo ทิ้งจะไม่เห็นว่าเส้นไหนหลุด
 */

let organizer: TestUser;
let leaderA: TestUser;     // ทีม A ผ่านแล้ว · หัวหน้าลงแข่งด้วย
let playerA: TestUser;     // ผู้เล่นในรายชื่อทีม A
let leaderB: TestUser;     // ทีม B ผ่านแล้ว
let leaderC: TestUser;     // ทีม C ใบสมัครยัง pending
let referee: TestUser;     // กรรมการที่ตอบรับแล้ว
let invitedRef: TestUser;  // กรรมการที่ยังไม่ตอบคำเชิญ
let picker: TestUser;      // คนดูที่ทายผลไว้
let fan: TestUser;         // คนดูที่ไม่เกี่ยวอะไรเลย
let uniAdmin: TestUser;
let facultyAdmin: TestUser;
let tour: number;
let teamA: number;
let teamB: number;
let appA: number;
let appC: number;
let match: number;
let invitationId: number;

const reasonText = 'สนามปิดซ่อมกะทันหัน';
const cancel = (who: TestUser, reason: unknown = reasonText, id = tour) => as(who).post(`/tournaments/${id}/cancel`).send({ reason });
const tournamentRow = (id = tour) => one<{
  tournament_status: string; cancelled_from_status: string | null; cancel_reason: string | null;
  cancelled_by: number | null; cancelled_at: Date | null; registration_open: number;
}>('SELECT tournament_status, cancelled_from_status, cancel_reason, cancelled_by, cancelled_at, registration_open FROM tournaments WHERE tournament_id = ?', [id]);
const notifiedOf = (type: string) => all<{ user_id: number }>(
  'SELECT user_id FROM notifications WHERE type = ? AND related_entity_id = ? ORDER BY user_id', [type, tour])
  .then(rows => rows.map(r => r.user_id));

beforeEach(async () => {
  const faculty = await createFaculty();
  const sport = await createSportType({ minMembers: 1, maxMembers: 10 });
  organizer = await createUser();
  leaderA = await createUser();
  playerA = await createUser();
  leaderB = await createUser();
  leaderC = await createUser();
  referee = await createUser();
  invitedRef = await createUser();
  picker = await createUser();
  fan = await createUser();
  uniAdmin = await createUser();
  facultyAdmin = await createUser();
  await makeAdmin(uniAdmin.id, 'university_wide');
  await makeAdmin(facultyAdmin.id, 'faculty', faculty);

  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public', registrationOpen: true });
  teamA = await createTeam({ leader: leaderA.id, sportTypeId: sport, members: [playerA.id] });
  teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport });
  const teamC = await createTeam({ leader: leaderC.id, sportTypeId: sport });
  appA = await insert('tournament_applications', { tournament_id: tour, team_id: teamA, tournament_application_status: 'approved' });
  await insert('application_players', { tournament_application_id: appA, tournament_id: tour, user_id: leaderA.id });
  await insert('application_players', { tournament_application_id: appA, tournament_id: tour, user_id: playerA.id });
  const appB = await insert('tournament_applications', { tournament_id: tour, team_id: teamB, tournament_application_status: 'approved' });
  await insert('application_players', { tournament_application_id: appB, tournament_id: tour, user_id: leaderB.id });
  appC = await insert('tournament_applications', { tournament_id: tour, team_id: teamC, tournament_application_status: 'pending' });
  await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
  invitationId = await addTournamentReferee({ tournamentId: tour, userId: invitedRef.id, invitedBy: organizer.id, invitationStatus: 'pending' });

  match = await createMatch({ tournamentId: tour, teamA, teamB, scheduledAt: new Date(Date.now() + 48 * 3600_000) });
  const pick = await as(picker).post(`/matches/${match}/predictions`).send({ scoreData: { [teamA]: 2, [teamB]: 1 } });
  expect(pick.status).toBeLessThan(300);
});

describe('POST /tournaments/:id/cancel — ใครกดได้ · เมื่อไร', () => {
  it('ผู้จัดยกเลิกได้ → 200 · สถานะ cancelled · เก็บสถานะเดิม เหตุผล คนกด · ปิดรับสมัคร · audit', async () => {
    const res = await cancel(organizer);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: tour, status: 'cancelled', fromStatus: 'public', reason: reasonText, cancelledBy: 'organizer' });

    expect(await tournamentRow()).toMatchObject({
      tournament_status: 'cancelled', cancelled_from_status: 'public', cancel_reason: reasonText,
      cancelled_by: organizer.id, registration_open: 0,
    });
    expect((await tournamentRow())!.cancelled_at).not.toBeNull();

    const audit = await one<{ user_id: number; details: unknown }>(
      `SELECT user_id, details FROM audit_logs WHERE action_type = 'tournament_cancelled' AND entity_id = ?`, [tour]);
    expect(audit).toMatchObject({ user_id: organizer.id });
    expect(audit!.details).toMatchObject({ reason: reasonText, fromStatus: 'public', byRole: 'organizer' });
  });

  it('★ แช่แข็ง ไม่ล้าง — แมตช์ ใบสมัคร รายชื่อ และใบทายผลอยู่ครบเหมือนเดิม', async () => {
    const before = await all('SELECT match_id, match_status, team_a_id, team_b_id FROM matches WHERE tournament_id = ?', [tour]);
    await cancel(organizer);
    expect(await all('SELECT match_id, match_status, team_a_id, team_b_id FROM matches WHERE tournament_id = ?', [tour])).toEqual(before);
    expect(await all(`SELECT tournament_application_status AS s FROM tournament_applications WHERE tournament_id = ? ORDER BY tournament_application_id`, [tour]))
      .toEqual([{ s: 'approved' }, { s: 'approved' }, { s: 'pending' }]);
    expect(await all('SELECT user_id FROM application_players WHERE tournament_id = ?', [tour])).toHaveLength(3);
    expect(await all('SELECT 1 FROM pickem_predictions WHERE match_id = ?', [match])).toHaveLength(1);
  });

  it('แจ้งหัวหน้าทุกทีม (รวม pending) · ผู้เล่นในรายชื่อ · กรรมการ (รวมที่ยังไม่ตอบ) · คนทายผล — ไม่แจ้งผู้จัดที่กดเอง ไม่แจ้งคนนอก', async () => {
    await cancel(organizer);
    const expected = [leaderA, playerA, leaderB, leaderC, referee, invitedRef, picker].map(u => u.id).sort((a, b) => a - b);
    expect(await notifiedOf('tournament_cancelled')).toEqual(expected);
    const one_ = await one<{ message: string }>(`SELECT message FROM notifications WHERE type = 'tournament_cancelled' AND user_id = ?`, [leaderC.id]);
    expect(one_!.message).toContain(reasonText);
  });

  it('แอดมินมหาวิทยาลัยกดแทนได้ → ผู้จัดได้รับแจ้งด้วย · แอดมินไม่ได้รับ', async () => {
    const res = await cancel(uniAdmin, 'ผู้จัดติดต่อไม่ได้');
    expect(res.status).toBe(200);
    expect(res.body.cancelledBy).toBe('admin');
    const notified = await notifiedOf('tournament_cancelled');
    expect(notified).toContain(organizer.id);
    expect(notified).not.toContain(uniAdmin.id);
  });

  it.each([
    ['แอดมินคณะ', () => facultyAdmin],
    ['หัวหน้าทีมที่สมัคร', () => leaderA],
    ['คนทั่วไป', () => fan],
  ])('🔒 %s → 403 NOT_ORGANIZER · ไม่มีอะไรเปลี่ยน', async (_label, who) => {
    const res = await cancel(who());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ORGANIZER');
    expect((await tournamentRow())!.tournament_status).toBe('public');
  });

  it('ไม่ล็อกอิน → 401', async () => {
    expect((await anon.post(`/tournaments/${tour}/cancel`).send({ reason: 'x' })).status).toBe(401);
  });

  it.each([
    ['ไม่ส่งเหตุผล', undefined],
    ['เหตุผลว่าง (มีแต่ช่องว่าง)', '   '],
    ['เหตุผลยาวเกิน 255', 'ก'.repeat(256)],
  ])('400 VALIDATION_FAILED — %s', async (_label, reason) => {
    // ส่ง body เองตรง ๆ — ถ้าผ่าน cancel() ค่า undefined จะไปตกค่าเริ่มต้นของพารามิเตอร์
    const res = await as(organizer).post(`/tournaments/${tour}/cancel`).send(reason === undefined ? {} : { reason });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect((await tournamentRow())!.tournament_status).toBe('public');
  });

  it('เหตุผลยาวพอดี 255 ผ่าน · ตัดช่องว่างหัวท้าย', async () => {
    expect((await cancel(organizer, `  ${'ข'.repeat(255)}  `)).status).toBe(200);
    expect((await tournamentRow())!.cancel_reason).toBe('ข'.repeat(255));
  });

  it('ทัวร์ private (อนุมัติแล้วแต่ยังไม่เผยแพร่) ยกเลิกได้ · บันทึกสถานะเดิมเป็นประวัติ', async () => {
    await testDb().query(`UPDATE tournaments SET tournament_status = 'private' WHERE tournament_id = ?`, [tour]);
    expect((await cancel(organizer)).body.fromStatus).toBe('private');
    expect(await tournamentRow()).toMatchObject({ tournament_status: 'cancelled', cancelled_from_status: 'private' });
  });

  it('ทัวร์ที่ปิดแล้ว → 409 TOURNAMENT_COMPLETED', async () => {
    await testDb().query(`UPDATE tournaments SET tournament_status = 'completed', completed_at = NOW() WHERE tournament_id = ?`, [tour]);
    const res = await cancel(organizer);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOURNAMENT_COMPLETED');
  });

  it('ยกเลิกซ้ำ → 409 TOURNAMENT_CANCELLED · ไม่แจ้งซ้ำ', async () => {
    await cancel(organizer);
    const res = await cancel(uniAdmin);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOURNAMENT_CANCELLED');
    expect(await notifiedOf('tournament_cancelled')).toHaveLength(7);
  });

  it('ทัวร์ที่ยังรออนุมัติ → แอดมินได้ 409 INVALID_STATUS_TRANSITION (ให้ใช้ลบแทน)', async () => {
    await testDb().query(`UPDATE tournaments SET tournament_status = 'pending_approval' WHERE tournament_id = ?`, [tour]);
    const res = await cancel(uniAdmin);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });
});

describe('หลังยกเลิก — ทุกคนเปิดดูได้ พร้อมป้ายและเหตุผล', () => {
  beforeEach(async () => { expect((await cancel(organizer)).status).toBe(200); });

  it('คนไม่ล็อกอินเปิดหน้าทัวร์ได้ · เห็นสถานะ + เหตุผล + ใครกด (ไม่เห็นเลขผู้ใช้)', async () => {
    const res = await anon.get(`/tournaments/${tour}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.cancellation).toMatchObject({ reason: reasonText, cancelledBy: 'organizer' });
    expect(typeof res.body.cancellation.cancelledAt).toBe('string');
  });

  it('เส้นอ่านข้างเคียง (แมตช์ · ทีม) ยังอ่านได้แบบไม่ล็อกอิน', async () => {
    expect((await anon.get(`/tournaments/${tour}/matches`)).status).toBe(200);
    expect((await anon.get(`/matches/${match}`)).status).toBe(200);
  });

  it('รายการสาธารณะ: ?status=cancelled เห็น · ค่าเริ่มต้น (public) ไม่เห็น', async () => {
    const cancelledList = await anon.get('/tournaments?status=cancelled');
    expect(cancelledList.status).toBe(200);
    expect(cancelledList.body.items.map((t: { id: number }) => t.id)).toContain(tour);
    const publicList = await anon.get('/tournaments');
    expect(publicList.body.items.map((t: { id: number }) => t.id)).not.toContain(tour);
  });
});

describe('หลังยกเลิก — แช่แข็งทุก write (409 TOURNAMENT_CANCELLED)', () => {
  beforeEach(async () => { expect((await cancel(organizer)).status).toBe(200); });

  const expectCancelled = (res: { status: number; body: { error?: { code: string } } }) => {
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe('TOURNAMENT_CANCELLED');
  };

  it('ผู้จัดแก้ทัวร์ · เผยแพร่ซ้ำ · เปิดรับสมัคร · ลบ ไม่ได้', async () => {
    expectCancelled(await as(organizer).patch(`/tournaments/${tour}`).send({ venue: 'ที่ใหม่' }));
    expectCancelled(await as(organizer).post(`/tournaments/${tour}/unpublish`));
    expectCancelled(await as(organizer).post(`/tournaments/${tour}/open-registration`));
    expectCancelled(await as(organizer).delete(`/tournaments/${tour}`));
  });

  it('ทายผล / ยกเลิกการทาย ไม่ได้ · ใบเดิมยังอยู่', async () => {
    expectCancelled(await as(fan).post(`/matches/${match}/predictions`).send({ scoreData: { [teamA]: 2, [teamB]: 0 } }));
    expectCancelled(await as(picker).delete(`/matches/${match}/predictions/me`));
    expect(await all('SELECT 1 FROM pickem_predictions WHERE match_id = ?', [match])).toHaveLength(1);
  });

  it('โหวต MVP ไม่ได้ (MVP ไม่มีในทัวร์ที่ถูกยกเลิก)', async () => {
    expectCancelled(await as(fan).post(`/matches/${match}/mvp-votes`).send({ userId: leaderA.id }));
  });

  it('ใบสมัคร: หัวหน้าถอน/ยกเลิก และผู้จัดอนุมัติ/ปฏิเสธ ไม่ได้ (เส้น /applications อยู่นอก lock middleware)', async () => {
    expectCancelled(await as(leaderA).post(`/applications/${appA}/withdraw`));
    expectCancelled(await as(leaderC).post(`/applications/${appC}/cancel`));
    expectCancelled(await as(organizer).post(`/applications/${appC}/approve`));
    expectCancelled(await as(organizer).post(`/applications/${appC}/reject`).send({ reason: 'x' }));
    expect(await all(`SELECT tournament_application_status AS s FROM tournament_applications WHERE tournament_id = ? ORDER BY tournament_application_id`, [tour]))
      .toEqual([{ s: 'approved' }, { s: 'approved' }, { s: 'pending' }]);
  });

  it('สมัครทีมใหม่เข้าทัวร์ไม่ได้', async () => {
    const sport = (await one<{ sport_type_id: number }>('SELECT sport_type_id FROM tournaments WHERE tournament_id = ?', [tour]))!.sport_type_id;
    const teamD = await createTeam({ leader: fan.id, sportTypeId: sport });
    expectCancelled(await as(fan).post(`/tournaments/${tour}/applications`).send({ teamId: teamD, playerIds: [fan.id] }));
  });

  it('กรรมการที่ยังไม่ตอบ: รับคำเชิญไม่ได้ · ปฏิเสธได้', async () => {
    expectCancelled(await as(invitedRef).post(`/referee-invitations/${invitationId}/accept`).send({ matchIds: [] }));
    expect((await as(invitedRef).post(`/referee-invitations/${invitationId}/decline`).send({})).status).toBeLessThan(300);
  });
});

describe('หลังยกเลิก — ที่ยังใช้ได้: ความเห็น · ประกาศ · รีวิวผู้จัด', () => {
  beforeEach(async () => { expect((await cancel(organizer)).status).toBe(200); });

  it('ใครก็ได้ที่ล็อกอินคอมเมนต์ได้ · คนไม่ล็อกอินอ่านได้', async () => {
    expect((await as(fan).post(`/tournaments/${tour}/comments`).send({ content: 'ทำไมยกเลิกครับ' })).status).toBeLessThan(300);
    const list = await anon.get(`/tournaments/${tour}/comments`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain('ทำไมยกเลิกครับ');
  });

  it('ผู้จัดลงประกาศได้', async () => {
    const res = await as(organizer).post(`/tournaments/${tour}/announcements`).send({ title: 'ขออภัย', body: 'จะแจ้งวันใหม่ภายหลัง' });
    expect(res.status).toBeLessThan(300);
  });

  it('ผู้เล่นทีมที่ผ่านรีวิวผู้จัดได้ (ภายใน 7 วันหลังยกเลิก) · GET บอก openedBy = cancelled', async () => {
    expect((await as(playerA).post(`/tournaments/${tour}/feedback`).send({ rating: 2, content: 'ยกเลิกกะทันหัน' })).status).toBeLessThan(300);
    const state = await anon.get(`/tournaments/${tour}/feedback`);
    expect(state.body).toMatchObject({ status: 'open', openedBy: 'cancelled' });
  });

  it('เลย 7 วันหลังยกเลิก → รีวิวไม่ได้ (FEEDBACK_CLOSED)', async () => {
    await testDb().query('UPDATE tournaments SET cancelled_at = NOW() - INTERVAL 8 DAY WHERE tournament_id = ?', [tour]);
    const res = await as(playerA).post(`/tournaments/${tour}/feedback`).send({ rating: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('FEEDBACK_CLOSED');
  });
});

describe("หลังยกเลิก — Pick'em: ใบที่ยังไม่ตัดสินเป็น void", () => {
  it('summary + ของตัวเอง บอก void และ closedReason = tournament_cancelled', async () => {
    await cancel(organizer);
    const summary = await as(picker).get(`/matches/${match}/predictions/summary`);
    expect(summary.body).toMatchObject({ isOpen: false, closedReason: 'tournament_cancelled', mine: { status: 'void' } });
    expect((await as(picker).get(`/matches/${match}/predictions/me`)).body).toMatchObject({ status: 'void' });
  });
});

describe('หลังยกเลิก — ผู้เล่นถูกปลดล็อก (มติข้อ 9)', () => {
  it('ก่อนยกเลิก: เอาผู้เล่นในรายชื่อออกจากทีมไม่ได้ · หลังยกเลิก: ได้ และรายชื่อของทัวร์ที่ถูกยกเลิกยังอยู่เป็นประวัติ', async () => {
    const locked = await as(leaderA).delete(`/teams/${teamA}/members/${playerA.id}`);
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('MEMBER_LOCKED_IN_TOURNAMENT');

    await cancel(organizer);
    expect((await as(leaderA).delete(`/teams/${teamA}/members/${playerA.id}`)).status).toBeLessThan(300);
    expect(await one('SELECT 1 AS x FROM application_players WHERE tournament_id = ? AND user_id = ?', [tour, playerA.id])).toEqual({ x: 1 });
  });
});

// มติ 28 ต.ค. — "ยกเลิกคือจบ" ตัดระบบกู้คืนออก ⇒ ต้องไม่มีทางไหนพาทัวร์ที่ถูกยกเลิกกลับมาได้
describe('ยกเลิกแล้วย้อนไม่ได้', () => {
  beforeEach(async () => { expect((await cancel(organizer)).status).toBe(200); });

  it('ไม่มีเส้นกู้คืนแล้ว (แอดมินมหาวิทยาลัยเรียกได้ 404)', async () => {
    expect((await as(uniAdmin).post(`/admin/tournaments/${tour}/restore`).send({})).status).toBe(404);
    expect((await tournamentRow())!.tournament_status).toBe('cancelled');
  });

  it('ผู้จัดเผยแพร่/ยกเลิกเผยแพร่/ปิดทัวร์ ไม่ได้ → 409 TOURNAMENT_CANCELLED · สถานะไม่เปลี่ยน', async () => {
    for (const path of ['publish', 'unpublish', 'complete']) {
      const res = await as(organizer).post(`/tournaments/${tour}/${path}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TOURNAMENT_CANCELLED');
    }
    expect((await tournamentRow())!.tournament_status).toBe('cancelled');
  });

  it('แอดมินอนุมัติซ้ำ (เส้นอนุมัติคำขอจัดทัวร์) ไม่ได้ · สถานะไม่เปลี่ยน', async () => {
    expect((await as(uniAdmin).post(`/tournaments/${tour}/approve`)).status).toBe(409);
    expect((await tournamentRow())!.tournament_status).toBe('cancelled');
  });
});
