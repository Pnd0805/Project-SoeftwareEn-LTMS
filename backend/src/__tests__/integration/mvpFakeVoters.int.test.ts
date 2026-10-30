import { beforeEach, describe, expect, it } from 'vitest';
import { anon } from './helpers/api.js';
import { insert, testDb } from './helpers/db.js';
import { createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, type TestUser } from './helpers/factories.js';

/**
 * 🔴 QA 30 ต.ค. 2569 (C2) — ชนะ MVP ด้วยบัญชีปลอม
 *
 * `MVP_MIN_VOTES = 3` + ด่านยืนยันอีเมลปิด ⇒ สมัคร 3 บัญชีโหวตให้ตัวเองได้ MVP
 * มติ: นับเฉพาะโหวตจากคนที่อยู่ในรายชื่อลงแข่ง (application_players ของใบสมัคร approved) ในทัวร์นั้น
 */
let organizer: TestUser;
let cheater: TestUser;     // ผู้เล่นทีม A ที่ปั๊มโหวตให้ตัวเอง
let honest: TestUser;      // ผู้เล่นทีม B
let tour: number;
let match: number;

beforeEach(async () => {
  const sport = await createSportType();
  organizer = await createUser();
  cheater = await createUser();
  honest = await createUser();
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: await createFaculty(), status: 'public' });
  const teamA = await createTeam({ leader: cheater.id, sportTypeId: sport });
  const teamB = await createTeam({ leader: honest.id, sportTypeId: sport });
  for (const [team, player] of [[teamA, cheater], [teamB, honest]] as const) {
    const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
    await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: player.id });
  }
  match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'onsite', status: 'completed' });
  // ปิดโหวตแล้ว (จบเกิน 24 ชม.) ⇒ ประกาศผลได้ และนับใน mvpTimes
  await testDb().query('UPDATE matches SET actual_end_time = NOW() - INTERVAL 2 DAY WHERE match_id = ?', [match]);
  for (const p of [cheater, honest]) {
    await insert('match_checkins', { match_id: match, user_id: p.id, method: 'qr_onsite', match_checkin_status: 'success' });
  }
});

/** ผู้เล่นในรายชื่อลงแข่งของทีมอื่นในทัวร์เดียวกัน (ไม่ได้ลงแมตช์นี้) */
async function rosterVoter() {
  const voter = await createUser();
  const team = await createTeam({ leader: voter.id, sportTypeId: (await createSportType()) });
  const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
  await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: voter.id });
  return voter;
}
const vote = (voter: TestUser, forUser: TestUser) => insert('tournament_feedback', {
  tournament_id: tour, match_id: match, user_id: voter.id, feedback_type: 'mvp_vote', voted_for_user_id: forUser.id,
});
const votesOf = async (user: TestUser) => {
  const res = await anon.get(`/matches/${match}/mvp-votes`);
  return (res.body.candidates as { userId: number; votes: number }[]).find(c => c.userId === user.id)!.votes;
};

describe('C2 — โหวตจากบัญชีที่ไม่ได้อยู่ในรายชื่อลงแข่งของทัวร์ ไม่นับ', () => {
  it('🔴 บัญชีปลอม 3 บัญชีโหวตให้ตัวเอง → ไม่ได้ MVP · ยอด 0 · โหวตจริง 1 ใบชนะ', async () => {
    for (let i = 0; i < 3; i++) await vote(await createUser(), cheater);   // บัญชีที่สมัครมาเพื่อโหวต
    await vote(await rosterVoter(), honest);

    const res = await anon.get(`/matches/${match}/mvp-votes`);
    expect(res.status).toBe(200);
    expect(res.body.winners).toEqual([honest.id]);
    expect(await votesOf(cheater)).toBe(0);
    expect(await votesOf(honest)).toBe(1);
  });

  it('🔴 โปรไฟล์: บัญชีปลอมไม่ทำให้ได้ mvpVotes / mvpTimes', async () => {
    for (let i = 0; i < 3; i++) await vote(await createUser(), cheater);
    const stats = await anon.get(`/users/${cheater.id}/stats`);
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({ mvpVotes: 0, mvpTimes: 0 });
  });

  it('โหวตจากคนในรายชื่อลงแข่ง 3 คน → นับครบ · ได้ MVP ในโปรไฟล์', async () => {
    for (let i = 0; i < 3; i++) await vote(await rosterVoter(), honest);
    expect(await votesOf(honest)).toBe(3);
    expect((await anon.get(`/users/${honest.id}/stats`)).body).toMatchObject({ mvpVotes: 3, mvpTimes: 1 });
  });

  it('ใบสมัครที่ยังไม่อนุมัติ → ผู้เล่นในใบนั้นยังไม่นับ', async () => {
    const voter = await createUser();
    const team = await createTeam({ leader: voter.id, sportTypeId: await createSportType() });
    const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'pending' });
    await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: voter.id });
    await vote(voter, honest);
    expect(await votesOf(honest)).toBe(0);
  });
});
