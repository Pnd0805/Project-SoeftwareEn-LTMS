import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';

/**
 * ทะเบียนกรรมการของทัวร์ — เชิญ · ตอบรับ/ปฏิเสธ · ถอดออก
 *
 * ★ ตอบคำเชิญของคนอื่น → 404 (ไม่ใช่ 403) โดยเจตนา: ไม่บอกว่าคำเชิญเลขนั้นมีอยู่จริง
 * ★ ถอดกรรมการต้องเป็นกรรมการ "ของทัวร์ใน URL" — กันผู้จัดทัวร์ A ส่งเลขกรรมการของทัวร์ B มา
 */

let faculty: number;
let sport: number;
let organizer: TestUser;
let otherOrganizer: TestUser;
let candidate: TestUser;
let stranger: TestUser;
let tour: number;
let otherTour: number;

beforeEach(async () => {
  faculty = await createFaculty();
  sport = await createSportType();
  organizer = await createUser();
  otherOrganizer = await createUser();
  candidate = await createUser();
  stranger = await createUser();
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  otherTour = await createTournament({ organizer: otherOrganizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
});

const refRowsOf = (tournamentId: number, userId: number) =>
  all<{ tournament_referee_id: number; invitation_status: string; removed_at: Date | null }>(
    'SELECT tournament_referee_id, invitation_status, removed_at FROM tournament_referees WHERE tournament_id = ? AND user_id = ?',
    [tournamentId, userId]);
const invite = (who: TestUser, tournamentId: number, userId: number) =>
  as(who).post(`/tournaments/${tournamentId}/referees`).send({ userId, isExternal: false });

/**
 * 🆕 BE-13 (7 ต.ค. 2569 · มติ ⑨ ง) — คำเชิญกรรมการต้องมีวันหมดอายุ
 *
 * ปัญหา: ผู้จัดเชิญใครเป็นกรรมการ แล้วคนนั้นไม่ตอบ ⇒ ทีมของคนนั้นสมัครทัวร์นั้นไม่ได้ **ตลอดไป**
 *   เพราะด่าน CoI นับคำเชิญ 'pending' ว่าเป็นกรรมการแล้ว และตารางนี้ไม่มีคอลัมน์วันหมดอายุเลย
 *   (คำเชิญเข้าทีมมี 7 วันมาตั้งแต่ migration 013)
 *
 * 🔴 เคสที่ไม่มีทางออกเลยก่อนแก้: ผู้จัดหายไปจากโครงการ ⇒ ไม่มีใครมีสิทธิ์ยกเลิกคำเชิญแทน
 *   ⇒ ให้ "เวลา" เป็นคนปลดล็อก แทนที่จะต้องมีคนจำ
 *
 * ★ ระบบไม่มี scheduler ⇒ แถวในฐานยังเป็น 'pending' ตลอด · "หมดอายุ" คำนวณตอนอ่านทุกครั้ง
 *   (รูปแบบเดียวกับ `findLiveInvitation` ของคำเชิญเข้าทีม)
 */
describe('คำเชิญกรรมการหมดอายุใน 7 วัน (BE-13)', () => {
  const expireInvitation = (id: number) =>
    testDb().query('UPDATE tournament_referees SET expires_at = NOW() - INTERVAL 1 DAY WHERE tournament_referee_id = ?', [id]);
  const inviteAndGetId = async () => {
    expect((await invite(organizer, tour, candidate.id)).status).toBeLessThan(300);
    return (await refRowsOf(tour, candidate.id))[0]!.tournament_referee_id;
  };

  it('เชิญใหม่ → ฐานบันทึกวันหมดอายุไว้ประมาณ 7 วันข้างหน้า', async () => {
    const id = await inviteAndGetId();

    const row = await one<{ days: number }>(
      'SELECT TIMESTAMPDIFF(HOUR, NOW(), expires_at) AS days FROM tournament_referees WHERE tournament_referee_id = ?', [id]);
    // 7 วัน = 168 ชม. · เผื่อเวลารันเทส
    expect(row!.days).toBeGreaterThanOrEqual(167);
    expect(row!.days).toBeLessThanOrEqual(168);
  });

  it('คำเชิญหมดอายุแล้ว → กดรับไม่ได้ 409 REFEREE_INVITATION_EXPIRED · สถานะในฐานไม่เปลี่ยน', async () => {
    const id = await inviteAndGetId();
    await expireInvitation(id);

    const res = await as(candidate).post(`/referee-invitations/${id}/accept`).send({ matchIds: [] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REFEREE_INVITATION_EXPIRED');
    expect((await refRowsOf(tour, candidate.id))[0]!.invitation_status).toBe('pending');
  });

  /** ★ ไม่ใช่แค่ซ่อนปุ่ม — ใบที่หมดอายุต้องหายจากรายการด้วย ไม่งั้นคนจะกดแล้วเจอ error เปล่า ๆ */
  it('คำเชิญหมดอายุแล้ว → ไม่ขึ้นใน "คำเชิญของฉัน"', async () => {
    const id = await inviteAndGetId();
    expect((await as(candidate).get('/me/referee-invitations')).body.items).toHaveLength(1);

    await expireInvitation(id);

    expect((await as(candidate).get('/me/referee-invitations')).body.items).toHaveLength(0);
  });

  /**
   * ★ ด่านเชิญซ้ำต้องปล่อยใบที่หมดอายุผ่าน — ถ้ายังนับ ผู้จัดจะเชิญคนเดิมใหม่ไม่ได้ตลอดไป
   *   ⇒ วันหมดอายุจะกลายเป็นแค่การย้ายทางตันไปอีกที่ ไม่ได้แก้อะไรเลย
   */
  it('คำเชิญหมดอายุแล้ว → ผู้จัดเชิญคนเดิมใหม่ได้', async () => {
    const id = await inviteAndGetId();
    await expireInvitation(id);

    expect((await invite(organizer, tour, candidate.id)).status).toBeLessThan(300);
    expect(await refRowsOf(tour, candidate.id)).toHaveLength(2);
  });

  /** ★ เคสตรงข้าม — ใบที่ยังไม่หมดอายุต้องยังบล็อกการเชิญซ้ำ (ด่านต้องไม่ถูกปลดทิ้งทั้งอัน) */
  it('คำเชิญยังไม่หมดอายุ → เชิญซ้ำไม่ได้ 409 REFEREE_INVITATION_PENDING พร้อมวันหมดอายุ', async () => {
    await inviteAndGetId();

    const res = await invite(organizer, tour, candidate.id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REFEREE_INVITATION_PENDING');
    expect(typeof res.body.error.expiresAt).toBe('string');
    expect(await refRowsOf(tour, candidate.id)).toHaveLength(1);
  });

  it('ผู้จัดเห็นสถานะ expired ในรายการกรรมการของทัวร์', async () => {
    const id = await inviteAndGetId();
    await expireInvitation(id);

    const res = await as(organizer).get(`/tournaments/${tour}/referees`);

    expect(res.body.items.find((i: { id: number }) => i.id === id)).toMatchObject({ status: 'expired' });
  });
});

// ───────────────────────────── เชิญ ─────────────────────────────

describe('POST /tournaments/:id/referees — เชิญได้เฉพาะผู้จัดของทัวร์นี้', () => {
  it('ผู้จัด → สำเร็จ · คำเชิญ pending ในฐาน', async () => {
    const res = await invite(organizer, tour, candidate.id);
    expect(res.status).toBeLessThan(300);
    expect(await refRowsOf(tour, candidate.id)).toEqual([expect.objectContaining({ invitation_status: 'pending', removed_at: null })]);
  });

  it.each([
    ['ผู้ใช้ทั่วไป', () => stranger],
    ['ผู้จัดของทัวร์อื่น', () => otherOrganizer],
    ['ตัวผู้ถูกเชิญเอง (เชิญตัวเองเข้าเป็นกรรมการ)', () => candidate],
  ])('%s → 403 · ไม่มีคำเชิญเกิดขึ้น', async (_label, who) => {
    const res = await invite(who(), tour, candidate.id);
    expect(res.status).toBe(403);
    expect(await refRowsOf(tour, candidate.id)).toEqual([]);
  });

  it('ผู้จัดเชิญตัวเอง → 409 ORGANIZER_CANNOT_BE_REFEREE', async () => {
    const res = await invite(organizer, tour, organizer.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORGANIZER_CANNOT_BE_REFEREE');
  });

  it('คนที่มีชื่อในทีมที่สมัครทัวร์นี้ → 409 REFEREE_CONFLICT_OF_INTEREST', async () => {
    const leader = await createUser();
    const team = await createTeam({ leader: leader.id, sportTypeId: sport, members: [candidate.id] });
    await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'pending' });
    const res = await invite(organizer, tour, candidate.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REFEREE_CONFLICT_OF_INTEREST');
    expect(await refRowsOf(tour, candidate.id)).toEqual([]);
  });

  it('เชิญซ้ำระหว่างรอตอบ → 409 · ยังมีแถวเดียว', async () => {
    expect((await invite(organizer, tour, candidate.id)).status).toBeLessThan(300);
    const again = await invite(organizer, tour, candidate.id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('REFEREE_INVITATION_PENDING');
    expect(await refRowsOf(tour, candidate.id)).toHaveLength(1);
  });

  it('ผู้ใช้ไม่มีอยู่ → 404', async () => {
    expect((await invite(organizer, tour, 999999)).status).toBe(404);
  });
});

// ───────────────────────────── ตอบคำเชิญ ─────────────────────────────

describe('ตอบคำเชิญ — เฉพาะคนที่ถูกเชิญ · คนอื่นได้ 404 (ไม่บอกว่ามีคำเชิญนี้)', () => {
  let invitation: number;
  beforeEach(async () => {
    expect((await invite(organizer, tour, candidate.id)).status).toBeLessThan(300);
    invitation = (await refRowsOf(tour, candidate.id))[0]!.tournament_referee_id;
  });

  it('คนที่ถูกเชิญรับ → accepted', async () => {
    const res = await as(candidate).post(`/referee-invitations/${invitation}/accept`).send({});
    expect(res.status).toBe(200);
    expect((await refRowsOf(tour, candidate.id))[0]!.invitation_status).toBe('accepted');
  });

  it.each([
    ['คนอื่น', () => stranger],
    ['ผู้จัดที่เป็นคนเชิญ (รับแทน)', () => organizer],
  ])('%s รับคำเชิญนี้ → 404 INVITATION_NOT_FOUND · ยัง pending', async (_label, who) => {
    const res = await as(who()).post(`/referee-invitations/${invitation}/accept`).send({});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVITATION_NOT_FOUND');
    expect((await refRowsOf(tour, candidate.id))[0]!.invitation_status).toBe('pending');
  });

  it('คนอื่นได้คำตอบเหมือนคำเชิญที่ไม่มีอยู่จริงทุกตัวอักษร (เดาเลขคำเชิญไม่ได้)', async () => {
    const real = await as(stranger).post(`/referee-invitations/${invitation}/accept`).send({});
    const fake = await as(stranger).post('/referee-invitations/999999/accept').send({});
    expect(real.status).toBe(fake.status);
    expect(real.body).toEqual(fake.body);
  });

  it('รับซ้ำ → 409 INVITATION_ALREADY_ANSWERED', async () => {
    expect((await as(candidate).post(`/referee-invitations/${invitation}/accept`).send({})).status).toBe(200);
    const again = await as(candidate).post(`/referee-invitations/${invitation}/accept`).send({});
    expect(again.status).toBe(409);
  });

  it('ปฏิเสธ: คนอื่น → 404 · คนที่ถูกเชิญ → สำเร็จ', async () => {
    expect((await as(stranger).post(`/referee-invitations/${invitation}/decline`)).status).toBe(404);
    expect((await refRowsOf(tour, candidate.id))[0]!.invitation_status).toBe('pending');
    expect((await as(candidate).post(`/referee-invitations/${invitation}/decline`)).status).toBeLessThan(300);
    expect((await refRowsOf(tour, candidate.id))[0]!.invitation_status).toBe('rejected');
  });

  it('ผู้จัดถอนคำเชิญไปแล้ว → รับไม่ได้ (404)', async () => {
    expect((await as(organizer).delete(`/tournaments/${tour}/referees/${invitation}`)).status).toBeLessThan(300);
    expect((await as(candidate).post(`/referee-invitations/${invitation}/accept`).send({})).status).toBe(404);
  });
});

// ───────────────────────────── ดู / ถอดกรรมการ ─────────────────────────────

describe('รายชื่อและการถอดกรรมการ', () => {
  let refRow: number;
  let otherRefRow: number;
  let referee: TestUser;
  beforeEach(async () => {
    referee = await createUser();
    refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
    otherRefRow = await addTournamentReferee({ tournamentId: otherTour, userId: (await createUser()).id, invitedBy: otherOrganizer.id });
  });

  it('รายชื่อกรรมการของทัวร์ ดูได้เฉพาะผู้จัด — กรรมการเองก็ไม่ได้', async () => {
    expect((await as(organizer).get(`/tournaments/${tour}/referees`)).status).toBe(200);
    expect((await as(referee).get(`/tournaments/${tour}/referees`)).status).toBe(403);
  });

  it('ผู้จัดถอดกรรมการ → removed_at ถูกตั้ง', async () => {
    expect((await as(organizer).delete(`/tournaments/${tour}/referees/${refRow}`)).status).toBeLessThan(300);
    expect((await refRowsOf(tour, referee.id))[0]!.removed_at).not.toBeNull();
  });

  it('ผู้จัดทัวร์อื่นถอด → 403 · ยังอยู่', async () => {
    expect((await as(otherOrganizer).delete(`/tournaments/${tour}/referees/${refRow}`)).status).toBe(403);
    expect((await refRowsOf(tour, referee.id))[0]!.removed_at).toBeNull();
  });

  it('🔒 ผู้จัดใช้ id ทัวร์ตัวเอง แต่ส่งเลขกรรมการของทัวร์อื่น → 404 · กรรมการทัวร์นั้นไม่ถูกแตะ', async () => {
    const res = await as(organizer).delete(`/tournaments/${tour}/referees/${otherRefRow}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REFEREE_NOT_FOUND');
    expect((await one<{ removed_at: Date | null }>(
      'SELECT removed_at FROM tournament_referees WHERE tournament_referee_id = ?', [otherRefRow]))!.removed_at).toBeNull();
  });

  it('ถอดกรรมการออกจากแมตช์: ผู้จัดของแมตช์ทำได้ · กรรมการคนนั้นทำเองไม่ได้', async () => {
    const leaderA = await createUser();
    const leaderB = await createUser();
    const match = await createMatch({
      tournamentId: tour,
      teamA: await createTeam({ leader: leaderA.id, sportTypeId: sport }),
      teamB: await createTeam({ leader: leaderB.id, sportTypeId: sport }),
    });
    await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
    const assigned = () => all('SELECT 1 FROM match_referees WHERE match_id = ? AND tournament_referee_id = ?', [match, refRow]);

    expect((await as(referee).delete(`/matches/${match}/referees/${refRow}`)).status).toBe(403);
    expect(await assigned()).toHaveLength(1);
    expect((await as(organizer).delete(`/matches/${match}/referees/${refRow}`)).status).toBeLessThan(300);
    expect(await assigned()).toHaveLength(0);
  });
});
