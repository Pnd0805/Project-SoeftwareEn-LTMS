import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anon, as } from './helpers/api.js';
import { insert, testDb } from './helpers/db.js';
import {
  addTournamentReferee, createFaculty, createSportType, createTeam, createTournament, createUser, makeAdmin, type TestUser,
} from './helpers/factories.js';

/**
 * อัปโหลด · ความเป็นส่วนตัวของสถิติ (OD-46) · รายการ "ของฉัน" · ข้อมูลอ้างอิง
 *
 * ★ S3 ถูกบล็อกใน integration (perFile.ts) — ไฟล์นี้ mock แค่ตัวเซ็น URL
 *   เทสจึงพิสูจน์ส่วนที่สำคัญ: ใครได้ URL และ object key ผูกกับอะไร (ไม่ได้ทดสอบว่า S3 รับไฟล์จริง)
 */
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async (_client: unknown, command: { input: { Key: string } }) =>
    `https://s3.test/${command.input.Key}?signed`),
}));

let faculty: number;
let sport: number;
let alice: TestUser;
let bob: TestUser;

beforeEach(async () => {
  faculty = await createFaculty();
  sport = await createSportType();
  alice = await createUser({ facultyId: faculty });
  bob = await createUser({ facultyId: faculty });
});

const presign = (who: TestUser, body: Record<string, unknown>) =>
  as(who).post('/uploads/presign').send({ contentType: 'image/png', ...body });

// ───────────────────────────── อัปโหลด ─────────────────────────────

describe('POST /uploads/presign — object key ผูกกับสิ่งที่คนขอมีสิทธิ์จริง', () => {
  it('avatar: key อยู่ใต้ user id ของคนที่ล็อกอิน', async () => {
    const res = await presign(alice, { purpose: 'avatar' });
    expect(res.status).toBe(200);
    expect(res.body.objectKey).toMatch(new RegExp(`^avatar/${alice.id}/[0-9a-f-]+\\.png$`));
  });

  it('🔒 avatar: ส่ง userId ของคนอื่นมาใน body → ถูกเพิกเฉย key ยังเป็นของตัวเอง', async () => {
    const res = await presign(alice, { purpose: 'avatar', userId: bob.id });
    expect(res.body.objectKey).toMatch(new RegExp(`^avatar/${alice.id}/`));
    expect(res.body.objectKey).not.toContain(`/${bob.id}/`);
  });

  it('team_logo: หัวหน้าทีมขอได้ · สมาชิกและคนนอกขอไม่ได้', async () => {
    const member = await createUser();
    const team = await createTeam({ leader: alice.id, sportTypeId: sport, members: [member.id] });
    expect((await presign(alice, { purpose: 'team_logo', teamId: team })).body.objectKey).toMatch(new RegExp(`^team_logo/${team}/`));
    for (const who of [member, bob]) {
      const res = await presign(who, { purpose: 'team_logo', teamId: team });
      expect(res.status).toBe(403);
      expect(res.body.uploadUrl).toBeUndefined();
    }
  });

  it('dispute_evidence: เฉพาะคู่กรณีของแมตช์', async () => {
    const organizer = await createUser();
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    const teamA = await createTeam({ leader: alice.id, sportTypeId: sport });
    const teamB = await createTeam({ leader: (await createUser()).id, sportTypeId: sport });
    const match = await insert('matches', { tournament_id: tour, team_a_id: teamA, team_b_id: teamB, mode: 'onsite', match_status: 'completed', round_number: 1 });
    expect((await presign(alice, { purpose: 'dispute_evidence', matchId: match })).body.objectKey).toMatch(new RegExp(`^dispute_evidence/${match}/`));
    expect((await presign(bob, { purpose: 'dispute_evidence', matchId: match })).status).toBe(403);
  });

  it('ชนิดไฟล์ที่ไม่ใช่รูป → 400 · ไม่ล็อกอิน → 401', async () => {
    expect((await as(alice).post('/uploads/presign').send({ purpose: 'avatar', contentType: 'application/x-msdownload' })).status).toBe(400);
    expect((await anon.post('/uploads/presign').send({ purpose: 'avatar', contentType: 'image/png' })).status).toBe(401);
  });
});

