import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import { createFaculty, createSportType, createTeam, createTournament, createUser, type TestUser } from './helpers/factories.js';

/**
 * ทีม · คำเชิญ · คำขอเข้าร่วม — สิทธิ์ "หัวหน้าทีม" ผูกกับทีมรายการนั้น (requireTeamLeader)
 *
 * ★ ทุกเทสที่ถูกปฏิเสธ ตรวจฐานด้วยว่าไม่เปลี่ยน (ไม่ใช่แค่ status code)
 * ★ BR-04 (Ready เมื่อถึงขั้นต่ำ) · BR-05 (โควตา 5 ทีม Unofficial) ทดสอบผ่าน API จริงที่นี่
 */

let sport: number;           // ขั้นต่ำ 3 คน — หัวหน้า + 2 ⇒ ทีมยัง Forming จนกว่าคนที่สามเข้ามา
let leader: TestUser;
let member: TestUser;
let stranger: TestUser;
let team: number;

beforeEach(async () => {
  sport = await createSportType({ minMembers: 3, maxMembers: 10 });
  leader = await createUser();
  member = await createUser();
  stranger = await createUser();
  team = await createTeam({ leader: leader.id, sportTypeId: sport, members: [member.id], readiness: 'Forming' });
});

const teamRow = (id: number) =>
  one<{ name: string; readiness_status: string; leader_id: number; deleted_at: Date | null; visibility: string }>(
    'SELECT name, readiness_status, leader_id, deleted_at, visibility FROM teams WHERE team_id = ?', [id]);
