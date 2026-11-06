import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { insert, testDb } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';

/**
 * ใครโหวต MVP ของแมตช์หนึ่งได้ — มติเจ้าของงาน 30 ต.ค. 2569 (แก้ของ QA C2 รอบแรก)
 *
 * **โหวตได้ทุกคนที่ล็อกอิน ยกเว้นคนที่มีส่วนเกี่ยวข้องกับแมตช์นั้น**
 *   ① ORG ของทัวร์นั้น  ② กรรมการของแมตช์นั้น  ③ คนในสองทีมที่ลงแข่งแมตช์นั้น
 *
 * 🔴 ไฟล์นี้แทน `mvpFakeVoters.int.test.ts` ของ C2 รอบแรก ซึ่งนับเฉพาะคนในรายชื่อลงแข่งของทัวร์
 *   เทสชุดนี้จึง **กลับทิศ** ของชุดนั้นโดยเจตนา ไม่ใช่เทสที่ลืมอัปเดต
 *
 * ★ เทสทั้งสองด้าน: ทั้ง 403 ตอนกดโหวต และยอดที่นับได้ตอนอ่านผล
 *   กฎนี้เขียนไว้สองที่ (`findMvpVoterConflict` กับ `mvpEligibleVoterSql`) ⇒ ถ้าแก้ไม่ครบทั้งคู่
 *   จะเกิดสภาพ "กดผ่านแต่ไม่ถูกนับ" ซึ่งเทสด้านเดียวจับไม่ได้
 */
let organizer : TestUser;
let playerA : TestUser;    // หัวหน้า/ผู้เล่นทีม A
let playerB : TestUser;    // หัวหน้า/ผู้เล่นทีม B
let sport : number;
let tour : number;
let match : number;
let teamAId : number;

beforeEach(async () => {
  sport = await createSportType();
  organizer = await createUser();
  playerA = await createUser();
  playerB = await createUser();
  tour = await createTournament({ organizer : organizer.id, sportTypeId : sport, facultyId : await createFaculty(), status : 'public' });
  const teamA = await createTeam({ leader : playerA.id, sportTypeId : sport });
  teamAId = teamA;
  const teamB = await createTeam({ leader : playerB.id, sportTypeId : sport });
  for (const [team, player] of [[teamA, playerA], [teamB, playerB]] as const) {
    const app = await insert('tournament_applications', { tournament_id : tour, team_id : team, tournament_application_status : 'approved' });
    await insert('application_players', { tournament_application_id : app, tournament_id : tour, user_id : player.id });
  }
  match = await createMatch({ tournamentId : tour, teamA, teamB, mode : 'onsite', status : 'completed' });
  // ปิดโหวตแล้ว (จบเกิน 24 ชม.) ⇒ ประกาศผลได้ และนับใน mvpTimes
  await testDb().query('UPDATE matches SET actual_end_time = NOW() - INTERVAL 2 DAY WHERE match_id = ?', [match]);
  for (const p of [playerA, playerB]) {
    await insert('match_checkins', { match_id : match, user_id : p.id, method : 'qr_onsite', match_checkin_status : 'success' });
  }
});

/** คนนอกสนิท: ล็อกอินได้ ไม่อยู่ในทัวร์นี้ ไม่อยู่ทีมไหน — กลุ่มเป้าหมายของกฎใหม่ */
const outsider = () => createUser();

/** ใส่โหวตตรงฐาน — ใช้ตรวจ "ยอดที่นับได้" โดยไม่ต้องผ่านด่านตอนกด (หน้าต่างโหวตปิดแล้ว) */
const vote = (voter : TestUser, forUser : TestUser) => insert('tournament_feedback', {
  tournament_id : tour, match_id : match, user_id : voter.id, feedback_type : 'mvp_vote', voted_for_user_id : forUser.id,
});

const votesOf = async (user : TestUser) => {
  const res = await anon.get(`/matches/${match}/mvp-votes`);
  return (res.body.candidates as { userId : number; votes : number }[]).find(c => c.userId === user.id)!.votes;
};

