import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';
import { findMatchFollowers } from '../../repositories/notification.repo.js';
import { autoVerifyDue } from '../../services/matchResult.service.js';

/**
 * OD-72 (FR-FN-02 · UC-05 ขั้น 5) — แจ้งเตือนผู้ติดตามนักกีฬา + กระดิ่งรายคน ผ่าน API จริง → SQL จริง
 *
 *   ① กรรมการกด "เริ่มแข่ง"   → followed_player_match_started
 *   ② ผลได้รับการยืนยัน (มือ + อัตโนมัติ) → followed_player_result_verified
 *
 * ★ กระดิ่งตั้งต้นปิด (มติข้อ 1) · ปิดหมวด community ชนะกระดิ่งเสมอ (มติข้อ 2)
 */

const STARTED = 'followed_player_match_started';
const VERIFIED = 'followed_player_result_verified';

let organizer: TestUser;
let referee: TestUser;
let leaderA: TestUser;   // หัวหน้าทีม A + ลงรายชื่อ · ทีมที่ชนะในเคสผล
let leaderB: TestUser;
let p1: TestUser;        // ผู้เล่นทีม A
let p2: TestUser;        // ผู้เล่นทีม A
let p3: TestUser;        // ผู้เล่นทีม B
let fan: TestUser;       // คนนอกที่ติดตามนักกีฬา
let sport: number;
let faculty: number;

beforeEach(async () => {
  faculty = await createFaculty();
  sport = await createSportType({ minMembers: 1, maxMembers: 5 });
  organizer = await createUser();
  referee = await createUser();
  leaderA = await createUser();
  leaderB = await createUser();
  p1 = await createUser();
  p2 = await createUser();
  p3 = await createUser();
  fan = await createUser();
});

/** ทัวร์ + สองทีมที่ผ่านอนุมัติ (A: leaderA p1 p2 · B: leaderB p3) + แมตช์ + กรรมการ 1 คน */
async function setup(o: { status: 'checkin_open' | 'finished'; tournamentStatus?: 'public' | 'private' }) {
  const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: o.tournamentStatus ?? 'public' });
  const teamA = await createTeam({ leader: leaderA.id, sportTypeId: sport, members: [p1.id, p2.id] });
  const teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport, members: [p3.id] });
  for (const [team, squad] of [[teamA, [leaderA, p1, p2]], [teamB, [leaderB, p3]]] as const) {
    const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
    for (const u of squad) await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: u.id });
  }
  const match = await createMatch({
    tournamentId: tour, teamA, teamB, mode: 'onsite', status: o.status,
    scheduledAt: new Date(Date.now() + 5 * 60_000), venue: 'สนามกลาง',   // อยู่ในหน้าต่างเริ่มแข่ง (ดู matchOps.int.test.ts)
  });
  const refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
  await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
  return { tour, teamA, teamB, match };
}

/** ติดตามผ่าน API จริง แล้วเปิด/ปิดกระดิ่งผ่าน API จริง */
async function follow(who: TestUser, target: TestUser, bell: boolean) {
  expect((await as(who).post(`/users/${target.id}/follow`)).status).toBe(200);
  if (bell) expect((await as(who).patch(`/users/${target.id}/follow`).send({ notifyEnabled: true })).status).toBe(200);
}

const checkIn = (match: number, user: TestUser) =>
  insert('match_checkins', { match_id: match, user_id: user.id, method: 'qr_onsite', match_checkin_status: 'success' });

const notes = (user: TestUser, type: string) =>
  all<{ notification_id: number; related_entity_id: number }>(
    'SELECT notification_id, related_entity_id FROM notifications WHERE user_id = ? AND type = ?', [user.id, type]);

/** กรรมการส่งผล (A ชนะ) แล้วหัวหน้าทีมที่ชนะยืนยัน — BR-13 */
async function submitResult(match: number, teamA: number, teamB: number) {
  expect((await as(referee).post(`/matches/${match}/result`).send({ winnerTeamId: teamA, scoreData: { [teamA]: 3, [teamB]: 1 } })).status).toBe(201);
}

// ───────────────────────────── ① เริ่มแข่ง ─────────────────────────────