const isMember = async (teamId: number, userId: number) =>
  (await one('SELECT 1 AS x FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId])) !== null;
const invitationsOf = (teamId: number) =>
  all<{ team_invitation_id: number; invited_user_id: number; team_invitation_status: string }>(
    'SELECT team_invitation_id, invited_user_id, team_invitation_status FROM team_invitations WHERE team_id = ?', [teamId]);

// ───────────────────────────── สร้างทีม ─────────────────────────────

describe('POST /teams', () => {
  it('สร้างได้ · คนสร้างเป็นหัวหน้าและเป็นสมาชิกคนแรก · เริ่มที่ Forming', async () => {
    const res = await as(stranger).post('/teams').send({ name: 'ทีมใหม่', sportTypeId: sport });
    expect(res.status).toBe(201);
    const row = await teamRow(res.body.id);
    expect(row).toMatchObject({ leader_id: stranger.id, readiness_status: 'Forming' });
    expect(await isMember(res.body.id, stranger.id)).toBe(true);
  });

  it('ไม่ล็อกอิน → 401 · ไม่มีทีมเกิดขึ้น', async () => {
    const res = await anon.post('/teams').send({ name: 'ทีมผี', sportTypeId: sport });
    expect(res.status).toBe(401);
    expect(await one("SELECT 1 FROM teams WHERE name = 'ทีมผี'")).toBeNull();
  });

  it('ชื่อซ้ำในกีฬาเดียวกัน → 409 TEAM_NAME_TAKEN', async () => {
    await as(stranger).post('/teams').send({ name: 'ชื่อซ้ำ', sportTypeId: sport });
    const res = await as(member).post('/teams').send({ name: 'ชื่อซ้ำ', sportTypeId: sport });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_NAME_TAKEN');
  });

  it('BR-05: มีทีม Unofficial ครบ 5 แล้ว → 422 TEAM_QUOTA_EXCEEDED · ทีมที่ 6 ไม่เกิด', async () => {
    for (let i = 0; i < 5; i++) await createTeam({ leader: stranger.id, sportTypeId: sport });
    const res = await as(stranger).post('/teams').send({ name: 'ทีมที่หก', sportTypeId: sport });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TEAM_QUOTA_EXCEEDED');
    expect(await one("SELECT 1 FROM teams WHERE name = 'ทีมที่หก'")).toBeNull();
  });
});

// ───────────────────────────── requireTeamLeader ─────────────────────────────

describe('requireTeamLeader — แก้/ลบทีมได้เฉพาะหัวหน้าของทีมนี้', () => {
  it('หัวหน้า → แก้ชื่อได้', async () => {
    const res = await as(leader).patch(`/teams/${team}`).send({ name: 'ชื่อใหม่' });
    expect(res.status).toBe(200);
    expect((await teamRow(team))!.name).toBe('ชื่อใหม่');
  });

  it.each([
    ['สมาชิกทีม (ไม่ใช่หัวหน้า)', () => member],
    ['คนนอก', () => stranger],
  ])('%s → 403 NOT_TEAM_LEADER · ชื่อไม่เปลี่ยน', async (_label, who) => {
    const before = (await teamRow(team))!.name;
    const res = await as(who()).patch(`/teams/${team}`).send({ name: 'ถูกแฮ็ก' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_TEAM_LEADER');
    expect((await teamRow(team))!.name).toBe(before);
  });

  it('หัวหน้าของทีมอื่น → 403 (หัวหน้าไม่ใช่ role ของบัญชี)', async () => {
    const otherLeader = await createUser();
    await createTeam({ leader: otherLeader.id, sportTypeId: sport });
    const res = await as(otherLeader).delete(`/teams/${team}`);
    expect(res.status).toBe(403);
    expect((await teamRow(team))!.deleted_at).toBeNull();
  });

  it('ไม่ล็อกอิน → 401', async () => {
    expect((await anon.patch(`/teams/${team}`).send({ name: 'x' })).status).toBe(401);
  });

  it('ทีมที่ถูกปิดแล้ว → 404 แม้เป็นหัวหน้า', async () => {
    await testDb().query('UPDATE teams SET deleted_at = NOW() WHERE team_id = ?', [team]);
    const res = await as(leader).patch(`/teams/${team}`).send({ name: 'ฟื้น' });
    expect(res.status).toBe(404);
  });

  /**
   * A3 — แก้แล้ว 6 ต.ค. 2569 (เดิมเป็น it.fails: 500)
   *   requireTeamLeader ใช้ Number(req.params.id) ⇒ 'abc' กลายเป็น NaN แล้วเข้า SQL
   *   mysql2 เขียน NaN ลงคิวรีเป็นคำเปล่า ⇒ MySQL อ่านเป็นชื่อคอลัมน์ ⇒ 500 INTERNAL_ERROR
   *   กระทบทุก route ที่ผ่านด่านนี้ · ตอนนี้ใช้ parseId แบบเดียวกับ requireOrganizer ⇒ 400
   *   ★ ไม่ต้องปิด console.error อีกแล้ว เพราะไม่มี error ที่ไม่คาดคิดเกิดขึ้น
   */
  it('id ทีมไม่ใช่ตัวเลข → 400 VALIDATION_FAILED ไม่ใช่ 500', async () => {
    const res = await as(leader).patch('/teams/abc').send({ name: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error?.code ?? res.body.code).toBe('VALIDATION_FAILED');
  });

  /** ★ ไม่ใช่แค่ PATCH — ทุกเส้นที่ผ่าน requireTeamLeader ต้องได้ 400 เหมือนกันหมด */
  it('เส้นอื่นที่ผ่านด่านเดียวกันก็ได้ 400 ไม่ใช่ 500', async () => {
    expect((await as(leader).delete('/teams/abc')).status).toBe(400);
    expect((await as(leader).post('/teams/abc/official-request').send({ documents: [] })).status).toBe(400);
  });

  it('หัวหน้าลบทีม → 204 · soft delete (แถวยังอยู่ มี deleted_at)', async () => {
    const res = await as(leader).delete(`/teams/${team}`);
    expect(res.status).toBe(204);
    expect((await teamRow(team))!.deleted_at).not.toBeNull();
  });
});

describe('DELETE /teams/:id/members/:uid', () => {
  it('หัวหน้าเอาสมาชิกออกได้', async () => {
    const res = await as(leader).delete(`/teams/${team}/members/${member.id}`);
    expect(res.status).toBe(204);
    expect(await isMember(team, member.id)).toBe(false);
  });

  it('หัวหน้าเอาตัวเองออก → 403 (ต้องโอนหัวหน้าก่อน)', async () => {
    const res = await as(leader).delete(`/teams/${team}/members/${leader.id}`);
    expect(res.status).toBe(403);
    expect(await isMember(team, leader.id)).toBe(true);
  });

  it('สมาชิกเอาคนอื่นออก → 403 · ยังเป็นสมาชิกอยู่', async () => {
    const other = await createUser();
    await testDb().query('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)', [team, other.id]);
    const res = await as(member).delete(`/teams/${team}/members/${other.id}`);
    expect(res.status).toBe(403);
    expect(await isMember(team, other.id)).toBe(true);
  });

  /**
   * 🆕 BE-11 / FE-05 (7 ต.ค. 2569 · มติ ⑧ ก) — สมาชิกออกจากทีมเอง
   *
   * เดิมมีทางเดียวคือ `DELETE /teams/:id/members/:uid` ที่ติด `requireTeamLeader`
   * ⇒ สมาชิกลบตัวเองได้ 403 NOT_TEAM_LEADER และไม่มี endpoint อื่นเลย
   *   คนที่อยากออกต้องไปขอหัวหน้าทีมเตะออก ซึ่งไม่ใช่เรื่องเดียวกัน
   *
   * ★ route `/members/me` ต้องถูกประกาศก่อน `/members/:uid` — ถ้าสลับลำดับ express
   *   จะจับ 'me' เป็น :uid แล้วไปติด requireTeamLeader (403) ซึ่งคือบั๊กเดิม
   */
  describe('ออกจากทีมเอง — DELETE /members/me (BE-11)', () => {
    it('สมาชิกออกเองได้ → 204 · ไม่เป็นสมาชิกแล้ว', async () => {
      const res = await as(member).delete(`/teams/${team}/members/me`);

      expect(res.status).toBe(204);
      expect(await isMember(team, member.id)).toBe(false);
    });

    /** ★ ทีมต้องมีหัวหน้าเสมอ · การโอนหัวหน้าต้องผ่านแอดมิน ⇒ ระบบเลือกคนใหม่แทนทีมไม่ได้ */
    it('หัวหน้าทีมออกเอง → 409 LEADER_CANNOT_LEAVE · ยังเป็นสมาชิก', async () => {
      const res = await as(leader).delete(`/teams/${team}/members/me`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LEADER_CANNOT_LEAVE');
      expect(await isMember(team, leader.id)).toBe(true);
    });

    it('คนนอกทีมเรียก → 404 (ไม่ได้อยู่ในทีมนี้)', async () => {
      const res = await as(stranger).delete(`/teams/${team}/members/me`);

      expect(res.status).toBe(404);
    });

    it('ไม่ล็อกอิน → 401', async () => {
      expect((await anon.delete(`/teams/${team}/members/me`)).status).toBe(401);
      expect(await isMember(team, member.id)).toBe(true);
    });

    /**
     * ★ ด่านที่ `deleteMember` มีอยู่แล้วต้องยังทำงานกับทางเข้าใหม่ด้วย — นี่คือเหตุผลที่
     *   เลือกใช้ service ตัวเดิมทั้งก้อน ไม่เขียนกฎขึ้นใหม่ · ถ้าใครแยกเป็นสองชุด เทสนี้จะแดง
     */
    it('คนที่ถูกส่งลงแข่งในทัวร์ที่อนุมัติแล้ว ออกเองไม่ได้ → 409 MEMBER_LOCKED_IN_TOURNAMENT', async () => {
      const faculty = await createFaculty();
      const organizer = await createUser();
      const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
      const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
      await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: member.id });

      const res = await as(member).delete(`/teams/${team}/members/me`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MEMBER_LOCKED_IN_TOURNAMENT');
      expect(await isMember(team, member.id)).toBe(true);
    });
  });

  it('BR-04 ขาลง: เอาออกจนต่ำกว่าขั้นต่ำ → ทีมกลับเป็น Forming', async () => {
    const third = await createUser();
    await testDb().query('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)', [team, third.id]);
    await testDb().query("UPDATE teams SET readiness_status = 'Ready' WHERE team_id = ?", [team]);

    expect((await as(leader).delete(`/teams/${team}/members/${third.id}`)).status).toBe(204);
    expect((await teamRow(team))!.readiness_status).toBe('Forming');
  });
});

// ───────────────────────────── คำเชิญ ─────────────────────────────

describe('คำเชิญ — สร้างได้เฉพาะหัวหน้า · ตอบได้เฉพาะคนที่ถูกเชิญ', () => {
  it('หัวหน้าเชิญ → 201 · คำเชิญ pending ในฐาน', async () => {
    const res = await as(leader).post(`/teams/${team}/invitations`).send({ invitedUserId: stranger.id });
    expect(res.status).toBe(201);
    expect(await invitationsOf(team)).toEqual([
      expect.objectContaining({ invited_user_id: stranger.id, team_invitation_status: 'pending' }),
    ]);
  });

  it('สมาชิก (ไม่ใช่หัวหน้า) เชิญ → 403 · ไม่มีคำเชิญเกิดขึ้น', async () => {
    const res = await as(member).post(`/teams/${team}/invitations`).send({ invitedUserId: stranger.id });
    expect(res.status).toBe(403);
    expect(await invitationsOf(team)).toEqual([]);
  });

  it('เชิญคนที่เป็นสมาชิกอยู่แล้ว → 409 ALREADY_MEMBER', async () => {
    const res = await as(leader).post(`/teams/${team}/invitations`).send({ invitedUserId: member.id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_MEMBER');
  });

  /**
   * 🆕 BE-10 (7 ต.ค. 2569 · มติ ⑦ ค) — เชิญคนเดิมซ้ำได้ 201 ทั้งสองครั้ง
   *   และใบที่ซ้ำยังค้างเป็น pending หลังคนนั้นเข้าทีมแล้ว
   *
   * ★ สองชั้น: ด่านที่ service ให้ข้อความ · UNIQUE ของ migration 048 กัน race
   *   เทสนี้ยิงผ่าน HTTP ⇒ ผ่านทั้งสองชั้น
   */
  it('เชิญคนเดิมซ้ำ → 409 INVITATION_ALREADY_PENDING · มีคำเชิญใบเดียว', async () => {
    expect((await as(leader).post(`/teams/${team}/invitations`).send({ invitedUserId: stranger.id })).status).toBe(201);

    const again = await as(leader).post(`/teams/${team}/invitations`).send({ invitedUserId: stranger.id });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVITATION_ALREADY_PENDING');

    expect(await invitationsOf(team)).toHaveLength(1);
  });

  /**
   * ★ เคสที่ด่านนี้**ต้องไม่**บล็อก — คำเชิญที่หมดอายุแล้ว
   *   ระบบไม่มี scheduler ⇒ สถานะยังเป็น 'pending' ตลอดไปแม้เลย expires_at
   *   ถ้าไม่ปิดใบเก่าก่อน จะเชิญคนเดิมใหม่ไม่ได้อีกตลอดไป (และ UNIQUE จะยิ่งล็อกแน่น)
   */
  it('คำเชิญเดิมหมดอายุแล้ว → เชิญใหม่ได้ · ใบเก่าถูกปิดเป็น expired', async () => {
    expect((await as(leader).post(`/teams/${team}/invitations`).send({ invitedUserId: stranger.id })).status).toBe(201);
    await testDb().query('UPDATE team_invitations SET expires_at = NOW() - INTERVAL 1 DAY WHERE team_id = ?', [team]);

    expect((await as(leader).post(`/teams/${team}/invitations`).send({ invitedUserId: stranger.id })).status).toBe(201);

    const rows = await invitationsOf(team);
    expect(rows.map(r => r.team_invitation_status).sort()).toEqual(['expired', 'pending']);
  });

  it('เชิญผู้ใช้ที่ไม่มีอยู่ → 404', async () => {
    const res = await as(leader).post(`/teams/${team}/invitations`).send({ invitedUserId: 999999 });
    expect(res.status).toBe(404);
  });

  describe('ตอบคำเชิญ', () => {
    let invitation: number;
    beforeEach(async () => {
      const res = await as(leader).post(`/teams/${team}/invitations`).send({ invitedUserId: stranger.id });
      invitation = res.body.id;
    });

    it('BR-04: คนที่ถูกเชิญกดรับ → เป็นสมาชิก · ครบขั้นต่ำ (3) ⇒ ทีมเป็น Ready', async () => {
      expect((await teamRow(team))!.readiness_status).toBe('Forming');
      const res = await as(stranger).post(`/invitations/${invitation}/accept`);
      expect(res.status).toBe(200);
      expect(await isMember(team, stranger.id)).toBe(true);
      expect((await teamRow(team))!.readiness_status).toBe('Ready');
      expect(res.body).toMatchObject({ teamId: team, teamReadinessStatus: 'Ready' });
    });

    it('คนอื่น (ไม่ใช่คนที่ถูกเชิญ) กดรับแทน → 403 · ไม่มีใครถูกเพิ่ม', async () => {
      const res = await as(member).post(`/invitations/${invitation}/accept`);
      expect(res.status).toBe(403);
      expect(await isMember(team, stranger.id)).toBe(false);
      expect((await invitationsOf(team))[0]!.team_invitation_status).toBe('pending');
    });

    it('หัวหน้ากดรับแทนคนที่ถูกเชิญ → 403', async () => {
      expect((await as(leader).post(`/invitations/${invitation}/accept`)).status).toBe(403);
      expect(await isMember(team, stranger.id)).toBe(false);
    });

    it('รับซ้ำ → 409 INVITATION_ALREADY_ANSWERED', async () => {
      expect((await as(stranger).post(`/invitations/${invitation}/accept`)).status).toBe(200);
      const again = await as(stranger).post(`/invitations/${invitation}/accept`);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('INVITATION_ALREADY_ANSWERED');
    });

    it('คำเชิญหมดอายุ → 410 · ไม่ได้เป็นสมาชิก', async () => {
      await testDb().query('UPDATE team_invitations SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE team_invitation_id = ?', [invitation]);
      const res = await as(stranger).post(`/invitations/${invitation}/accept`);
      expect(res.status).toBe(410);
      expect(await isMember(team, stranger.id)).toBe(false);
    });

    it('BR-05: คนที่ถูกเชิญมีทีม Unofficial ครบ 5 แล้ว → 422 · ไม่ได้เป็นสมาชิก', async () => {
      for (let i = 0; i < 5; i++) await createTeam({ leader: stranger.id, sportTypeId: sport });
      const res = await as(stranger).post(`/invitations/${invitation}/accept`);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('TEAM_QUOTA_EXCEEDED');
      expect(await isMember(team, stranger.id)).toBe(false);
    });

    it('ปฏิเสธได้เฉพาะคนที่ถูกเชิญ', async () => {
      expect((await as(member).post(`/invitations/${invitation}/decline`)).status).toBe(403);
      expect((await as(stranger).post(`/invitations/${invitation}/decline`)).status).toBe(204);
      expect((await invitationsOf(team))[0]!.team_invitation_status).not.toBe('pending');
      expect(await isMember(team, stranger.id)).toBe(false);
    });

    it('หัวหน้ายกเลิกคำเชิญที่ยัง pending ได้ · สมาชิกยกเลิกไม่ได้', async () => {
      expect((await as(member).delete(`/teams/${team}/invitations/${invitation}`)).status).toBe(403);
      expect(await invitationsOf(team)).toHaveLength(1);
      expect((await as(leader).delete(`/teams/${team}/invitations/${invitation}`)).status).toBeLessThan(300);
    });
  });

  // 🔴 BR-05 ส่วนที่โค้ดยังไม่ได้ทำ (ดู invitation.service.test.ts) — ต้องเคาะกับทีมก่อนเขียนเป็นเทสจริง
  it.todo('BR-05: รับคำเชิญเข้าทีม Official ขณะอยู่ทีม Official อื่นในกีฬาเดียวกัน → 422');
});

// ───────────────────────────── คำขอเข้าร่วม (ทีม public) ─────────────────────────────

describe('คำขอเข้าร่วมทีม', () => {
  it('ทีม private → 409 TEAM_PRIVATE', async () => {
    const res = await as(stranger).post(`/teams/${team}/join-requests`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_PRIVATE');
  });

  describe('ทีม public', () => {
    let requestId: number;
    beforeEach(async () => {
      await testDb().query("UPDATE teams SET visibility = 'public' WHERE team_id = ?", [team]);
      const res = await as(stranger).post(`/teams/${team}/join-requests`).send({ message: 'ขอเข้าทีมครับ' });
      expect(res.status).toBe(201);
      requestId = res.body.id;
    });

    it('ส่งซ้ำระหว่างรอ → 409 JOIN_REQUEST_PENDING', async () => {
      const res = await as(stranger).post(`/teams/${team}/join-requests`).send({});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('JOIN_REQUEST_PENDING');
    });

    it('ดูรายการคำขอได้เฉพาะหัวหน้า', async () => {
      expect((await as(member).get(`/teams/${team}/join-requests`)).status).toBe(403);
      expect((await as(leader).get(`/teams/${team}/join-requests`)).status).toBe(200);
    });

    it('สมาชิก (ไม่ใช่หัวหน้า) อนุมัติ → 403 · คนขอยังไม่ได้เข้าทีม', async () => {
      const res = await as(member).post(`/teams/${team}/join-requests/${requestId}/approve`);
      expect(res.status).toBe(403);
      expect(await isMember(team, stranger.id)).toBe(false);
    });

    it('คนขออนุมัติคำขอตัวเอง → 403', async () => {
      expect((await as(stranger).post(`/teams/${team}/join-requests/${requestId}/approve`)).status).toBe(403);
      expect(await isMember(team, stranger.id)).toBe(false);
    });

    it('BR-04: หัวหน้าอนุมัติ → เป็นสมาชิก · ครบขั้นต่ำ ⇒ Ready (เส้นเดียวกับรับคำเชิญ)', async () => {
      const res = await as(leader).post(`/teams/${team}/join-requests/${requestId}/approve`);
      expect(res.status).toBe(200);
      expect(await isMember(team, stranger.id)).toBe(true);
      expect((await teamRow(team))!.readiness_status).toBe('Ready');
    });

    it('หัวหน้าปฏิเสธ → ไม่ได้เข้าทีม', async () => {
      expect((await as(leader).post(`/teams/${team}/join-requests/${requestId}/reject`).send({})).status).toBe(200);
      expect(await isMember(team, stranger.id)).toBe(false);
    });
  });
});

// ───────────────────────────── BR-07 คำร้องโอนหัวหน้า ─────────────────────────────

describe('POST /teams/:id/transfer-leader — BR-07 สร้างคำร้อง ไม่เปลี่ยนหัวหน้าทันที', () => {
  it('ทีม Official · หัวหน้าขอโอน → คำร้อง pending · หัวหน้ายังเป็นคนเดิม', async () => {
    await testDb().query("UPDATE teams SET official_status = 'Official' WHERE team_id = ?", [team]);
    const res = await as(leader).post(`/teams/${team}/transfer-leader`).send({ newLeaderId: member.id });
    expect(res.status).toBeLessThan(300);
    expect((await teamRow(team))!.leader_id).toBe(leader.id);
    expect(await one(
      "SELECT 1 FROM team_admin_requests WHERE team_id = ? AND request_type = 'leader_transfer' AND team_admin_request_status = 'pending'",
      [team])).not.toBeNull();
  });

  it('สมาชิกขอโอนหัวหน้าให้ตัวเอง → 403', async () => {
    await testDb().query("UPDATE teams SET official_status = 'Official' WHERE team_id = ?", [team]);
    expect((await as(member).post(`/teams/${team}/transfer-leader`).send({ newLeaderId: member.id })).status).toBe(403);
    expect(await one('SELECT 1 FROM team_admin_requests WHERE team_id = ?', [team])).toBeNull();
  });

  /**
   * 🆕 BE-10 (7 ต.ค. 2569 · มติ ⑦ ค) — สองเคสที่เคยได้ 201 ทั้งที่ไม่มีความหมาย
   *   แล้วไปนอนในคิวแอดมินให้คนตรวจเสียเวลา
   */
  describe('คำขอที่ไม่มีความหมาย (BE-10)', () => {
    beforeEach(async () => {
      await testDb().query("UPDATE teams SET official_status = 'Official' WHERE team_id = ?", [team]);
    });

    it('โอนหัวหน้าให้ตัวเอง (หัวหน้าปัจจุบัน) → 422 ALREADY_TEAM_LEADER · ไม่มีคำขอเกิดขึ้น', async () => {
      const res = await as(leader).post(`/teams/${team}/transfer-leader`).send({ newLeaderId: leader.id });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('ALREADY_TEAM_LEADER');
      expect(await one('SELECT 1 FROM team_admin_requests WHERE team_id = ?', [team])).toBeNull();
    });

    it('ขอโอนซ้ำขณะที่ใบเดิมยังรอ → 409 · มีใบเดียว', async () => {
      expect((await as(leader).post(`/teams/${team}/transfer-leader`).send({ newLeaderId: member.id })).status).toBeLessThan(300);

      const again = await as(leader).post(`/teams/${team}/transfer-leader`).send({ newLeaderId: member.id });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('TRANSFER_REQUEST_ALREADY_PENDING');

      expect(await all("SELECT 1 FROM team_admin_requests WHERE team_id = ? AND request_type = 'leader_transfer'", [team]))
        .toHaveLength(1);
    });
  });

  /**
   * 🆕 BE-10 (7 ต.ค. 2569 · มติ ⑦ ค) — ขอเป็นทีม Official ซ้ำ / ขอตอนเป็นแล้ว
   * ★ `supportingDocs` ต้องเป็น key ที่ผ่านด่านของ upload ⇒ ยิงผ่าน service ไม่ได้ตรง ๆ
   *   เทสนี้จึงสร้างใบ pending ลงฐานตรง ๆ แล้วทดสอบว่า "ใบที่สอง" ถูกปฏิเสธ
   */
  describe('ขอเป็นทีม Official ซ้ำ (BE-10)', () => {
    it('มีใบรอพิจารณาอยู่แล้ว → 409 OFFICIAL_REQUEST_ALREADY_PENDING', async () => {
      await insert('team_admin_requests', {
        team_id: team, request_type: 'official_status', requested_by: leader.id,
        team_admin_request_status: 'pending', supporting_docs: JSON.stringify(['official_docs/1/a.pdf']) });

      const res = await as(leader).post(`/teams/${team}/official-request`).send({ supportingDocs: ['official_docs/1/b.pdf'] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OFFICIAL_REQUEST_ALREADY_PENDING');
      expect(await all("SELECT 1 FROM team_admin_requests WHERE team_id = ? AND request_type = 'official_status'", [team]))
        .toHaveLength(1);
    });

    /** ★ ข้อความต้องต่างกัน — ทีมที่เป็น Official แล้วไม่ควรได้ยินว่า "รอแอดมินพิจารณา" */
    it('ทีมเป็น Official แล้ว → 409 TEAM_ALREADY_OFFICIAL', async () => {
      await testDb().query("UPDATE teams SET official_status = 'Official' WHERE team_id = ?", [team]);

      const res = await as(leader).post(`/teams/${team}/official-request`).send({ supportingDocs: ['official_docs/1/a.pdf'] });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TEAM_ALREADY_OFFICIAL');
    });
  });
});