/** แมตช์ที่ยังโหวตได้ (จบเมื่อครู่) — ด่านตอนกดต้องทดสอบในหน้าต่างที่เปิดอยู่ */
async function openMatchForVoting() {
  await testDb().query('UPDATE matches SET actual_end_time = NOW() - INTERVAL 10 MINUTE WHERE match_id = ?', [match]);
}

async function makeMatchReferee(matchId : number) {
  const ref = await createUser();
  const tournamentRefereeId = await addTournamentReferee({ tournamentId : tour, userId : ref.id, invitedBy : organizer.id });
  await assignMatchReferee({ matchId, tournamentRefereeId });
  return ref;
}

describe('ตอนกดโหวต — 403 เฉพาะคนที่เกี่ยวข้องกับแมตช์นั้น', () => {
  beforeEach(openMatchForVoting);

  it('★ คนนอกที่ไม่เกี่ยวข้องกับแมตช์เลย โหวตได้ — ไม่ต้องอยู่ในรายชื่อลงแข่งของทัวร์', async () => {
    const res = await as(await outsider()).post(`/matches/${match}/mvp-votes`).send({ userId : playerA.id });
    expect(res.status).toBe(201);
  });

  it.each([
    ['ORG ของทัวร์', () => organizer, 'organizer'],
    ['หัวหน้าทีมที่ลงแข่ง', () => playerA, 'team_member'],
  ])('%s โหวตไม่ได้ (403 + บอกเหตุผล)', async (_label, who, reason) => {
    const res = await as(who()).post(`/matches/${match}/mvp-votes`).send({ userId : playerB.id });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code : 'MVP_VOTER_NOT_ELIGIBLE', reason });
  });

  it('กรรมการของแมตช์นี้โหวตไม่ได้ (403)', async () => {
    const ref = await makeMatchReferee(match);
    const res = await as(ref).post(`/matches/${match}/mvp-votes`).send({ userId : playerA.id });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code : 'MVP_VOTER_NOT_ELIGIBLE', reason : 'referee' });
  });

  /**
   * ★ ขอบของกฎที่ผู้ใช้เคาะไว้: ยกเว้น "กรรมการของแมตช์นั้น" ไม่ใช่ "กรรมการของทัวร์นั้น"
   *   กรรมการแมตช์อื่นไม่มีส่วนได้ส่วนเสียกับแมตช์นี้ ⇒ โหวตได้
   */
  it('กรรมการของ **แมตช์อื่น** ในทัวร์เดียวกัน ยังโหวตแมตช์นี้ได้', async () => {
    const otherMatch = await createMatch({ tournamentId : tour, teamA : null, teamB : null, mode : 'onsite' });
    const ref = await makeMatchReferee(otherMatch);
    const res = await as(ref).post(`/matches/${match}/mvp-votes`).send({ userId : playerA.id });
    expect(res.status).toBe(201);
  });

  it('สมาชิกทีม (ไม่ใช่หัวหน้า) ที่ไม่ได้ลงสนามก็โหวตไม่ได้ — กันทั้งทีม', async () => {
    const bench = await createUser();
    await insert('team_members', { team_id : teamAId, user_id : bench.id });
    const res = await as(bench).post(`/matches/${match}/mvp-votes`).send({ userId : playerB.id });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ reason : 'team_member' });
  });

  it('canVote ในผลโหวตตรงกับด่านตอนกดจริง', async () => {
    expect((await as(await outsider()).get(`/matches/${match}/mvp-votes`)).body.canVote).toBe(true);
    expect((await as(organizer).get(`/matches/${match}/mvp-votes`)).body.canVote).toBe(false);
    const ref = await makeMatchReferee(match);
    expect((await as(ref).get(`/matches/${match}/mvp-votes`)).body.canVote).toBe(false);
  });
});