describe('① กรรมการกดเริ่มแข่ง', () => {
  it('🔴 เทส 1: ติดตามผู้เล่น 3 คนในแมตช์เดียว เปิดกระดิ่งทั้งสาม → ได้ฉบับเดียว', async () => {
    const { match } = await setup({ status: 'checkin_open' });
    for (const p of [p1, p2, p3]) await follow(fan, p, true);
    await checkIn(match, leaderA);
    await checkIn(match, leaderB);

    expect((await as(referee).post(`/matches/${match}/start`)).status).toBe(200);

    const got = await notes(fan, STARTED);
    expect(got).toHaveLength(1);
    expect(got[0]!.related_entity_id).toBe(match);
    // ชั้น repo เอง (ด่าน DISTINCT) — service ตัดซ้ำอีกชั้น จึงต้องตรวจตรงนี้แยก ไม่งั้นตัด DISTINCT ออกแล้วไม่มีอะไรแดง
    expect(await findMatchFollowers(match)).toEqual([fan.id]);
  });

  it('🔴 เทส 2: กดติดตามแต่ไม่เปิดกระดิ่ง (ค่าตั้งต้น) → ไม่ได้เลย', async () => {
    const { match } = await setup({ status: 'checkin_open' });
    await follow(fan, p1, false);
    await checkIn(match, leaderA);
    await checkIn(match, leaderB);

    expect((await as(referee).post(`/matches/${match}/start`)).status).toBe(200);

    expect(await notes(fan, STARTED)).toHaveLength(0);
    expect(await findMatchFollowers(match)).toEqual([]);
  });

  it('🔴 เทส 5: ทีม B ไม่มีใครเช็คอิน → แพ้บาย (ไม่ได้แข่งจริง) → ไม่มีแจ้งเตือน "เริ่มแล้ว"', async () => {
    const { match } = await setup({ status: 'checkin_open' });
    await follow(fan, p1, true);
    await checkIn(match, leaderA);

    const res = await as(referee).post(`/matches/${match}/start`);
    expect(res.status).toBe(200);
    expect(res.body.walkover).toMatchObject({ reason: 'insufficient_checkins' });

    expect(await notes(fan, STARTED)).toHaveLength(0);
  });

  it('🔴 เทส 6: กดเริ่มซ้ำ → 409 · ไม่มีแจ้งเตือนรอบสอง', async () => {
    const { match } = await setup({ status: 'checkin_open' });
    await follow(fan, p1, true);
    await checkIn(match, leaderA);
    await checkIn(match, leaderB);

    expect((await as(referee).post(`/matches/${match}/start`)).status).toBe(200);
    expect((await as(referee).post(`/matches/${match}/start`)).status).toBe(409);

    expect(await notes(fan, STARTED)).toHaveLength(1);
  });

  /**
   * ★ กดซ้ำทีละครั้งไม่ถึง markMatchStarted ด้วยซ้ำ — ครั้งที่สองติด CHECKIN_NOT_OPEN ตั้งแต่บรรทัดแรก
   *   ตัวที่ markMatchStarted กันจริงคือ "กดพร้อมกัน" (กดเบิ้ล / สองเครื่อง) ซึ่งผ่านด่านสถานะมาได้ทั้งคู่
   *   ⇒ เทสนี้คือตัวที่จับได้ถ้ามีคนย้ายจุดยิงขึ้นไปก่อน markMatchStarted
   */
  it('🔴 เทส 6b: กดเริ่มพร้อมกันสองครั้ง → สำเร็จครั้งเดียว · แจ้งเตือนฉบับเดียว', async () => {
    const { match } = await setup({ status: 'checkin_open' });
    await follow(fan, p1, true);
    await checkIn(match, leaderA);
    await checkIn(match, leaderB);

    const codes = (await Promise.all([1, 2, 3].map(() => as(referee).post(`/matches/${match}/start`)))).map(r => r.status).sort();
    expect(codes).toEqual([200, 409, 409]);

    expect(await notes(fan, STARTED)).toHaveLength(1);
  });

  it('เทส 7: ผู้เล่น/กรรมการที่ติดตามคนในแมตช์เดียวกัน → ไม่ได้ฉบับของผู้ติดตาม · คนนอกยังได้', async () => {
    const { match } = await setup({ status: 'checkin_open' });
    await follow(p1, p2, true);        // เพื่อนร่วมทีม
    await follow(referee, p3, true);   // กรรมการของแมตช์
    await follow(fan, p3, true);
    await checkIn(match, leaderA);
    await checkIn(match, leaderB);

    expect((await as(referee).post(`/matches/${match}/start`)).status).toBe(200);

    expect(await notes(p1, STARTED)).toHaveLength(0);
    expect(await notes(referee, STARTED)).toHaveLength(0);
    expect(await notes(fan, STARTED)).toHaveLength(1);
  });

  it('ทัวร์ที่ยังไม่เผยแพร่ (private) → ผู้ติดตามไม่ได้ (เปิดดูแมตช์ไม่ได้อยู่แล้ว)', async () => {
    const { match } = await setup({ status: 'checkin_open', tournamentStatus: 'private' });
    await follow(fan, p1, true);
    await checkIn(match, leaderA);
    await checkIn(match, leaderB);

    expect((await as(referee).post(`/matches/${match}/start`)).status).toBe(200);

    expect(await notes(fan, STARTED)).toHaveLength(0);
  });
});