describe('ใช้ไฟล์ของคนอื่น — ด่าน key ตรวจก่อนแตะ S3', () => {
  const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  it('🔒 PATCH /me ตั้ง avatar เป็นรูปที่ "คนอื่น" อัปโหลด → 422 AVATAR_KEY_INVALID', async () => {
    const res = await as(alice).patch('/me').send({ avatarUrl: `avatar/${bob.id}/${uuid}.png` });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('AVATAR_KEY_INVALID');
  });

  it('🔒 PATCH /teams/:id ตั้งโลโก้เป็นไฟล์ของ "ทีมอื่น" → 422 TEAM_LOGO_KEY_INVALID', async () => {
    const mine = await createTeam({ leader: alice.id, sportTypeId: sport });
    const theirs = await createTeam({ leader: bob.id, sportTypeId: sport });
    const res = await as(alice).patch(`/teams/${mine}`).send({ logoKey: `team_logo/${theirs}/${uuid}.png` });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TEAM_LOGO_KEY_INVALID');
  });

  it('🔒 key ที่พยายามไต่โฟลเดอร์ (../) → 422', async () => {
    const res = await as(alice).patch('/me').send({ avatarUrl: `avatar/${alice.id}/../${bob.id}/${uuid}.png` });
    expect(res.status).toBe(422);
  });
});

// ───────────────────────────── OD-46 ซ่อนสถิติ ─────────────────────────────

describe('OD-46 ซ่อนสถิติในโปรไฟล์ — เห็นได้เฉพาะเจ้าของและแอดมิน', () => {
  const endpoints = (id: number) => [`/users/${id}/stats`, `/users/${id}/career`, `/users/${id}/match-history`];

  beforeEach(async () => {
    expect((await as(alice).patch('/me').send({ showProfileStats: false })).status).toBeLessThan(300);
  });

  it.each([
    ['ไม่ล็อกอิน', () => anon],
    ['ผู้ใช้คนอื่น', () => as(bob)],
  ])('%s → ทุก endpoint ตอบ statsHidden: true โดยไม่มีข้อมูล', async (_label, client) => {
    for (const path of endpoints(alice.id)) {
      const res = await client().get(path);
      expect(res.status).toBe(200);
      expect(res.body.statsHidden).toBe(true);
    }
    expect((await client().get(`/users/${alice.id}`)).body.statsHidden).toBe(true);
  });

  it.each([
    ['เจ้าของเอง', async () => alice],
    ['แอดมิน', async () => { const a = await createUser(); await makeAdmin(a.id, 'faculty', faculty); return a; }],
  ])('%s → เห็นตามปกติ', async (_label, who) => {
    const viewer = await who();
    for (const path of endpoints(alice.id)) {
      expect((await as(viewer).get(path)).body.statsHidden).toBe(false);
    }
  });

  it('เปิดกลับ → ทุกคนเห็น', async () => {
    await as(alice).patch('/me').send({ showProfileStats: true });
    for (const path of endpoints(alice.id)) expect((await anon.get(path)).body.statsHidden).toBe(false);
  });
});

// ───────────────────────────── รายการ "ของฉัน" ─────────────────────────────

describe('/me/* — มีแต่ของตัวเอง', () => {
  it('ทีมของฉัน · คำเชิญของฉัน · คำขอทัวร์ของฉัน · คำเชิญกรรมการของฉัน', async () => {
    const organizer = await createUser();
    const aliceTeam = await createTeam({ leader: alice.id, sportTypeId: sport, name: 'ทีมของ Alice' });
    await createTeam({ leader: bob.id, sportTypeId: sport, name: 'ทีมของ Bob' });
    const inviter = await createTeam({ leader: organizer.id, sportTypeId: sport });
    const expires = new Date(Date.now() + 86_400_000);
    await insert('team_invitations', { team_id: inviter, invited_user_id: bob.id, invited_by_user_id: organizer.id, expires_at: expires, team_invitation_status: 'pending' });
    await createTournament({ organizer: bob.id, sportTypeId: sport, facultyId: faculty, status: 'pending_approval', name: 'คำขอของ Bob' });
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    await addTournamentReferee({ tournamentId: tour, userId: bob.id, invitedBy: organizer.id, invitationStatus: 'pending' });

    const teams = JSON.stringify((await as(alice).get('/me/teams')).body);
    expect(teams).toContain('ทีมของ Alice');
    expect(teams).not.toContain('ทีมของ Bob');
    expect(teams).toContain(`"id":${aliceTeam}`);

    for (const path of ['/me/invitations', '/me/tournament-requests', '/me/referee-invitations']) {
      const res = await as(alice).get(path);
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/คำขอของ Bob|"invitedUserId":\d+/);
      const items = (res.body.items ?? res.body) as unknown[];
      expect(Array.isArray(items) ? items.length : 0).toBe(0);
    }
  });

  it('ไม่ล็อกอิน → 401 ทุกเส้น', async () => {
    for (const path of ['/me/teams', '/me/invitations', '/me/notifications', '/me/pickem', '/me/rewards', '/me/referee-matches']) {
      expect((await anon.get(path)).status).toBe(401);
    }
  });
});

