import { beforeEach, describe, expect, it } from 'vitest';
import { api, as } from './helpers/api.js';
import { all, insert, testDb } from './helpers/db.js';
import {
  createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';
import { resetEmailRateLimit } from '../../middlewares/rateLimitEmail.js';

/**
 * แก้ตามรายงาน QA 30 ต.ค. 2569 — ชุด A และ B
 *
 * ★ ยิงผ่าน HTTP จริงทั้งเส้น (route → middleware → service → repo → MySQL)
 *   สิ่งที่ unit test ทำไม่ได้: ตรวจว่า **route ต่อ middleware ไว้จริง**
 *   ถ้าลืมใส่ `rateLimitEmail` ใน auth.routes.ts เทส unit ของ middleware ยังเขียวหมด
 */

beforeEach(() => {
  resetEmailRateLimit();
});

function registerBody(email: string) {
  return {
    fullName: 'ผู้สมัครทดสอบ', email, password: 'Password123!',
    gender: 'male', birthDate: '2004-01-01', userType: 'student',
  };
}

describe('QA ข้อ 1 — เพดานการขออีเมลต่อ IP', () => {
  /**
   * 🔴 การโจมตีจริงคือ "อีเมลใหม่ทุกครั้ง" ⇒ เพดานต่อบัญชีกันไม่ได้เลย
   *   เทสนี้จึงใช้อีเมลไม่ซ้ำทุกคำขอ เหมือนสคริปต์ของจริง
   */
  it('สมัครด้วยอีเมลใหม่รัว ๆ จาก IP เดียว → ครบ 20 แล้วได้ 429', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await api().post('/api/v1/auth/register').send(registerBody(`rl${i}@outside.org`));
      expect(res.status).toBe(201);
    }

    const blocked = await api().post('/api/v1/auth/register').send(registerBody('rl-over@outside.org'));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_EMAIL_REQUESTS');
    expect(blocked.headers['retry-after']).toMatch(/^\d+$/);

    // 🔴 ของสำคัญ: คำขอที่ถูกกั้นต้อง **ไม่สร้างบัญชี**
    expect(await all('SELECT user_id FROM users WHERE email = ?', ['rl-over@outside.org'])).toHaveLength(0);
  });

  it('โควตาใช้ร่วมกันข้ามเส้น — ขอรหัสใหม่กินโควตาเดียวกับสมัคร', async () => {
    for (let i = 0; i < 20; i++) {
      await api().post('/api/v1/auth/resend-verification').send({ email: `none${i}@outside.org` });
    }
    const blocked = await api().post('/api/v1/auth/register').send(registerBody('after-resend@outside.org'));
    expect(blocked.status).toBe(429);
  });

  it('ลืมรหัสผ่านก็อยู่ในโควตาเดียวกัน', async () => {
    for (let i = 0; i < 20; i++) {
      await api().post('/api/v1/auth/forgot-password').send({ email: `fp${i}@outside.org` });
    }
    const blocked = await api().post('/api/v1/auth/forgot-password').send({ email: 'fp-over@outside.org' });
    expect(blocked.status).toBe(429);
  });

  // ★ คำขอที่รูปแบบผิดต้องไม่กินโควตาของใคร (เหตุผลเดียวกับที่ rateLimitLogin วางหลัง validate)
  it('payload ผิดรูปแบบไม่กินโควตา', async () => {
    for (let i = 0; i < 25; i++) {
      const res = await api().post('/api/v1/auth/register').send({ email: 'ไม่ใช่อีเมล' });
      expect(res.status).toBe(400);
    }
    const ok = await api().post('/api/v1/auth/register').send(registerBody('still-allowed@outside.org'));
    expect(ok.status).toBe(201);
  });
});

