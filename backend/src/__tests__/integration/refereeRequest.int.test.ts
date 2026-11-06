import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { all, one } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';

/**
 * คำขอเปลี่ยนกรรมการ — โอน / แลก / ผู้จัดขอเพิ่ม / ขอถอนตัว
 *
 *   ใครตอบ:  โอน/แลก → กรรมการฝั่งที่ถูกขอ · ถอนตัว → ผู้จัดเท่านั้น · คนขอไม่ต้องตอบ (ถือว่าตกลงแล้ว)
 *   ใครยกเลิก: คนขอเท่านั้น
 *
 * ★ route ฝั่งผู้จัดรับ id กรรมการ/แมตช์มาใน body · requireOrganizer เช็คแค่ทัวร์ใน URL
 *   ⇒ ต้องพิสูจน์ว่าส่ง id ของ "ทัวร์อื่น" มาแล้วถูกปฏิเสธ ไม่ใช่ไปแก้กรรมการทัวร์คนอื่น
 */

let organizer: TestUser;
let otherOrganizer: TestUser;
let ref1: TestUser;
let ref2: TestUser;
let stranger: TestUser;
let tour: number;
let otherTour: number;
let r1: number;           // tournament_referee_id ของ ref1
let r2: number;
let rOther: number;       // กรรมการของทัวร์อื่น
let m1: number;           // ref1 คุม
let m2: number;           // ref2 คุม
let mOther: number;       // แมตช์ของทัวร์อื่น

beforeEach(async () => {
  const faculty = await createFaculty();
  const sport = await createSportType();
  organizer = await createUser();
  otherOrganizer = await createUser();
  ref1 = await createUser();
  ref2 = await createUser();
  stranger = await createUser();
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  otherTour = await createTournament({ organizer: otherOrganizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });

  const team = async () => createTeam({ leader: (await createUser()).id, sportTypeId: sport });
  // เปลี่ยนกรรมการได้เฉพาะแมตช์ที่ตั้งเวลาไว้ในอนาคต · เว้นช่วงไม่ให้ซ้อนกัน (ด่านกรรมการติดแมตช์ซ้อน)
  const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * 3600_000);
  m1 = await createMatch({ tournamentId: tour, teamA: await team(), teamB: await team(), scheduledAt: at(48) });
  m2 = await createMatch({ tournamentId: tour, teamA: await team(), teamB: await team(), scheduledAt: at(52) });
  mOther = await createMatch({ tournamentId: otherTour, teamA: await team(), teamB: await team(), scheduledAt: at(56) });

  r1 = await addTournamentReferee({ tournamentId: tour, userId: ref1.id, invitedBy: organizer.id });
  r2 = await addTournamentReferee({ tournamentId: tour, userId: ref2.id, invitedBy: organizer.id });
  rOther = await addTournamentReferee({ tournamentId: otherTour, userId: (await createUser()).id, invitedBy: otherOrganizer.id });
  await assignMatchReferee({ matchId: m1, tournamentRefereeId: r1 });
  await assignMatchReferee({ matchId: m2, tournamentRefereeId: r2 });
});

const requests = () => all<{ request_id: number; request_status: string }>('SELECT request_id, request_status FROM referee_change_requests');
const statusOf = async (id: number) =>
  (await one<{ request_status: string }>('SELECT request_status FROM referee_change_requests WHERE request_id = ?', [id]))!.request_status;
const refereesOf = async (matchId: number) =>
  (await all<{ tournament_referee_id: number }>(
    "SELECT tournament_referee_id FROM match_referees WHERE match_id = ? AND assignment_status = 'accepted' ORDER BY tournament_referee_id",
    [matchId])).map(r => r.tournament_referee_id);

// ───────────────────────────── โอนแมตช์ระหว่างกรรมการ ─────────────────────────────

