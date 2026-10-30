import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * OD-82 (30 ต.ค. 2569 · ตรวจ SRS/SDS ข้อ 1.2 · มติผู้ใช้) — ยกเลิกทัวร์ ⇒ ปิดข้อโต้แย้งที่ค้าง
 *
 * ทำไม: งานลบรูปบัตรเช็คอินพักลบเมื่อมีข้อโต้แย้งค้าง (NF-SE-03) แต่ทัวร์ที่ถูกยกเลิกตัดสินข้อโต้แย้งต่อไม่ได้
 *   ⇒ ถ้าไม่ปิดตอนยกเลิก รูปบัตรค้างตลอดไป
 * ★ ปิดโดยไม่เปลี่ยนผลการแข่ง — สถิติ/ตารางคะแนนต้องเท่าเดิมเป๊ะ (หลักแช่แข็งของ OD-69)
 */
const deleted = vi.hoisted(() => [] as string[]);
vi.mock('../../services/upload.service.js', async (orig) => ({
  ...(await orig<typeof import('../../services/upload.service.js')>()),
  deleteObjectConfirmed: vi.fn(async (k: string) => { deleted.push(k); return true; }),
}));

import { as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import { createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, type TestUser } from './helpers/factories.js';
import { purgeCheckinDocuments } from '../../services/checkinDocs.service.js';

let organizer: TestUser;
let leaderA: TestUser;
let leaderB: TestUser;
let tour: number;
let teamA: number;
let teamB: number;

beforeEach(async () => {
  deleted.length = 0;
  const faculty = await createFaculty();
  const sport = await createSportType({ minMembers: 1, maxMembers: 5 });
  organizer = await createUser();
  leaderA = await createUser();
  leaderB = await createUser();
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  teamA = await createTeam({ leader: leaderA.id, sportTypeId: sport });
  teamB = await createTeam({ leader: leaderB.id, sportTypeId: sport });
});

/** แมตช์ที่ผลถูกโต้แย้ง · verified = ผลเคยยืนยันก่อนถูกโต้แย้ง */
async function disputedMatch(verified: boolean) {
  const match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'online', status: 'disputed' });
  const res = await insert('match_results', {
    match_id: match, winner_team_id: teamA, score_data: JSON.stringify({ [teamA]: 2, [teamB]: 1 }),
    submitted_by_user_id: leaderA.id, submitted_role: 'team_leader', match_result_status: 'disputed',
    verified_by_user_id: verified ? leaderB.id : null, verified_at: verified ? new Date(Date.now() - 10 * 86_400_000) : null,
    dispute_reason: 'นับแต้มผิด', dispute_raised_by: leaderB.id, dispute_raised_at: new Date(),
  });
  return { match, res };
}

const resultOf = (res: number) => one<{ status: string; resolution: string | null; resolvedBy: number | null; verifiedBy: number | null }>(
  `SELECT match_result_status AS status, dispute_resolution AS resolution, dispute_resolved_by AS resolvedBy,
          verified_by_user_id AS verifiedBy FROM match_results WHERE match_result_id = ?`, [res]);
const matchStatus = async (id: number) =>
  (await one<{ s: string }>('SELECT match_status AS s FROM matches WHERE match_id = ?', [id]))!.s;
const cancel = () => as(organizer).post(`/tournaments/${tour}/cancel`).send({ reason: 'สนามปิดซ่อม' });