// ───────────────────────────── ② ผลได้รับการยืนยัน ─────────────────────────────

describe('② ผลได้รับการยืนยัน — สองจุด', () => {
  it('🔴 เทส 3: ยืนยันด้วยมือ → ผู้ติดตามได้ followed_player_result_verified ฉบับเดียว', async () => {
    const { match, teamA, teamB } = await setup({ status: 'finished' });
    await follow(fan, p1, true);
    await follow(fan, p3, true);
    await submitResult(match, teamA, teamB);

    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);

    const got = await notes(fan, VERIFIED);
    expect(got).toHaveLength(1);
    expect(got[0]!.related_entity_id).toBe(match);
  });

  it('🔴 เทส 4: ยืนยันอัตโนมัติ (หมดเวลาโต้แย้ง) → ได้เหมือนกัน', async () => {
    const { match, teamA, teamB } = await setup({ status: 'finished' });
    await follow(fan, p1, true);
    await submitResult(match, teamA, teamB);
    await testDb().query('UPDATE match_results SET submitted_at = NOW() - INTERVAL 25 HOUR WHERE match_id = ?', [match]);

    expect(await autoVerifyDue([match])).toEqual([match]);

    expect(await one('SELECT match_result_status FROM match_results WHERE match_id = ?', [match]))
      .toEqual({ match_result_status: 'verified' });
    expect(await notes(fan, VERIFIED)).toHaveLength(1);
  });

  it('เทส 2 (จังหวะ ②): กระดิ่งปิด → ยืนยันผลแล้วก็ไม่ได้', async () => {
    const { match, teamA, teamB } = await setup({ status: 'finished' });
    await follow(fan, p1, false);
    await submitResult(match, teamA, teamB);

    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);

    expect(await notes(fan, VERIFIED)).toHaveLength(0);
  });

  it('เทส 7 (จังหวะ ②): หัวหน้าทีมคู่แข่งที่ติดตามผู้เล่น → ได้ result_verified ฉบับเดียว ไม่ได้ฉบับผู้ติดตามซ้ำ', async () => {
    const { match, teamA, teamB } = await setup({ status: 'finished' });
    await follow(leaderB, p1, true);
    await submitResult(match, teamA, teamB);

    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);

    expect(await notes(leaderB, 'result_verified')).toHaveLength(1);
    expect(await notes(leaderB, VERIFIED)).toHaveLength(0);
  });

  /**
   * 🔴 FR-FN-02 (30 ต.ค. · ฝ่ายเอกสารตรวจเจอ) — จังหวะผลยืนยัน ผู้เล่นธรรมดาไม่ได้ result_verified (ส่งแค่หัวหน้า + กรรมการ)
   *   เดิมตัวกันซ้ำตัดผู้เล่นทุกคนออกด้วย ⇒ ผู้เล่นที่ลงแข่งและติดตามเพื่อนไม่ได้ข่าวผลเลย
   */
  it('🔴 ผู้เล่นในรายชื่อ (ไม่ใช่หัวหน้า) ติดตามเพื่อนร่วมแมตช์ → ผลยืนยันได้ฉบับผู้ติดตาม · กรรมการไม่ได้', async () => {
    const { match, teamA, teamB } = await setup({ status: 'finished' });
    await follow(p1, p2, true);
    await follow(referee, p3, true);
    await submitResult(match, teamA, teamB);

    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);

    expect(await notes(p1, 'result_verified')).toHaveLength(0);   // ผู้เล่นไม่อยู่ในผู้รับชุดเดิม
    expect(await notes(p1, VERIFIED)).toHaveLength(1);
    expect(await notes(referee, VERIFIED)).toHaveLength(0);
  });

  it('ผู้เล่นคนเดิม · ยืนยันอัตโนมัติ → ได้ฉบับผู้ติดตามเหมือนกัน', async () => {
    const { match, teamA, teamB } = await setup({ status: 'finished' });
    await follow(p1, p2, true);
    await submitResult(match, teamA, teamB);
    await testDb().query('UPDATE match_results SET submitted_at = NOW() - INTERVAL 25 HOUR WHERE match_id = ?', [match]);

    expect(await autoVerifyDue([match])).toEqual([match]);
    expect(await notes(p1, VERIFIED)).toHaveLength(1);
  });

  it('★ ผู้รับชุดเดิมไม่เปลี่ยน — คู่กรณียังได้ result_verified เหมือนเดิม', async () => {
    const { match, teamA, teamB } = await setup({ status: 'finished' });
    await follow(fan, p1, true);
    await submitResult(match, teamA, teamB);

    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);

    expect(await notes(leaderB, 'result_verified')).toHaveLength(1);
    expect(await notes(referee, 'result_verified')).toHaveLength(1);
    expect(await notes(fan, 'result_verified')).toHaveLength(0);
  });
});

