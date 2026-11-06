import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { one, testDb } from './helpers/db.js';
import { createSportType, createTeam, createUser, type TestUser } from './helpers/factories.js';

/**
 * 🔴 QA 30 ต.ค. 2569 (C1 · BR-05) — ทีม Official ได้ทีมเดียวต่อกีฬา ต้องไม่รั่วหลังแอดมินอนุมัติ
 *
 * เดิมตรวจแค่ตอนแอดมินอนุมัติคำขอ ⇒ คนในทีม Official A เข้าทีม Official B กีฬาเดียวกันได้ผ่านคำเชิญ/คำขอเข้าร่วม
 */
let player: TestUser;      // อยู่ทีม Official A แล้ว
let leaderA: TestUser;
let leaderB: TestUser;
let football: number;
let futsal: number;
let teamA: number;

beforeEach(async () => {
  football = await createSportType();
  futsal = await createSportType();
  player = await createUser();
  leaderA = await createUser();
  leaderB = await createUser();
  teamA = await createTeam({ leader: leaderA.id, sportTypeId: football, members: [player.id], official: true, name: 'ทีม Official A' });
});

const isMember = async (team: number, user: TestUser) =>
  (await one('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?', [team, user.id])) !== null;

/** หัวหน้าทีม B เชิญ (ถ้าเชิญได้) แล้วผู้เล่นกดรับ · คืนผลตอนกดรับ */
async function inviteAndAccept(teamB: number) {
  const invite = await as(leaderB).post(`/teams/${teamB}/invitations`).send({ invitedUserId: player.id });
  return { invite, accept: invite.status < 300 ? await as(player).post(`/invitations/${invite.body.id}/accept`) : null };
}

describe('คำเชิญ', () => {
  it('🔴 เทส 1: ทีม Official B กีฬาเดียวกัน → หัวหน้าเชิญไม่ได้ 422 MEMBER_CONFLICT พร้อมชื่อทีมที่ชน', async () => {
    const teamB = await createTeam({ leader: leaderB.id, sportTypeId: football, official: true });
    const { invite } = await inviteAndAccept(teamB);
    expect(invite.status).toBe(422);
    expect(invite.body.error.code).toBe('MEMBER_CONFLICT');
    expect(invite.body.error.conflictingTeam).toEqual({ id: teamA, name: 'ทีม Official A' });
  });

  it('🔴 ด่านจริง: เชิญตอนยังไม่ชน แล้วไปเข้าทีม Official อื่นก่อนกดรับ → กดรับไม่ได้ 422 · ไม่ได้เป็นสมาชิก', async () => {
    const teamB = await createTeam({ leader: leaderB.id, sportTypeId: football, official: true });
    await testDb().query('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamA, player.id]);
    const invite = await as(leaderB).post(`/teams/${teamB}/invitations`).send({ invitedUserId: player.id });
    expect(invite.status).toBe(201);
    await testDb().query('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)', [teamA, player.id]);   // กลับเข้าทีม A ระหว่างรอ

    const accept = await as(player).post(`/invitations/${invite.body.id}/accept`);
    expect(accept.status).toBe(422);
    expect(accept.body.error.code).toBe('MEMBER_CONFLICT');
    expect(await isMember(teamB, player)).toBe(false);
  });

  it('เทส 2: ทีม Official B คนละกีฬา → เข้าได้', async () => {
    const teamB = await createTeam({ leader: leaderB.id, sportTypeId: futsal, official: true });
    const { accept } = await inviteAndAccept(teamB);
    expect(accept!.status).toBe(200);
    expect(await isMember(teamB, player)).toBe(true);
  });

  it('เทส 3: ทีมธรรมดากีฬาเดียวกัน → เข้าได้ (กฎนี้ไม่ใช้กับทีมทั่วไป)', async () => {
    const teamB = await createTeam({ leader: leaderB.id, sportTypeId: football });
    const { accept } = await inviteAndAccept(teamB);
    expect(accept!.status).toBe(200);
    expect(await isMember(teamB, player)).toBe(true);
  });

  it('เทส 4: ถูกเอาออกจากทีม A แล้ว → เข้าทีม Official B ได้', async () => {
    const teamB = await createTeam({ leader: leaderB.id, sportTypeId: football, official: true });
    await testDb().query('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamA, player.id]);
    const { accept } = await inviteAndAccept(teamB);
    expect(accept!.status).toBe(200);
  });

  it('ทีม A ถูกลบไปแล้ว → ไม่นับว่าชน', async () => {
    const teamB = await createTeam({ leader: leaderB.id, sportTypeId: football, official: true });
    await testDb().query('UPDATE teams SET deleted_at = NOW() WHERE team_id = ?', [teamA]);
    const { accept } = await inviteAndAccept(teamB);
    expect(accept!.status).toBe(200);
  });
});

describe('🔴 เทส 5: คำขอเข้าร่วม (ไม่ใช่คำเชิญ)', () => {
  it('ขอเข้าทีม Official B กีฬาเดียวกัน → 422 MEMBER_CONFLICT ตั้งแต่ตอนขอ', async () => {
    const teamB = await createTeam({ leader: leaderB.id, sportTypeId: football, official: true, visibility: 'public' });
    const res = await as(player).post(`/teams/${teamB}/join-requests`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MEMBER_CONFLICT');
  });

  it('🔴 ด่านจริง: ขอตอนยังไม่ชน แล้วไปเข้าทีม Official อื่นก่อนหัวหน้าอนุมัติ → อนุมัติไม่ได้ 422', async () => {
    const teamB = await createTeam({ leader: leaderB.id, sportTypeId: football, official: true, visibility: 'public' });
    await testDb().query('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamA, player.id]);
    const req = await as(player).post(`/teams/${teamB}/join-requests`).send({});
    expect(req.status).toBe(201);
    await testDb().query('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)', [teamA, player.id]);

    const approve = await as(leaderB).post(`/teams/${teamB}/join-requests/${req.body.id}/approve`);
    expect(approve.status).toBe(422);
    expect(approve.body.error.code).toBe('MEMBER_CONFLICT');
    expect(await isMember(teamB, player)).toBe(false);
  });

  it('ทีมธรรมดากีฬาเดียวกัน → ขอและอนุมัติได้', async () => {
    const teamB = await createTeam({ leader: leaderB.id, sportTypeId: football, visibility: 'public' });
    const req = await as(player).post(`/teams/${teamB}/join-requests`).send({});
    expect(req.status).toBe(201);
    expect((await as(leaderB).post(`/teams/${teamB}/join-requests/${req.body.id}/approve`)).status).toBe(200);
  });
});
