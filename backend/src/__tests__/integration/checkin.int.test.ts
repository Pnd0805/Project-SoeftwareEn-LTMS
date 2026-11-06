import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { all, insert, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';

/**
 * เช็คอินที่สนาม — กรรมการ/ผู้จัดเปิด QR · ผู้เล่นที่ถูกส่งลงแข่งสแกน
 *
 * ★ ทำไมผู้เล่นต้องขอ QR เองไม่ได้: ถ้าขอได้ ก็ "เช็คอินที่สนาม" จากบ้านได้ ⇒ ด่านนี้คือหัวใจของ onsite
 * ★ QR เป็น JWT ที่ (ค่าตั้งต้น) เซ็นด้วย secret เดียวกับ token ล็อกอิน — CHECKIN_QR_SECRET ว่างจะใช้ JWT_SECRET
 *   ความปลอดภัยจึงพึ่ง "รูปร่าง" ของ payload ที่ต่างกัน (QR ไม่มี sub · token ไม่มี type) ⇒ ล็อกไว้ด้วยเทส
 */

let organizer: TestUser;
let referee: TestUser;
let player: TestUser;        // อยู่ในรายชื่อที่ส่งลงแข่ง
let benchMember: TestUser;   // อยู่ในทีมแต่ไม่ได้ส่งลงแข่ง
let stranger: TestUser;
let tour: number;
let match: number;
let otherMatch: number;

beforeEach(async () => {
  const faculty = await createFaculty();
  const sport = await createSportType();
  organizer = await createUser();
  referee = await createUser();
  player = await createUser();
  benchMember = await createUser();
  stranger = await createUser();
  const leaderB = await createUser();
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });

  const teamA = await createTeam({ leader: player.id, sportTypeId: sport, members: [benchMember.id] });
  const teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport });
  for (const [team, squad] of [[teamA, [player.id]], [teamB, [leaderB.id]]] as const) {
    const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
    for (const userId of squad) await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: userId });
  }

  match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'onsite', status: 'checkin_open' });
  otherMatch = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'onsite', status: 'checkin_open', round: 2 });
  const refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
  await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
  await assignMatchReferee({ matchId: otherMatch, tournamentRefereeId: refRow });
});

const qrFor = async (matchId: number) => (await as(referee).get(`/matches/${matchId}/checkin-qr`)).body.qrPayload as string;
const scan = (who: TestUser, qrPayload: string) =>
  as(who).post(`/matches/${match}/checkins`).send({ method: 'qr_onsite', qrPayload });
const checkinsOf = (userId: number) =>
  all<{ match_checkin_status: string }>('SELECT match_checkin_status FROM match_checkins WHERE match_id = ? AND user_id = ?', [match, userId]);

// ───────────────────────────── ขอ QR ─────────────────────────────

describe('GET /matches/:id/checkin-qr — เฉพาะกรรมการของแมตช์หรือผู้จัด', () => {
  it.each([
    ['กรรมการของแมตช์', () => referee],
    ['ผู้จัด', () => organizer],
  ])('%s → 200 พร้อม qrPayload', async (_label, who) => {
    const res = await as(who()).get(`/matches/${match}/checkin-qr`);
    expect(res.status).toBe(200);
    expect(typeof res.body.qrPayload).toBe('string');
  });

  it.each([
    ['ผู้เล่นที่ลงแข่ง (ขอเองแล้วเช็คอินจากที่ไหนก็ได้)', () => player],
    ['คนนอก', () => stranger],
  ])('🔒 %s → 403', async (_label, who) => {
    const res = await as(who()).get(`/matches/${match}/checkin-qr`);
    expect(res.status).toBe(403);
    expect(res.body.qrPayload).toBeUndefined();
  });

  it('แมตช์ไม่ได้เปิดเช็คอิน → 409', async () => {
    await testDb().query("UPDATE matches SET match_status = 'scheduled' WHERE match_id = ?", [match]);
    expect((await as(referee).get(`/matches/${match}/checkin-qr`)).status).toBe(409);
  });
});

// ───────────────────────────── สแกน ─────────────────────────────