// ───────────────────────────── สองชั้น: หมวด × กระดิ่ง ─────────────────────────────

describe('มติข้อ 2 — ปิดหมวดชนะกระดิ่งเสมอ', () => {
  it('🔴 เทส 8: ผู้ติดตามปิดหมวด community → ไม่เห็นในรายการแม้กระดิ่งเปิด', async () => {
    const { match } = await setup({ status: 'checkin_open' });
    await follow(fan, p1, true);
    expect((await as(fan).patch('/me/notification-prefs').send({ community: false })).status).toBe(200);
    await checkIn(match, leaderA);
    await checkIn(match, leaderB);

    expect((await as(referee).post(`/matches/${match}/start`)).status).toBe(200);

    const list = await as(fan).get('/me/notifications');
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(STARTED);
    // ★ หมวดกรอง "ตอนอ่าน" — แถวยังถูกเขียน (เปิดหมวดคืนแล้วเห็นย้อนหลังได้ ตามมติเดิม)
    expect(await notes(fan, STARTED)).toHaveLength(1);
    expect((await as(fan).patch('/me/notification-prefs').send({ community: true })).status).toBe(200);
    expect(JSON.stringify((await as(fan).get('/me/notifications')).body)).toContain(STARTED);
  });
});

describe('กระดิ่งกรอง "ตอนเขียน"', () => {
  it('ปิดกระดิ่งทีหลัง → แจ้งเตือนเก่ายังอยู่ในรายการ (ไม่ลบย้อนหลัง) · ของใหม่ไม่มาแล้ว', async () => {
    const first = await setup({ status: 'checkin_open' });
    await follow(fan, p1, true);
    await checkIn(first.match, leaderA);
    await checkIn(first.match, leaderB);
    expect((await as(referee).post(`/matches/${first.match}/start`)).status).toBe(200);

    expect((await as(fan).patch(`/users/${p1.id}/follow`).send({ notifyEnabled: false })).status).toBe(200);
    expect(JSON.stringify((await as(fan).get('/me/notifications')).body)).toContain(STARTED);

    const second = await setup({ status: 'finished' });
    await submitResult(second.match, second.teamA, second.teamB);
    expect((await as(leaderA).post(`/matches/${second.match}/result/verify`)).status).toBe(200);
    expect(await notes(fan, STARTED)).toHaveLength(1);
    expect(await notes(fan, VERIFIED)).toHaveLength(0);
  });
});

// ───────────────────────────── เส้นกระดิ่ง ─────────────────────────────