describe('ตอนนับคะแนน — โหวตของคนที่เกี่ยวข้องไม่ถูกนับ', () => {
  it('★ โหวตจากคนนอก 3 คน นับครบ และได้ MVP ในโปรไฟล์', async () => {
    for (let i = 0; i < 3; i++) await vote(await outsider(), playerB);
    expect(await votesOf(playerB)).toBe(3);
    expect((await anon.get(`/users/${playerB.id}/stats`)).body).toMatchObject({ mvpVotes : 3, mvpTimes : 1 });
  });

  it('โหวตของ ORG · กรรมการแมตช์นี้ · คนในทีมที่ลงแข่ง ไม่ถูกนับเลย', async () => {
    const ref = await makeMatchReferee(match);
    await vote(organizer, playerA);
    await vote(ref, playerA);
    await vote(playerB, playerA);            // ทีมฝ่ายตรงข้าม = คนในแมตช์
    expect(await votesOf(playerA)).toBe(0);
    expect((await anon.get(`/users/${playerA.id}/stats`)).body).toMatchObject({ mvpVotes : 0, mvpTimes : 0 });
  });

  /**
   * ★ ขอบที่ตัดสินตามตัวอักษรของกฎ: ยกเว้น "กรรมการของแมตช์นั้น" = กรรมการ **ปัจจุบัน**
   *   ⇒ คนที่ถูก ORG ถอนออกจากทัวร์แล้วไม่ใช่กรรมการของแมตช์นี้อีก โหวตจึงถูกนับ
   *   🔴 อีกทางเลือกคือ "ใครที่เคยรับแมตช์นี้ก็ห้ามตลอด" ซึ่งปิดช่อง "ให้ถอนตัวแล้วค่อยโหวต" ได้ด้วย
   *     ยังไม่ทำเพราะเกินกฎที่เคาะไว้ — ถ้าจะเปลี่ยน ให้ตัด `removed_at IS NULL` ออกจาก **ทั้งสองที่**
   *     (`findMvpVoterConflict` และ `mvpEligibleVoterSql`) แล้วเทสนี้จะแดงให้เห็นว่าเปลี่ยนแล้วจริง
   */
  it('กรรมการที่ถูกถอนออกจากทัวร์ (removed) ไม่ใช่กรรมการของแมตช์นี้อีก → โหวตถูกนับ', async () => {
    const ref = await makeMatchReferee(match);
    await vote(ref, playerA);
    await testDb().query('UPDATE tournament_referees SET removed_at = NOW(), removed_by = ? WHERE user_id = ?', [organizer.id, ref.id]);
    expect(await votesOf(playerA)).toBe(1);
  });

  it('โหวตที่กรรมการยังไม่ตอบรับแมตช์ (pending) ถูกนับ — ยังไม่เป็นกรรมการของแมตช์นี้', async () => {
    const ref = await createUser();
    const tournamentRefereeId = await addTournamentReferee({ tournamentId : tour, userId : ref.id, invitedBy : organizer.id });
    await assignMatchReferee({ matchId : match, tournamentRefereeId, status : 'pending' });
    await vote(ref, playerA);
    expect(await votesOf(playerA)).toBe(1);
  });

  /**
   * 🔴 ช่องที่ยัง **เปิดอยู่และรู้ตัว** — QA C2 ข้อเดิมที่กฎนี้ไม่ได้ปิด
   *   `MVP_MIN_VOTES = 3` + ด่านยืนยันอีเมลปิด ⇒ สมัคร 3 บัญชีโหวตให้ตัวเองก็ยังได้ MVP
   *   เทสนี้มีไว้ให้คนอ่านรู้ว่า "ไม่ได้ลืม" และถ้าวันหนึ่งกฎเรื่องตัวบัญชีถูกเพิ่ม เทสนี้จะแดงให้เห็นทันที
   */
  it('🔴 ข้อจำกัดที่ยอมรับ: บัญชีใหม่ 3 บัญชีโหวตให้คนเดียวกัน ยังนับครบ 3', async () => {
    for (let i = 0; i < 3; i++) await vote(await createUser(), playerA);
    expect(await votesOf(playerA)).toBe(3);
  });
});