describe('QA ข้อ 4 — key รูปบัตรเช็คอินต้องเป็นของแมตช์นี้', () => {
  let player: TestUser;
  let match: number;
  let otherMatch: number;

  beforeEach(async () => {
    const faculty = await createFaculty();
    const sport = await createSportType();
    const organizer = await createUser();
    player = await createUser();
    const leaderB = await createUser();
    const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });

    const teamA = await createTeam({ leader: player.id, sportTypeId: sport });
    const teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport });
    for (const [team, squad] of [[teamA, [player.id]], [teamB, [leaderB.id]]] as const) {
      const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
      for (const userId of squad) await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: userId });
    }
    match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'online', status: 'checkin_open' });
    otherMatch = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'online', status: 'checkin_open', round: 2 });
  });

  const keyOf = (matchId: number) => `checkin_document/${matchId}/44444444-4444-4444-8444-444444444444.jpg`;

  /**
   * 🔴 ด่านรูปร่าง key ทำงาน **ก่อน** แตะที่เก็บไฟล์ ⇒ เทสนี้ไม่ต้องใช้ MinIO
   *   (integration test บล็อก S3 ไว้ — ถ้าด่านนี้ไม่ทำงาน เทสจะได้ 503 แทน 422 ซึ่งก็ยังแดง)
   */
  it('ใช้ key ของแมตช์อื่นมาเช็คอิน → 422 และไม่มีแถวเช็คอินเกิดขึ้น', async () => {
    const res = await as(player).post(`/matches/${match}/checkins`)
      .send({ method: 'photo_online', documentType: 'student_id', documentS3Key: keyOf(otherMatch) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CHECKIN_DOCUMENT_KEY_INVALID');
    expect(await all('SELECT match_checkin_id FROM match_checkins WHERE match_id = ?', [match])).toHaveLength(0);
  });

  it('ใช้ avatar ของคนอื่นมาเป็นบัตร → 422 เหมือนกัน', async () => {
    const res = await as(player).post(`/matches/${match}/checkins`)
      .send({ method: 'photo_online', documentType: 'student_id', documentS3Key: 'avatar/1234/44444444-4444-4444-8444-444444444444.jpg' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CHECKIN_DOCUMENT_KEY_INVALID');
  });
});

describe('QA ข้อ 9/10 — คำเชิญของทีมที่ถูกลบ', () => {
  let leader: TestUser;
  let invitee: TestUser;
  let team: number;
  let invitation: number;

  beforeEach(async () => {
    const sport = await createSportType();
    leader = await createUser();
    invitee = await createUser();
    team = await createTeam({ leader: leader.id, sportTypeId: sport });
    invitation = await insert('team_invitations', {
      team_id: team, invited_user_id: invitee.id, invited_by_user_id: leader.id,
      team_invitation_status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  });

  /** เดิมพังเป็น 500 INTERNAL_ERROR เพราะคิวรีหาชนิดกีฬากรองทีมที่ถูกลบออกแล้วอ่าน `[0]!` */
  it('ทีมถูกลบแล้วกดรับคำเชิญ → 404 ไม่ใช่ 500 และไม่ได้เป็นสมาชิก', async () => {
    // ★ ลบตรงในฐาน ไม่ผ่าน API โดยเจตนา — เส้น API ปิดคำเชิญให้แล้ว (เทสถัดไป)
    //   แต่ทีมหายได้จากทางอื่นที่ไม่ปิดคำเชิญ เช่นงานกวาดทีมร้าง (TM-07) ⇒ ด่านนี้ยังต้องมี
    await testDb().query('UPDATE teams SET deleted_at = NOW() WHERE team_id = ?', [team]);

    const res = await as(invitee).post(`/invitations/${invitation}/accept`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TEAM_NOT_FOUND');
    expect(await all('SELECT team_member_id FROM team_members WHERE team_id = ? AND user_id = ?', [team, invitee.id])).toHaveLength(0);
  });

  /** ลบทีมแล้วคำเชิญต้องไม่ค้างเป็น pending ในหน้า "คำเชิญของฉัน" ของผู้ถูกเชิญ */
  it('ลบทีม → คำเชิญที่ค้างถูกปิด', async () => {
    await as(leader).delete(`/teams/${team}`);

    const rows = await all('SELECT team_invitation_status FROM team_invitations WHERE team_invitation_id = ?', [invitation]);
    expect(rows[0]).toMatchObject({ team_invitation_status: 'rejected' });
  });
});

/**
 * QA ข้อ 10 — `createAcceptInvite` ต้องดู affectedRows ของ UPDATE
 *
 * ★ เรียก repo ตรง ๆ ไม่ผ่าน HTTP โดยเจตนา — ของจริงเคสนี้เกิดจาก **การแข่งกันของเวลา**
 *   (service เช็คว่า pending แล้ว แต่ก่อนจะถึง UPDATE คำเชิญหมดอายุ/ถูกตอบจากอีกแท็บ)
 *   ซึ่งยิงผ่าน HTTP ให้เกิดตรง ๆ ไม่ได้ ⇒ จำลองด้วยการให้แถวไม่เข้าเงื่อนไข UPDATE ตั้งแต่ต้น
 */
describe('QA ข้อ 10 — UPDATE ที่ไม่โดนแถวต้องไม่เพิ่มสมาชิก', () => {
  it('คำเชิญถูกตอบไปแล้ว → โยน 409 และไม่มีแถว team_members เกิดขึ้น', async () => {
    const sport = await createSportType();
    const leader = await createUser();
    const invitee = await createUser();
    const team = await createTeam({ leader: leader.id, sportTypeId: sport });
    const invitation = await insert('team_invitations', {
      team_id: team, invited_user_id: invitee.id, invited_by_user_id: leader.id,
      team_invitation_status: 'accepted',   // ← ไม่เข้าเงื่อนไข WHERE ของ UPDATE
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const InviteRepo = await import('../../repositories/invitation.repo.js');
    await expect(InviteRepo.createAcceptInvite(invitation, team, invitee.id)).rejects.toMatchObject({
      status: 409, code: 'INVITATION_ALREADY_ANSWERED',
    });

    expect(await all('SELECT team_member_id FROM team_members WHERE team_id = ? AND user_id = ?', [team, invitee.id])).toHaveLength(0);
  });
});