describe('PATCH /users/:id/follow — เปิด/ปิดกระดิ่ง', () => {
  const row = (who: TestUser, target: TestUser) =>
    one<{ notify_enabled: number }>('SELECT notify_enabled FROM follows WHERE follower_user_id = ? AND followed_user_id = ?', [who.id, target.id]);

  it('🔴 เทส 9: ยังไม่ได้ติดตาม → 404 NOT_FOLLOWING · ไม่มีแถวใหม่ในฐาน', async () => {
    const res = await as(fan).patch(`/users/${p1.id}/follow`).send({ notifyEnabled: true });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOLLOWING');
    expect(await row(fan, p1)).toBeNull();
  });

  it('ติดตามใหม่ → กระดิ่งปิด (มติข้อ 1) · POST คืน notifyEnabled false มาเลย', async () => {
    const res = await as(fan).post(`/users/${p1.id}/follow`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: p1.id, isFollowing: true, notifyEnabled: false });
    expect(await row(fan, p1)).toEqual({ notify_enabled: 0 });
  });

  it('เปิดแล้วปิด → ค่าในฐานตาม · คืน { userId, isFollowing, notifyEnabled }', async () => {
    await follow(fan, p1, false);
    const on = await as(fan).patch(`/users/${p1.id}/follow`).send({ notifyEnabled: true });
    expect(on.status).toBe(200);
    expect(on.body).toEqual({ userId: p1.id, isFollowing: true, notifyEnabled: true });
    expect(await row(fan, p1)).toEqual({ notify_enabled: 1 });

    const off = await as(fan).patch(`/users/${p1.id}/follow`).send({ notifyEnabled: false });
    expect(off.body.notifyEnabled).toBe(false);
    expect(await row(fan, p1)).toEqual({ notify_enabled: 0 });
  });

  it('กดติดตามซ้ำ (POST อีกรอบ) → ไม่รีเซ็ตกระดิ่งที่เปิดไว้', async () => {
    await follow(fan, p1, true);
    const again = await as(fan).post(`/users/${p1.id}/follow`);
    expect(again.body.notifyEnabled).toBe(true);
    expect(await row(fan, p1)).toEqual({ notify_enabled: 1 });
  });

  it('ตัวเอง → 409 CANNOT_FOLLOW_SELF', async () => {
    const res = await as(fan).patch(`/users/${fan.id}/follow`).send({ notifyEnabled: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANNOT_FOLLOW_SELF');
  });

  it.each([
    ['ไม่มี body', undefined],
    ['ไม่ใช่ boolean', { notifyEnabled: 'yes' }],
  ])('%s → 400', async (_label, body) => {
    await follow(fan, p1, false);
    const res = await as(fan).patch(`/users/${p1.id}/follow`).send(body as object);
    expect(res.status).toBe(400);
  });

  it('ไม่ได้ล็อกอิน → 401', async () => {
    expect((await anon.patch(`/users/${p1.id}/follow`).send({ notifyEnabled: true })).status).toBe(401);
  });
});

describe('สถานะกระดิ่งออก API', () => {
  it('GET /users/:id — notifyEnabled ข้าง isFollowing · false เมื่อยังไม่ติดตาม/ไม่ได้ล็อกอิน', async () => {
    expect((await as(fan).get(`/users/${p1.id}`)).body).toMatchObject({ isFollowing: false, notifyEnabled: false });
    expect((await anon.get(`/users/${p1.id}`)).body).toMatchObject({ isFollowing: false, notifyEnabled: false });

    await follow(fan, p1, false);
    expect((await as(fan).get(`/users/${p1.id}`)).body).toMatchObject({ isFollowing: true, notifyEnabled: false });

    await as(fan).patch(`/users/${p1.id}/follow`).send({ notifyEnabled: true });
    expect((await as(fan).get(`/users/${p1.id}`)).body).toMatchObject({ isFollowing: true, notifyEnabled: true });
  });

  it('GET /me/following · GET /users/:id/following — notifyEnabled ในแต่ละ item', async () => {
    await follow(fan, p1, true);
    await follow(fan, p2, false);

    for (const res of [await as(fan).get('/me/following'), await anon.get(`/users/${fan.id}/following`)]) {
      expect(res.status).toBe(200);
      const byId = Object.fromEntries((res.body.items as { id: number; notifyEnabled: boolean }[]).map(i => [i.id, i.notifyEnabled]));
      expect(byId).toEqual({ [p1.id]: true, [p2.id]: false });
    }
  });

  it('เลิกติดตามแล้วติดตามใหม่ → กระดิ่งกลับเป็นปิด (แถวเดิมถูกลบ)', async () => {
    await follow(fan, p1, true);
    expect((await as(fan).delete(`/users/${p1.id}/follow`)).status).toBe(200);
    expect((await as(fan).post(`/users/${p1.id}/follow`)).body.notifyEnabled).toBe(false);
  });
});
