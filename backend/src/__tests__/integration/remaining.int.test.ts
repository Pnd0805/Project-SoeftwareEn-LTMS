import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';

/**
 * endpoint ที่เหลือ — ผู้จัดสลับกรรมการ · รูปแบบ BO ของทัวร์ · ตั้งค่าแจ้งเตือน · เอกสารตัวตนกรรมการ ·
 * รายละเอียดใบสมัคร · รายการ "ของฉัน" · หน้าสาธารณะที่เหลือ
 */

let faculty: number;
let sport: number;
let organizer: TestUser;
let otherOrganizer: TestUser;
let stranger: TestUser;

beforeEach(async () => {
  faculty = await createFaculty();
  sport = await createSportType();
  organizer = await createUser();
  otherOrganizer = await createUser();
  stranger = await createUser();
});

const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * 3600_000);
const team = async () => createTeam({ leader: (await createUser()).id, sportTypeId: sport });

// ───────────────────────────── ผู้จัดสลับกรรมการ ─────────────────────────────

describe('POST /tournaments/:id/referee-requests/swap — ผู้จัดขอสลับ · กรรมการสองคนต้องตอบรับทั้งคู่', () => {
  let tour: number;
  let refA: TestUser;
  let refB: TestUser;
  let rA: number;
  let rB: number;
  let mA: number;
  let mB: number;
  beforeEach(async () => {
    tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    await createTournament({ organizer: otherOrganizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    refA = await createUser();
    refB = await createUser();
    rA = await addTournamentReferee({ tournamentId: tour, userId: refA.id, invitedBy: organizer.id });
    rB = await addTournamentReferee({ tournamentId: tour, userId: refB.id, invitedBy: organizer.id });
    mA = await createMatch({ tournamentId: tour, teamA: await team(), teamB: await team(), scheduledAt: at(48) });
    mB = await createMatch({ tournamentId: tour, teamA: await team(), teamB: await team(), scheduledAt: at(52) });
    await assignMatchReferee({ matchId: mA, tournamentRefereeId: rA });
    await assignMatchReferee({ matchId: mB, tournamentRefereeId: rB });
  });
  const swap = (who: TestUser, tournamentId = tour) =>
    as(who).post(`/tournaments/${tournamentId}/referee-requests/swap`).send({ refereeAId: rA, matchAId: mA, refereeBId: rB, matchBId: mB });
  const refsOf = async (matchId: number) => (await all<{ id: number }>(
    "SELECT tournament_referee_id AS id FROM match_referees WHERE match_id = ? AND assignment_status = 'accepted'", [matchId])).map(r => r.id);

  it('ผู้จัดขอ → ตอบรับคนเดียวยังไม่เปลี่ยน → ตอบรับครบสองคน → สลับจริง', async () => {
    const res = await swap(organizer);
    expect(res.status).toBe(201);
    expect((await as(refA).post(`/referee-requests/${res.body.id}/accept`)).status).toBe(200);
    expect(await refsOf(mA)).toEqual([rA]);
    expect((await as(refB).post(`/referee-requests/${res.body.id}/accept`)).status).toBe(200);
    expect(await refsOf(mA)).toEqual([rB]);
    expect(await refsOf(mB)).toEqual([rA]);
  });

  it('กรรมการคนหนึ่งปฏิเสธ → ไม่มีอะไรสลับ', async () => {
    const res = await swap(organizer);
    expect((await as(refA).post(`/referee-requests/${res.body.id}/accept`)).status).toBe(200);
    expect((await as(refB).post(`/referee-requests/${res.body.id}/decline`)).status).toBe(200);
    expect(await refsOf(mA)).toEqual([rA]);
    expect(await refsOf(mB)).toEqual([rB]);
  });

  it.each([
    ['ผู้จัดทัวร์อื่น', () => otherOrganizer],
    ['กรรมการ (สลับเองแทนผู้จัด)', () => refA],
  ])('%s ขอสลับ → 403 · ไม่มีคำขอ', async (_label, who) => {
    expect((await swap(who())).status).toBe(403);
    expect(await all("SELECT 1 FROM referee_change_requests WHERE request_type = 'org_swap'")).toHaveLength(0);
  });

  it('🔒 ผู้จัดทัวร์อื่นใช้ id ทัวร์ตัวเอง ส่งกรรมการ/แมตช์ของทัวร์นี้มา → 404 · ไม่มีคำขอ', async () => {
    const theirs = (await one<{ id: number }>('SELECT tournament_id AS id FROM tournaments WHERE requested_by_user_id = ?', [otherOrganizer.id]))!.id;
    expect((await swap(otherOrganizer, theirs)).status).toBe(404);
    expect(await all("SELECT 1 FROM referee_change_requests WHERE request_type = 'org_swap'")).toHaveLength(0);
  });

  it('สลับกรรมการคนเดียวกัน / แมตช์เดียวกัน → 400', async () => {
    const same = await as(organizer).post(`/tournaments/${tour}/referee-requests/swap`).send({ refereeAId: rA, matchAId: mA, refereeBId: rA, matchBId: mB });
    expect(same.status).toBe(400);
    expect(same.body.error.code).toBe('SAME_REFEREE');
  });
});

// ───────────────────────────── รูปแบบ BO ของทัวร์ ─────────────────────────────

describe('PATCH /tournaments/:id/format — ตั้งได้ก่อนแมตช์แรกเริ่มแข่งเท่านั้น', () => {
  it('ผู้จัดตั้งได้ · ผู้จัดทัวร์อื่น 403', async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    expect((await as(otherOrganizer).patch(`/tournaments/${tour}/format`).send({ bestOf: 3 })).status).toBe(403);
    expect((await as(organizer).patch(`/tournaments/${tour}/format`).send({ bestOf: 3 })).status).toBe(200);
    expect((await one<{ b: number }>('SELECT best_of AS b FROM tournaments WHERE tournament_id = ?', [tour]))!.b).toBe(3);
  });

  it('มีแมตช์เริ่มแข่งแล้ว → 409 MATCH_FORMAT_LOCKED · ค่าไม่เปลี่ยน', async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    await createMatch({ tournamentId: tour, teamA: await team(), teamB: await team(), status: 'in_progress' });
    const res = await as(organizer).patch(`/tournaments/${tour}/format`).send({ bestOf: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCH_FORMAT_LOCKED');
    expect((await one<{ b: number | null }>('SELECT best_of AS b FROM tournaments WHERE tournament_id = ?', [tour]))!.b).toBeNull();
  });

  it('กีฬาที่ไม่ได้แข่งเป็นรอบ (เช่น ฟุตบอล) ตั้ง BO → 400 · ตั้ง null ได้', async () => {
    const football = await createSportType({ supportsBestOf: false });
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: football, facultyId: faculty, status: 'public' });
    expect((await as(organizer).patch(`/tournaments/${tour}/format`).send({ bestOf: 3 })).status).toBe(400);
    expect((await as(organizer).patch(`/tournaments/${tour}/format`).send({ bestOf: null })).status).toBe(200);
  });
});

