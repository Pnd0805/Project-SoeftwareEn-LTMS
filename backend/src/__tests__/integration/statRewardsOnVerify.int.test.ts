import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { all, insert } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';

/**
 * OD-79 (30 ต.ค. 2569 · เอกสารแก้ UI ข้อ 15) — เหรียญสายสถิติแจกตอนยืนยันผลแมตช์ ไม่ต้องรอปิดทัวร์
 *
 * ★ ใช้แคตตาล็อกจริงจาก 041_reward_catalogue.sql (ตารางนี้ไม่ถูกล้างระหว่างเทส)
 *   "ลงแข่งครั้งแรก" = matches_played ≥ 1 · "ชนะครั้งแรก" = wins ≥ 1
 * ★ พิสูจน์ของที่ unit พิสูจน์ไม่ได้: ลำดับจริงในฐาน — ประเมินหลังบวกสถิติในทรานแซกชันเดียวกัน
 *   ถ้าประเมินก่อนบวก ผู้ชนะแมตช์แรกจะไม่ได้เหรียญ (สถิติยังเป็น 0)
 */

let organizer: TestUser;
let referee: TestUser;
let leaderA: TestUser;
let leaderB: TestUser;
let tour: number;
let teamA: number;
let teamB: number;
let match: number;

beforeEach(async () => {
  const faculty = await createFaculty();
  const sport = await createSportType();
  organizer = await createUser();
  referee = await createUser();
  leaderA = await createUser();
  leaderB = await createUser();
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  teamA = await createTeam({ leader: leaderA.id, sportTypeId: sport });
  teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport });
  for (const [team, user] of [[teamA, leaderA.id], [teamB, leaderB.id]] as const) {
    const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
    await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: user });
  }
  // ★ นัดชิง (ไม่มีแมตช์ถัดไป) — ปฏิเสธ/แก้ผลได้โดยไม่ติดด่าน NEXT_MATCH_STARTED
  match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'onsite', status: 'finished' });
  const refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
  await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
  expect((await as(referee).post(`/matches/${match}/result`)
    .send({ winnerTeamId: teamA, scoreData: { [teamA]: 3, [teamB]: 1 } })).status).toBe(201);
});

const badgesOf = async (userId: number) =>
  (await all<{ name: string }>(
    `SELECT r.name FROM user_rewards ur JOIN rewards r ON r.reward_id = ur.reward_id
      WHERE ur.user_id = ? ORDER BY r.name`, [userId])).map(r => r.name);

describe('เหรียญสายสถิติตอนยืนยันผล (OD-79)', () => {
  it('ส่งผลแล้วแต่ยังไม่ยืนยัน → ยังไม่มีใครได้เหรียญ', async () => {
    expect(await badgesOf(leaderA.id)).toEqual([]);
    expect(await badgesOf(leaderB.id)).toEqual([]);
  });

  it('ยืนยันผล → ผู้ชนะได้ "ชนะครั้งแรก" ทันที · ผู้แพ้ได้แค่ "ลงแข่งครั้งแรก" · ทัวร์ยังไม่ปิด', async () => {
    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);

    expect(await badgesOf(leaderA.id)).toEqual(expect.arrayContaining(['ชนะครั้งแรก', 'ลงแข่งครั้งแรก']));
    expect(await badgesOf(leaderB.id)).toEqual(['ลงแข่งครั้งแรก']);
    expect(await all('SELECT 1 FROM tournaments WHERE tournament_id = ? AND tournament_status = ?', [tour, 'public'])).toHaveLength(1);
  });

  it('ผู้จัดปฏิเสธผลที่ยืนยันแล้ว → สถิติถอย · เหรียญที่ไม่ถึงเกณฑ์แล้วถูกริบ', async () => {
    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);
    expect((await as(leaderB).post(`/matches/${match}/result/dispute`).send({ reason: 'กรรมการนับแต้มผิด' })).status).toBeLessThan(300);

    const res = await as(organizer).post(`/matches/${match}/result/resolve`)
      .send({ resolution: 'reject', resolutionNote: 'ผลไม่ตรงกับวิดีโอ' });
    expect([res.status, res.body?.error?.code]).toEqual([200, undefined]);

    expect(await badgesOf(leaderA.id)).toEqual([]);
    expect(await badgesOf(leaderB.id)).toEqual([]);
  });

  it('ผู้จัดแก้ผลสลับผู้ชนะ → เหรียญ "ชนะครั้งแรก" ย้ายไปผู้ชนะใหม่ · "ลงแข่งครั้งแรก" อยู่ครบทั้งคู่', async () => {
    expect((await as(leaderA).post(`/matches/${match}/result/verify`)).status).toBe(200);
    expect((await as(leaderB).post(`/matches/${match}/result/dispute`).send({ reason: 'กรรมการนับแต้มผิด' })).status).toBeLessThan(300);

    const res = await as(organizer).post(`/matches/${match}/result/resolve`).send({
      resolution: 'amend', resolutionNote: 'ทีม B ชนะจริง',
      winnerTeamId: teamB, scoreData: { [teamA]: 1, [teamB]: 2 },
    });
    expect([res.status, res.body?.error?.code]).toEqual([200, undefined]);

    expect(await badgesOf(leaderA.id)).toEqual(['ลงแข่งครั้งแรก']);
    expect(await badgesOf(leaderB.id)).toEqual(expect.arrayContaining(['ชนะครั้งแรก', 'ลงแข่งครั้งแรก']));
  });
});