// ───────────────────────────── รายชื่อกรรมการ ─────────────────────────────

describe('รายชื่อกรรมการของทัวร์ — ผู้จัดและกรรมการของทัวร์นั้นเท่านั้น', () => {
  it('assignable: ผู้จัด/กรรมการดูได้ · คนนอก 403 · coverage เฉพาะผู้จัด', async () => {
    const organizer = await createUser();
    const referee = await createUser();
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });

    expect((await as(organizer).get(`/tournaments/${tour}/referees/assignable`)).status).toBe(200);
    expect((await as(referee).get(`/tournaments/${tour}/referees/assignable`)).status).toBe(200);
    expect((await as(alice).get(`/tournaments/${tour}/referees/assignable`)).status).toBe(403);
    expect((await as(organizer).get(`/tournaments/${tour}/referees/coverage`)).status).toBe(200);
    expect((await as(referee).get(`/tournaments/${tour}/referees/coverage`)).status).toBe(403);
  });
});

// ───────────────────────────── ข้อมูลอ้างอิง / หน้าสาธารณะ ─────────────────────────────

describe('ข้อมูลอ้างอิงและหน้าสาธารณะ — อ่านได้โดยไม่ล็อกอิน', () => {
  it('คณะ · กีฬา · ประเภทการระงับ · ภาควิชาของคณะ', async () => {
    await testDb().query("INSERT INTO departments (faculty_id, name) VALUES (?, 'ภาคทดสอบ')", [faculty]);
    expect(JSON.stringify((await anon.get('/faculties')).body)).toContain(`"id":${faculty}`);
    expect(JSON.stringify((await anon.get('/sport-types')).body)).toContain(`"id":${sport}`);
    expect((await anon.get('/suspension-categories')).status).toBe(200);
    expect(JSON.stringify((await anon.get(`/faculties/${faculty}/departments`)).body)).toContain('ภาคทดสอบ');
    expect((await anon.get(`/sport-types/${sport}/stat-definitions`)).status).toBe(200);
  });

  it('หน้าสาธารณะของทัวร์ที่เผยแพร่แล้ว ตอบ 200', async () => {
    const tour = await createTournament({ organizer: alice.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    for (const path of [`/tournaments/${tour}`, `/tournaments/${tour}/standings`, `/tournaments/${tour}/dashboard`,
      `/tournaments/${tour}/pickem-leaderboard`, `/tournaments/${tour}/bracket`, `/users/${bob.id}/followers`, `/users/${bob.id}/rewards`]) {
      expect([path, (await anon.get(path)).status]).toEqual([path, 200]);
    }
  });

  it('id ที่ไม่มีอยู่ → 404 · id ไม่ใช่ตัวเลข → 4xx (ไม่ใช่ 500)', async () => {
    expect((await anon.get('/users/999999')).status).toBe(404);
    expect((await anon.get('/faculties/999999/departments')).status).toBeLessThan(500);
    for (const path of ['/users/abc', '/tournaments/abc', '/matches/abc', '/tournaments/abc/standings']) {
      const status = (await anon.get(path)).status;
      expect([path, status >= 400 && status < 500]).toEqual([path, true]);
    }
  });
});