// ───────────────────────────── ตั้งค่าแจ้งเตือน ─────────────────────────────

describe('/me/notification-prefs — ของตัวเอง · หมวด critical ปิดไม่ได้', () => {
  it('ปิดหมวดหนึ่ง → อ่านกลับได้ค่าใหม่ · ไม่กระทบผู้ใช้คนอื่น', async () => {
    expect((await as(stranger).patch('/me/notification-prefs').send({ community: false })).status).toBe(200);
    const enabled = async (who: TestUser, key: string) =>
      ((await as(who).get('/me/notification-prefs')).body.categories as { key: string; enabled: boolean }[])
        .find(c => c.key === key)!.enabled;
    expect(await enabled(stranger, 'community')).toBe(false);
    expect(await enabled(stranger, 'team')).toBe(true);        // หมวดที่ไม่ได้ส่งมาคงค่าเดิม
    expect(await enabled(organizer, 'community')).toBe(true);  // ไม่กระทบคนอื่น
    expect(await enabled(stranger, 'critical')).toBe(true);
  });

  it.each([
    ['หมวด critical', { critical: false }],
    ['หมวดที่ไม่มีอยู่', { marketing: false }],
    ['ไม่ส่งอะไรเลย', {}],
    ['ค่าที่ไม่ใช่ boolean', { team: 'off' }],
  ])('%s → 400', async (_label, body) => {
    expect((await as(stranger).patch('/me/notification-prefs').send(body)).status).toBe(400);
  });

  it('ไม่ล็อกอิน → 401', async () => {
    expect((await anon.get('/me/notification-prefs')).status).toBe(401);
  });
});

