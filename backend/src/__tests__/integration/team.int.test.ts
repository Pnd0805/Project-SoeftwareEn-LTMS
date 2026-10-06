import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anon, as } from './helpers/api.js';
import { all, one, testDb } from './helpers/db.js';
import { createSportType, createTeam, createUser, type TestUser } from './helpers/factories.js';

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
   * 🐞 บั๊กที่ integration test เจอ (6 ต.ค.) — ยังไม่ได้แก้ production
   *   requireTeamLeader ใช้ Number(req.params.id) แทน parseId ⇒ 'abc' กลายเป็น NaN
   *   mysql2 เขียน NaN ลง SQL เป็นคำเปล่า ⇒ MySQL อ่านเป็นชื่อคอลัมน์ ⇒ "Unknown column 'NaN'" ⇒ 500
   *   กระทบทุก route ที่ผ่าน requireTeamLeader (10 route)
   *   unit test เชื่อว่าได้ 404 (คอมเมนต์ใน team.controller.test.ts) เพราะ repo ถูก mock
   * ทางแก้: requireTeamLeader ใช้ parseId(req.params['id'], 'รหัสทีม', 'id') แบบเดียวกับ requireOrganizer
   * ★ it.fails = เทสนี้ "ผ่าน" ตราบที่บั๊กยังอยู่ · แก้แล้วจะแดง ⇒ เปลี่ยนเป็น it ธรรมดา
   */
  it.fails('id ทีมไม่ใช่ตัวเลข → 4xx ไม่ใช่ 500 (บั๊ก: ตอนนี้ได้ 500)', async () => {
    // errorHandler พิมพ์ error ที่ไม่คาดคิดลง stderr — ปิดไว้เฉพาะเทสนี้ (เป็นอาการของบั๊กที่รู้อยู่แล้ว)
    // ★ try/finally เพราะ it.fails คาดว่า expect ข้างในจะพัง — ไม่งั้น spy ค้างไปปิด log ของเทสถัดไป
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await as(leader).patch('/teams/abc').send({ name: 'x' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    } finally {
      spy.mockRestore();
    }
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
});