describe('POST /matches/:id/checkins — สแกน QR', () => {
  it('ผู้เล่นที่ถูกส่งลงแข่ง + QR ของแมตช์นี้ → สำเร็จ · มีแถวเช็คอินในฐาน', async () => {
    const res = await scan(player, await qrFor(match));
    expect(res.status).toBeLessThan(300);
    expect(await checkinsOf(player.id)).toHaveLength(1);
  });

  it('สแกนซ้ำ → ได้รายการเดิม ไม่เกิดแถวที่สอง', async () => {
    const qr = await qrFor(match);
    expect((await scan(player, qr)).status).toBeLessThan(300);
    expect((await scan(player, qr)).status).toBeLessThan(300);
    expect(await checkinsOf(player.id)).toHaveLength(1);
  });

  it.each([
    ['สมาชิกทีมที่ไม่ได้ถูกส่งลงแข่ง', () => benchMember],
    ['คนนอก', () => stranger],
  ])('%s สแกน QR จริง → 403 NOT_IN_APPROVED_ROSTER · ไม่มีแถว', async (_label, who) => {
    const res = await scan(who(), await qrFor(match));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_IN_APPROVED_ROSTER');
    expect(await checkinsOf(who().id)).toHaveLength(0);
  });

  it('🔒 QR ของแมตช์อื่น → 400 CHECKIN_QR_MISMATCH · ไม่มีแถว', async () => {
    const res = await scan(player, await qrFor(otherMatch));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CHECKIN_QR_MISMATCH');
    expect(await checkinsOf(player.id)).toHaveLength(0);
  });

  it('🔒 ใช้ token ล็อกอินของตัวเองแทน QR (secret เดียวกันโดยค่าตั้งต้น) → 400', async () => {
    const res = await scan(player, player.token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CHECKIN_QR_MISMATCH');
    expect(await checkinsOf(player.id)).toHaveLength(0);
  });

  it('🔒 กลับกัน: ใช้ QR เป็น token ล็อกอิน → 401 (QR ไม่มี sub)', async () => {
    const res = await as({ token: await qrFor(match) }).get('/me');
    expect(res.status).toBe(401);
  });

  it('QR ปลอม/เสีย → 400', async () => {
    expect((await scan(player, 'not.a.jwt')).status).toBe(400);
    expect(await checkinsOf(player.id)).toHaveLength(0);
  });

  it('ปิดเช็คอินไปแล้ว → 409 CHECKIN_NOT_OPEN แม้ถือ QR ที่ยังไม่หมดอายุ', async () => {
    const qr = await qrFor(match);
    await testDb().query("UPDATE matches SET match_status = 'scheduled' WHERE match_id = ?", [match]);
    const res = await scan(player, qr);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CHECKIN_NOT_OPEN');
  });
});

// ───────────────────────────── รายการ / เช็คอินแทน ─────────────────────────────

describe('รายการเช็คอิน และการเช็คอินแทนโดยกรรมการ', () => {
  it('รายการเช็คอิน: กรรมการ/ผู้จัดดูได้ · ผู้เล่นดูไม่ได้ (มีรูปบัตรของคนอื่น)', async () => {
    expect((await as(referee).get(`/matches/${match}/checkins`)).status).toBe(200);
    expect((await as(organizer).get(`/matches/${match}/checkins`)).status).toBe(200);
    expect((await as(player).get(`/matches/${match}/checkins`)).status).toBe(403);
  });

  it('กรรมการเช็คอินแทนผู้เล่นในรายชื่อ → สถานะ exception', async () => {
    const res = await as(referee).post(`/matches/${match}/checkins/manual`).send({ userId: player.id, note: 'กล้องเสีย' });
    expect(res.status).toBeLessThan(300);
    expect(await checkinsOf(player.id)).toEqual([{ match_checkin_status: 'exception' }]);
  });

  it('กรรมการเช็คอินแทนคนที่ไม่อยู่ในรายชื่อ → 403 · ไม่มีแถว', async () => {
    const res = await as(referee).post(`/matches/${match}/checkins/manual`).send({ userId: benchMember.id });
    expect(res.status).toBe(403);
    expect(await checkinsOf(benchMember.id)).toHaveLength(0);
  });

  it.each([
    ['ผู้เล่น (เช็คอินแทนตัวเอง)', () => player],
    ['คนนอก', () => stranger],
  ])('%s ใช้เส้นเช็คอินแทน → 403 · ไม่มีแถว', async (_label, who) => {
    expect((await as(who()).post(`/matches/${match}/checkins/manual`).send({ userId: player.id })).status).toBe(403);
    expect(await checkinsOf(player.id)).toHaveLength(0);
  });
});
