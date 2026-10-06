import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { all, insert, one } from './helpers/db.js';
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