// ───────────────────────────── เอกสารตัวตนกรรมการ ─────────────────────────────

describe('PUT /me/referee-identity/docs — ส่งเอกสารตัวตน', () => {
  let external: TestUser;
  const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  beforeEach(async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    external = await createUser({ userType: 'external' });
    await insert('tournament_referees', {
      tournament_id: tour, user_id: external.id, invited_by: organizer.id,
      invitation_status: 'accepted', is_external: 1, external_approval_status: 'needs_docs',
    });
  });
  const docsOf = async (userId: number) => (await one<{ d: unknown }>(
    'SELECT external_verification_docs AS d FROM tournament_referees WHERE user_id = ?', [userId]))?.d ?? null;

  it('ส่งไฟล์ที่ตัวเองอัปโหลด → สถานะกลับเป็น pending · ดูสถานะของตัวเองได้', async () => {
    const res = await as(external).put('/me/referee-identity/docs').send({ docs: [`referee_identity/${external.id}/${uuid}.png`] });
    expect(res.status).toBe(200);
    expect((await one<{ s: string }>('SELECT external_approval_status AS s FROM tournament_referees WHERE user_id = ?', [external.id]))!.s)
      .toBe('pending');
    expect((await as(external).get('/me/referee-identity')).body.status).toBe('pending');
  });

  it('ไม่มีคำเชิญกรรมการภายนอกที่รอตรวจ → 409 DOCS_NOT_EXPECTED', async () => {
    const res = await as(stranger).put('/me/referee-identity/docs').send({ docs: [`referee_identity/${stranger.id}/${uuid}.png`] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DOCS_NOT_EXPECTED');
  });

  it('เกิน 5 ไฟล์ / ไม่มีไฟล์ → 400', async () => {
    expect((await as(external).put('/me/referee-identity/docs').send({ docs: [] })).status).toBe(400);
    const six = Array.from({ length: 6 }, () => `referee_identity/${external.id}/${uuid}.png`);
    expect((await as(external).put('/me/referee-identity/docs').send({ docs: six })).status).toBe(400);
  });

  /**
   * ✅ แก้แล้ว 8 ต.ค. 2569 (A1) — `upload.service.validateRefereeIdentityKeys`
   *   เรียกทั้งที่ `PUT /me/referee-identity/docs` และตอนรับคำเชิญที่แนบ docs มา
   *   it.fails ถูกพลิกเป็น it ธรรมดาแล้วตามที่โน้ตเดิมบอกไว้ · บันทึกของเดิมไว้ข้างล่าง
   *
   * 🐞 ช่องโหว่เดิม (integration test เจอ 8 ต.ค. 2569)
   *   submitMyDocs / submitDocsForUser รับ key อะไรก็ได้ (schema แค่ string 1-255 ตัวอักษร)
   *   แล้วคิวแอดมิน (listPendingExternalReferees) เซ็น URL ให้ดูไฟล์ตาม key นั้นตรง ๆ
   *   ⇒ ผู้สมัครส่งไฟล์ของคนอื่นเป็น "บัตรของตัวเอง" ได้ เช่น avatar ของคนอื่น ซึ่ง key อยู่ใน URL สาธารณะ
   *   ⇒ แอดมินตัดสินตัวตนจากเอกสารที่ไม่ใช่ของผู้สมัคร · อนุมัติแล้วได้สิทธิ์คุมแมตช์และส่งผล
   *   upload อื่นทุกชนิดตรวจหมด: avatar · team_logo · dispute_evidence · soft_filter_document
   * ทางแก้ที่เสนอ: ตรวจทุก key ให้ตรง ^referee_identity/{userId}/<uuid>.(jpg|png)$ แบบ validateAvatarKey
   *   (และถ้าทำได้ HEAD ว่ามีไฟล์จริง) ทั้งที่ PUT /me/referee-identity/docs และตอนรับคำเชิญที่แนบ docs มา
   * 🔴 ด่านตรวจ **รูปของ key** อย่างเดียว ไม่ HEAD ว่ามีไฟล์จริง — ตั้งใจ เพราะ fixture 9053
   *   เป็น key ที่ตั้งใจให้ไม่มีไฟล์ ไว้ทดสอบจอกู้สถานการณ์ตอนลิงก์ตอบ 404 (FE ขอให้คงไว้)
   */
  it('ส่ง avatar ของคนอื่นเป็นเอกสารตัวตน → 422', async () => {
    const victimAvatar = `avatar/${stranger.id}/${uuid}.png`;
    const res = await as(external).put('/me/referee-identity/docs').send({ docs: [victimAvatar] });
    expect(res.status).toBe(422);
    expect(JSON.stringify(await docsOf(external.id))).not.toContain(victimAvatar);
  });

  it('ส่งเอกสารตัวตนของกรรมการคนอื่น → 422', async () => {
    const res = await as(external).put('/me/referee-identity/docs').send({ docs: [`referee_identity/${stranger.id}/${uuid}.png`] });
    expect(res.status).toBe(422);
  });

  /**
   * 🔴 ประตูที่สองของเส้นเดียวกัน — แนบเอกสารมาพร้อม **กดรับคำเชิญ**
   *   ถ้าตรวจแต่ `PUT /me/referee-identity/docs` ช่องโหว่ยังเปิดอยู่ทางนี้ทั้งบาน
   *   (`resolveApprovalForAccept` รับ `docs` แล้วเขียนลงฐานตรง ๆ เหมือนกัน)
   */
  it('กดรับคำเชิญพร้อมแนบเอกสารของคนอื่น → 422 และไม่มีอะไรถูกเขียนลงฐาน', async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const newbie = await createUser({ userType: 'external' });
    const invitationId = await insert('tournament_referees', {
      tournament_id: tour, user_id: newbie.id, invited_by: organizer.id,
      invitation_status: 'pending', is_external: 1,
    });

    const res = await as(newbie).post(`/referee-invitations/${invitationId}/accept`)
      .send({ matchIds: [], docs: [`referee_identity/${stranger.id}/${uuid}.png`] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REFEREE_IDENTITY_KEY_INVALID');
    // ★ ต้องไม่รับคำเชิญไปด้วย — ถ้าด่านอยู่ผิดที่ จะกลายเป็น "รับแล้วแต่เอกสารไม่เข้า"
    const row = await one<{ st: string; d: unknown }>(
      'SELECT invitation_status AS st, external_verification_docs AS d FROM tournament_referees WHERE tournament_referee_id = ?',
      [invitationId]);
    expect(row).toMatchObject({ st: 'pending', d: null });
  });

  /** ของตัวเองยังผ่านตามปกติ — ด่านใหม่ต้องไม่กันคนที่ทำถูก */
  it('กดรับคำเชิญพร้อมแนบเอกสารของตัวเอง → ผ่าน', async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const newbie = await createUser({ userType: 'external' });
    const invitationId = await insert('tournament_referees', {
      tournament_id: tour, user_id: newbie.id, invited_by: organizer.id,
      invitation_status: 'pending', is_external: 1,
    });

    const res = await as(newbie).post(`/referee-invitations/${invitationId}/accept`)
      .send({ matchIds: [], docs: [`referee_identity/${newbie.id}/${uuid}.png`] });

    expect(res.status).toBe(200);
  });
});

// ───────────────────────────── ใบสมัคร ─────────────────────────────

describe('GET /applications/:id — หัวหน้าทีมที่ยื่น และผู้จัดของทัวร์นั้นเท่านั้น', () => {
  it('หัวหน้าทีม/ผู้จัดดูได้ · สมาชิกทีม · ผู้จัดทัวร์อื่น · หัวหน้าทีมอื่น ดูไม่ได้', async () => {
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    await createTournament({ organizer: otherOrganizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const leader = await createUser();
    const member = await createUser();
    const teamId = await createTeam({ leader: leader.id, sportTypeId: sport, members: [member.id] });
    const otherLeader = await createUser();
    await createTeam({ leader: otherLeader.id, sportTypeId: sport });
    const app = await insert('tournament_applications', { tournament_id: tour, team_id: teamId, tournament_application_status: 'pending' });

    expect((await as(leader).get(`/applications/${app}`)).status).toBe(200);
    expect((await as(organizer).get(`/applications/${app}`)).status).toBe(200);
    for (const who of [member, otherOrganizer, otherLeader, stranger]) {
      const res = await as(who).get(`/applications/${app}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('APPLICATION_ACCESS_DENIED');
    }
  });
});

// ───────────────────────────── รายการ "ของฉัน" ที่เหลือ ─────────────────────────────

describe('/me/* ที่เหลือ — มีแต่ของตัวเอง', () => {
  it('ใบสมัคร · คำขอเข้าทีม · ทัวร์ของฉัน · กำลังติดตาม · แมตช์ของฉัน', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const tourAlice = await createTournament({ organizer: alice.id, sportTypeId: sport, facultyId: faculty, status: 'public', name: 'ทัวร์ของ Alice' });
    await createTournament({ organizer: bob.id, sportTypeId: sport, facultyId: faculty, status: 'public', name: 'ทัวร์ของ Bob' });
    const bobTeam = await createTeam({ leader: bob.id, sportTypeId: sport, name: 'ทีมของ Bob', visibility: 'public' });
    await insert('tournament_applications', { tournament_id: tourAlice, team_id: bobTeam, tournament_application_status: 'pending' });
    const otherPublic = await createTeam({ leader: (await createUser()).id, sportTypeId: sport, visibility: 'public' });
    await insert('team_join_requests', { team_id: otherPublic, user_id: bob.id, team_join_request_status: 'pending' });
    await as(bob).post(`/users/${alice.id}/follow`);

    const tours = JSON.stringify((await as(alice).get('/me/tournaments')).body);
    expect(tours).toContain('ทัวร์ของ Alice');
    expect(tours).not.toContain('ทัวร์ของ Bob');

    for (const path of ['/me/applications', '/me/join-requests', '/me/following', '/me/matches']) {
      const mine = await as(alice).get(path);
      expect([path, mine.status]).toEqual([path, 200]);
      expect([path, JSON.stringify(mine.body).includes('ทีมของ Bob')]).toEqual([path, false]);
    }
    expect(JSON.stringify((await as(bob).get('/me/applications')).body)).toContain('ทีมของ Bob');
    expect(JSON.stringify((await as(bob).get('/me/join-requests')).body)).toContain(`${otherPublic}`);
    expect(JSON.stringify((await as(bob).get('/me/following')).body)).toContain(`${alice.id}`);
  });
});

// ───────────────────────────── ทีม ─────────────────────────────

describe('ทีม — รายการคำเชิญเฉพาะหัวหน้า · รายชื่อสมาชิกเฉพาะคนใน · หน้าทีมและค้นหาเป็นสาธารณะ', () => {
  it('ตามบทบาท', async () => {
    const leader = await createUser();
    const member = await createUser();
    const teamId = await createTeam({ leader: leader.id, sportTypeId: sport, members: [member.id], name: 'ทีมค้นหาได้', visibility: 'public' });

    expect((await as(leader).get(`/teams/${teamId}/invitations`)).status).toBe(200);
    expect((await as(member).get(`/teams/${teamId}/invitations`)).status).toBe(403);
    expect((await as(member).get(`/teams/${teamId}/members`)).status).toBe(200);
    expect((await as(stranger).get(`/teams/${teamId}/members`)).status).toBe(403);
    expect((await anon.get(`/teams/${teamId}`)).body.name).toBe('ทีมค้นหาได้');
    expect(JSON.stringify((await anon.get(`/teams?q=${encodeURIComponent('ทีมค้นหาได้')}`)).body)).toContain(`"id":${teamId}`);
  });

  it('ทีมที่ถูกปิดแล้วไม่โผล่ในการค้นหา', async () => {
    const teamId = await createTeam({ leader: (await createUser()).id, sportTypeId: sport, name: 'ทีมที่ปิดแล้ว', visibility: 'public' });
    await testDb().query('UPDATE teams SET deleted_at = NOW() WHERE team_id = ?', [teamId]);
    expect(JSON.stringify((await anon.get(`/teams?q=${encodeURIComponent('ทีมที่ปิดแล้ว')}`)).body)).not.toContain(`"id":${teamId}`);
  });
});

// ───────────────────────────── หน้าสาธารณะของแมตช์/ทัวร์ที่เหลือ ─────────────────────────────

describe('หน้าสาธารณะที่เหลือ — เปิดได้เมื่อทัวร์เผยแพร่ · ปิดเมื่อยังไม่เผยแพร่', () => {
  it('lineups · referees · player stats · winner · following · me/pickem', async () => {
    const player = await createUser();
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const teamA = await createTeam({ leader: player.id, sportTypeId: sport });
    const app = await insert('tournament_applications', { tournament_id: tour, team_id: teamA, tournament_application_status: 'approved' });
    await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: player.id });
    const match = await createMatch({ tournamentId: tour, teamA, teamB: await team() });

    for (const path of [`/matches/${match}/lineups`, `/matches/${match}/referees`, `/tournaments/${tour}/players/${player.id}/stats`,
      `/users/${player.id}/following`]) {
      expect([path, (await anon.get(path)).status]).toEqual([path, 200]);
    }
    // ผู้ชนะ: ยังไม่ปิดทัวร์ = ยังไม่มีผู้ชนะ (404 โดยเจตนา) · ปิดแล้วเปิดได้
    expect((await anon.get(`/tournaments/${tour}/winner`)).status).toBe(404);
    await testDb().query("UPDATE tournaments SET tournament_status = 'completed', completed_at = NOW() WHERE tournament_id = ?", [tour]);
    expect((await anon.get(`/tournaments/${tour}/winner`)).status).toBeLessThan(500);
    expect((await as(stranger).get(`/tournaments/${tour}/me/pickem`)).status).toBe(200);
    expect((await anon.get(`/tournaments/${tour}/me/pickem`)).status).toBe(401);
    expect((await as(player).get(`/matches/${match}/checkins/me`)).status).toBeLessThan(500);
  });

  it('ทัวร์ private → lineups / referees / player stats ตอบ 404 กับคนนอก (ด่าน A2)', async () => {
    const player = await createUser();
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'private' });
    const teamA = await createTeam({ leader: player.id, sportTypeId: sport, name: 'ทีมลับ' });
    const match = await createMatch({ tournamentId: tour, teamA, teamB: await team() });
    for (const path of [`/matches/${match}/lineups`, `/matches/${match}/referees`, `/tournaments/${tour}/players/${player.id}/stats`]) {
      const res = await anon.get(path);
      expect([path, res.status]).toEqual([path, 404]);
      expect(JSON.stringify(res.body)).not.toContain('ทีมลับ');
    }
  });
});