describe('โอนแมตช์ (ref_transfer) — กรรมการฝั่งที่ถูกขอเป็นคนตอบ', () => {
  let requestId: number;
  beforeEach(async () => {
    const res = await as(ref1).post('/referee-requests').send({ myMatchId: m1, toTournamentRefereeId: r2 });
    expect(res.status).toBe(201);
    requestId = res.body.id;
  });

  it('กรรมการที่ถูกขอรับ → ทำทันที: แมตช์ m1 เปลี่ยนจาก ref1 เป็น ref2', async () => {
    expect((await as(ref2).post(`/referee-requests/${requestId}/accept`)).status).toBe(200);
    expect(await statusOf(requestId)).toBe('applied');
    expect(await refereesOf(m1)).toEqual([r2]);
  });

  it.each([
    ['คนขอเอง (ตอบแทนอีกฝ่าย)', () => ref1],
    ['ผู้จัด (ไม่ใช่คู่กรณีของคำขอโอน)', () => organizer],
    ['คนนอก', () => stranger],
  ])('%s รับ → 403 NOT_YOUR_REQUEST · แมตช์ไม่เปลี่ยน', async (_label, who) => {
    const res = await as(who()).post(`/referee-requests/${requestId}/accept`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_YOUR_REQUEST');
    expect(await statusOf(requestId)).toBe('open');
    expect(await refereesOf(m1)).toEqual([r1]);
  });

  it('กรรมการที่ถูกขอปฏิเสธ → declined · แมตช์ยังเป็นของ ref1', async () => {
    expect((await as(ref2).post(`/referee-requests/${requestId}/decline`)).status).toBe(200);
    expect(await statusOf(requestId)).toBe('declined');
    expect(await refereesOf(m1)).toEqual([r1]);
  });

  it('ยกเลิกได้เฉพาะคนขอ — คนถูกขอยกเลิกไม่ได้', async () => {
    expect((await as(ref2).delete(`/referee-requests/${requestId}`)).status).toBe(403);
    expect(await statusOf(requestId)).toBe('open');
    expect((await as(ref1).delete(`/referee-requests/${requestId}`)).status).toBeLessThan(300);
    expect(await statusOf(requestId)).toBe('cancelled');
  });

  it('คำขอที่ปิดแล้ว ตอบไม่ได้', async () => {
    expect((await as(ref1).delete(`/referee-requests/${requestId}`)).status).toBeLessThan(300);
    expect((await as(ref2).post(`/referee-requests/${requestId}/accept`)).status).toBeGreaterThanOrEqual(400);
    expect(await refereesOf(m1)).toEqual([r1]);
  });
});

describe('สร้างคำขอโอน — ด่านว่าเป็นของตัวเองจริง', () => {
  it('ไม่ใช่กรรมการของทัวร์นี้ → 403 NOT_TOURNAMENT_REFEREE', async () => {
    const res = await as(stranger).post('/referee-requests').send({ myMatchId: m1, toTournamentRefereeId: r2 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_TOURNAMENT_REFEREE');
    expect(await requests()).toEqual([]);
  });

  it('🔒 โอนแมตช์ที่ตัวเองไม่ได้คุม (ของ ref2) ไปให้คนอื่น → 4xx · ไม่มีคำขอ', async () => {
    const third = await createUser();
    const r3 = await addTournamentReferee({ tournamentId: tour, userId: third.id, invitedBy: organizer.id });
    const res = await as(ref1).post('/referee-requests').send({ myMatchId: m2, toTournamentRefereeId: r3 });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await requests()).toEqual([]);
    expect(await refereesOf(m2)).toEqual([r2]);
  });

  it('🔒 โอนให้กรรมการของทัวร์อื่น → 404 REFEREE_NOT_FOUND', async () => {
    const res = await as(ref1).post('/referee-requests').send({ myMatchId: m1, toTournamentRefereeId: rOther });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REFEREE_NOT_FOUND');
    expect(await requests()).toEqual([]);
  });

  it('โอนให้ตัวเอง → 400 SAME_REFEREE', async () => {
    const res = await as(ref1).post('/referee-requests').send({ myMatchId: m1, toTournamentRefereeId: r1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SAME_REFEREE');
  });
});

// ───────────────────────────── ผู้จัดขอให้คุมเพิ่ม ─────────────────────────────

describe('ผู้จัดขอให้กรรมการคุมแมตช์เพิ่ม (org_add_match)', () => {
  const addMatch = (who: TestUser, tournamentId: number, body: Record<string, number>) =>
    as(who).post(`/tournaments/${tournamentId}/referee-requests/add-match`).send(body);

  it('ผู้จัดขอ → กรรมการรับ → ได้คุมแมตช์นั้นเพิ่ม', async () => {
    const res = await addMatch(organizer, tour, { tournamentRefereeId: r2, matchId: m1 });
    expect(res.status).toBe(201);
    expect((await as(ref2).post(`/referee-requests/${res.body.id}/accept`)).status).toBe(200);
    expect(await refereesOf(m1)).toEqual([r1, r2].sort((a, b) => a - b));
  });

  it('กรรมการคนอื่นตอบแทน → 403', async () => {
    const res = await addMatch(organizer, tour, { tournamentRefereeId: r2, matchId: m1 });
    expect((await as(ref1).post(`/referee-requests/${res.body.id}/accept`)).status).toBe(403);
    expect(await refereesOf(m1)).toEqual([r1]);
  });

  it.each([
    ['ผู้จัดของทัวร์อื่น', () => otherOrganizer],
    ['กรรมการ', () => ref1],
  ])('%s ส่งคำขอในทัวร์นี้ → 403 · ไม่มีคำขอ', async (_label, who) => {
    expect((await addMatch(who(), tour, { tournamentRefereeId: r2, matchId: m1 })).status).toBe(403);
    expect(await requests()).toEqual([]);
  });

  it('🔒 URL ทัวร์ตัวเอง + กรรมการของทัวร์อื่นใน body → 404 · ไม่มีคำขอ', async () => {
    const res = await addMatch(organizer, tour, { tournamentRefereeId: rOther, matchId: m1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REFEREE_NOT_FOUND');
    expect(await requests()).toEqual([]);
  });

  it('🔒 URL ทัวร์ตัวเอง + แมตช์ของทัวร์อื่นใน body → 404 · ไม่มีคำขอ', async () => {
    const res = await addMatch(organizer, tour, { tournamentRefereeId: r2, matchId: mOther });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MATCH_NOT_FOUND');
    expect(await requests()).toEqual([]);
  });

  it('ขอให้คุมแมตช์ที่คุมอยู่แล้ว → 409 REFEREE_ALREADY_ASSIGNED', async () => {
    const res = await addMatch(organizer, tour, { tournamentRefereeId: r1, matchId: m1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REFEREE_ALREADY_ASSIGNED');
  });
});

// ───────────────────────────── ขอถอนตัว ─────────────────────────────

describe('ขอถอนตัว (ref_withdraw) — ผู้จัดเท่านั้นที่อนุมัติ', () => {
  let requestId: number;
  beforeEach(async () => {
    const res = await as(ref1).post('/referee-requests/withdraw').send({ scope: 'match', matchId: m1, reason: 'ติดสอบกลางภาค' });
    expect(res.status).toBe(201);
    requestId = res.body.id;
  });

  it.each([
    ['กรรมการที่ขอถอนเอง', () => ref1],
    ['กรรมการคนอื่น', () => ref2],
    ['ผู้จัดของทัวร์อื่น', () => otherOrganizer],
  ])('%s อนุมัติ → 403 · ยังคุมแมตช์อยู่', async (_label, who) => {
    expect((await as(who()).post(`/referee-requests/${requestId}/accept`)).status).toBe(403);
    expect(await statusOf(requestId)).toBe('open');
    expect(await refereesOf(m1)).toEqual([r1]);
  });

  it('ผู้จัดอนุมัติ → กรรมการพ้นจากแมตช์', async () => {
    expect((await as(organizer).post(`/referee-requests/${requestId}/accept`)).status).toBe(200);
    expect(await statusOf(requestId)).toBe('applied');
    expect(await refereesOf(m1)).toEqual([]);
  });

  it('เหตุผลสั้นเกินไป → 400', async () => {
    const res = await as(ref2).post('/referee-requests/withdraw').send({ scope: 'match', matchId: m2, reason: 'ไม่' });
    expect(res.status).toBe(400);
  });
});

// ───────────────────────────── รายการคำขอ ─────────────────────────────

describe('รายการคำขอ', () => {
  beforeEach(async () => {
    expect((await as(ref1).post('/referee-requests').send({ myMatchId: m1, toTournamentRefereeId: r2 })).status).toBe(201);
  });

  it('รายการของทัวร์: ผู้จัดดูได้ · กรรมการดูไม่ได้', async () => {
    expect((await as(organizer).get(`/tournaments/${tour}/referee-requests`)).status).toBe(200);
    expect((await as(ref1).get(`/tournaments/${tour}/referee-requests`)).status).toBe(403);
  });

  it('/me/referee-requests: คู่กรณีเห็น · คนนอกไม่เห็นคำขอของคนอื่น', async () => {
    const mine = await as(ref2).get('/me/referee-requests');
    expect(mine.status).toBe(200);
    expect(JSON.stringify(mine.body)).toContain(`"id":${(await requests())[0]!.request_id}`);

    const theirs = await as(stranger).get('/me/referee-requests');
    expect(theirs.status).toBe(200);
    expect(JSON.stringify(theirs.body)).not.toContain(`"id":${(await requests())[0]!.request_id}`);
  });
});