describe('OD-82 — ยกเลิกทัวร์ปิดข้อโต้แย้งที่ค้าง', () => {
  it('ผลที่เคยยืนยันแล้ว → กลับเป็น verified · แมตช์ completed · บันทึกเหตุผลและคนปิด', async () => {
    const { match, res } = await disputedMatch(true);
    expect((await cancel()).status).toBe(200);

    expect(await resultOf(res)).toEqual({
      status: 'verified', resolution: 'ปิดอัตโนมัติเพราะทัวร์นาเมนต์ถูกยกเลิก — สนามปิดซ่อม', resolvedBy: organizer.id, verifiedBy: leaderB.id,
    });
    expect(await matchStatus(match)).toBe('completed');
  });

  it('ผลที่ยังไม่เคยยืนยัน → rejected · แมตช์ result_rejected', async () => {
    const { match, res } = await disputedMatch(false);
    expect((await cancel()).status).toBe(200);

    expect((await resultOf(res))!.status).toBe('rejected');
    expect(await matchStatus(match)).toBe('result_rejected');
  });

  it('มีหลักฐานใน audit_logs ต่อแมตช์', async () => {
    const a = await disputedMatch(true);
    const b = await disputedMatch(false);
    expect((await cancel()).status).toBe(200);

    const logs = await all<{ entity_id: number; details: { closedAs: string; matchResultId: number } }>(
      `SELECT entity_id, details FROM audit_logs WHERE action_type = 'match_dispute_closed_by_cancel' AND user_id = ? ORDER BY entity_id`,
      [organizer.id]);
    expect(logs.map(l => [l.entity_id, l.details.closedAs, l.details.matchResultId]))
      .toEqual([[a.match, 'verified', a.res], [b.match, 'rejected', b.res]]);
  });

  it('★ ไม่เปลี่ยนผลการแข่ง — ตารางคะแนนและสถิติผู้เล่นเท่าเดิม', async () => {
    await disputedMatch(true);
    await insert('tournament_standings', { tournament_id: tour, team_id: teamA, played: 1, won: 1, lost: 0, points: 3 });
    const before = await all('SELECT team_id, played, won, lost, points FROM tournament_standings WHERE tournament_id = ?', [tour]);
    const statsBefore = await all('SELECT user_id, matches_played, wins FROM player_profile_stats ORDER BY user_id');

    expect((await cancel()).status).toBe(200);

    expect(await all('SELECT team_id, played, won, lost, points FROM tournament_standings WHERE tournament_id = ?', [tour])).toEqual(before);
    expect(await all('SELECT user_id, matches_played, wins FROM player_profile_stats ORDER BY user_id')).toEqual(statsBefore);
  });

  it('เรื่องร้องเรียนที่เปิดอยู่ไม่ถูกปิด (ยังตัดสินต่อได้หลังยกเลิก)', async () => {
    const match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'online', status: 'completed' });
    const res = await insert('match_results', {
      match_id: match, winner_team_id: teamA, score_data: JSON.stringify({ [teamA]: 1 }),
      submitted_by_user_id: leaderA.id, submitted_role: 'team_leader', match_result_status: 'verified',
      verified_by_user_id: leaderB.id, verified_at: new Date(),
    });
    const complaint = await insert('match_result_complaints', {
      match_id: match, match_result_id: res, filed_by: leaderB.id, reason: 'นับประตูผิด', complaint_status: 'open',
    });
    expect((await cancel()).status).toBe(200);
    expect((await one<{ s: string }>('SELECT complaint_status AS s FROM match_result_complaints WHERE match_result_complaint_id = ?',
      [complaint]))!.s).toBe('open');
  });

  it('ปลายทาง: หลังยกเลิกเกิน 48 ชม. รูปบัตรเช็คอินของแมตช์ที่เคยโต้แย้งถูกลบได้ (ไม่ค้างตลอดไป)', async () => {
    const { match } = await disputedMatch(true);
    const key = `checkin_document/${match}/00000001-0000-4000-8000-000000000000.jpg`;
    await insert('match_checkins', {
      match_id: match, user_id: leaderA.id, method: 'photo_online', match_checkin_status: 'success',
      document_type: 'student_id', document_s3_key: key,
    });
    expect(await purgeCheckinDocuments()).toBe(0);   // ก่อนยกเลิก: โต้แย้งค้าง ⇒ พักลบ

    expect((await cancel()).status).toBe(200);
    await testDb().query('UPDATE tournaments SET cancelled_at = NOW() - INTERVAL 3 DAY WHERE tournament_id = ?', [tour]);

    expect(await purgeCheckinDocuments()).toBe(1);
    expect(deleted).toEqual([key]);
  });
});
