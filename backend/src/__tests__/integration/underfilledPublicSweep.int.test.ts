import { beforeEach, describe, expect, it } from 'vitest';
import { all, insert, one, testDb } from './helpers/db.js';
import {
  addTournamentReferee, createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';
import { autoDeleteUnderfilledPublicTournament, publishTournament } from '../../repositories/tournament.repo.js';
import { thaiDatePlusDays } from '../../utils/thaiDate.js';
import {
  sweepAutoDeleteTournaments, sweepUnderfilledPublicTournaments, UNDERFILLED_WARNING_DAYS, warnUnderfilledPublicTournaments,
} from '../../services/tournament.service.js';

/**
 * OD-81 (30 ต.ค. 2569 · เอกสารแก้ UI ข้อ 3) — ทัวร์ public ที่ทีมไม่ครบเมื่อถึงวันแข่ง ⇒ 'auto_deleted'
 *
 * มติผู้ใช้: ① ทีมไม่ครบ = ไม่มีแมตช์ + ทีมที่อนุมัติ < min_teams ② ใบ pending → cancelled
 *           ③ แจ้งผู้จัด · กรรมการ · ทีมที่สมัคร ④ เตือนล่วงหน้า 3 วัน
 *
 * ★ กรณีจากฐานเดโม: ทัวร์ 1 (ไม่มีใบสมัคร) · ทัวร์ 5 (ใบ pending 1) ⇒ ปิด
 *                    ทัวร์ 6 (ทีมครบแต่ไม่จับสาย) ⇒ ไม่ปิด — หน้าที่ผู้จัด
 */

let faculty: number;
let sport: number;
let organizer: TestUser;

// 31 ต.ค. 2569 — วันไทย ไม่ใช่วัน UTC (ช่วง 00:00–06:59 ไทย สองอย่างนี้คนละวัน)
const day = (offsetDays: number) => thaiDatePlusDays(Date.now(), offsetDays);

/** ทัวร์ public · min_teams = 4 · วันแข่งตามที่ส่ง */
async function tour(startDate: string, status = 'public'): Promise<number> {
  const id = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  await testDb().query('UPDATE tournaments SET tournament_status = ?, event_start_date = ?, min_teams = 4 WHERE tournament_id = ?',
    [status, startDate, id]);
  return id;
}

/** ทีมสมัครทัวร์ · คืนหัวหน้าทีม ผู้เล่น และ id ใบสมัคร */
async function apply(tournamentId: number, status: 'pending' | 'approved' | 'rejected') {
  const leader = await createUser();
  const player = await createUser();
  const team = await createTeam({ leader: leader.id, sportTypeId: sport, members: [player.id] });
  const app = await insert('tournament_applications', { tournament_id: tournamentId, team_id: team, tournament_application_status: status });
  await insert('application_players', { tournament_application_id: app, tournament_id: tournamentId, user_id: player.id });
  return { leader, player, team, app };
}

const statusOf = async (id: number) =>
  (await one<{ tournament_status: string }>('SELECT tournament_status FROM tournaments WHERE tournament_id = ?', [id]))!.tournament_status;
const appStatus = async (id: number) =>
  (await one<{ s: string }>('SELECT tournament_application_status AS s FROM tournament_applications WHERE tournament_application_id = ?', [id]))!.s;
const notified = async (type: string, tournamentId: number) =>
  (await all<{ user_id: number }>('SELECT user_id FROM notifications WHERE type = ? AND related_entity_id = ? ORDER BY user_id',
    [type, tournamentId])).map(r => r.user_id);

beforeEach(async () => {
  faculty = await createFaculty();
  sport = await createSportType({ minMembers: 1, maxMembers: 10 });
  organizer = await createUser();
});

describe('OD-81 — ปิดทัวร์ public ที่ทีมไม่ครบเมื่อถึงวันแข่ง', () => {
  it('ไม่มีใบสมัครเลย (แบบทัวร์ 1) + วันแข่งคือวันนี้ → auto_deleted · ปิดรับสมัคร', async () => {
    const id = await tour(day(0));
    await testDb().query('UPDATE tournaments SET registration_open = TRUE WHERE tournament_id = ?', [id]);

    expect(await sweepUnderfilledPublicTournaments()).toContain(id);
    expect(await statusOf(id)).toBe('auto_deleted');
    expect((await one<{ r: number }>('SELECT registration_open AS r FROM tournaments WHERE tournament_id = ?', [id]))!.r).toBe(0);
  });

  it('ใบ pending → cancelled (ไม่ใช่ rejected) · ใบ approved / rejected ไม่ถูกแตะ', async () => {
    const id = await tour(day(-1));
    const pending = await apply(id, 'pending');
    const approved = await apply(id, 'approved');
    const rejected = await apply(id, 'rejected');

    await sweepUnderfilledPublicTournaments();

    expect(await statusOf(id)).toBe('auto_deleted');
    expect(await appStatus(pending.app)).toBe('cancelled');
    expect(await appStatus(approved.app)).toBe('approved');
    expect(await appStatus(rejected.app)).toBe('rejected');
  });

  it('แจ้งผู้จัด · กรรมการ (ตอบรับแล้ว + ยังรอตอบ) · หัวหน้าทีมที่สมัคร · ผู้เล่นทีมที่ผ่าน — ไม่แจ้งทีมที่ถูกปฏิเสธไปแล้ว', async () => {
    const id = await tour(day(-1));
    const pending = await apply(id, 'pending');
    const approved = await apply(id, 'approved');
    const rejected = await apply(id, 'rejected');
    const refAccepted = await createUser();
    const refPending = await createUser();
    const refRejected = await createUser();
    await addTournamentReferee({ tournamentId: id, userId: refAccepted.id, invitedBy: organizer.id });
    await addTournamentReferee({ tournamentId: id, userId: refPending.id, invitedBy: organizer.id, invitationStatus: 'pending' });
    await addTournamentReferee({ tournamentId: id, userId: refRejected.id, invitedBy: organizer.id, invitationStatus: 'rejected' });

    await sweepUnderfilledPublicTournaments();

    const got = await notified('tournament_auto_deleted', id);
    // ★ หัวหน้าทีม pending ต้องได้ — รายชื่อต้องหา **ก่อน** ใบถูกเปลี่ยนเป็น cancelled
    expect(got).toEqual([organizer.id, pending.leader.id, approved.leader.id, approved.player.id, refAccepted.id, refPending.id]
      .sort((a, b) => a - b));
    expect(got).not.toContain(rejected.leader.id);
    expect(got).not.toContain(refRejected.id);

    const note = await one<{ message: string }>('SELECT message FROM notifications WHERE user_id = ? AND type = ?',
      [organizer.id, 'tournament_auto_deleted']);
    expect(note!.message).toContain('1 ทีม');          // อนุมัติแล้ว 1
    expect(note!.message).toContain('ขั้นต่ำ 4 ทีม');
    expect(note!.message).not.toContain('ยังไม่ได้เผยแพร่');
  });

  it('ทีมที่อนุมัติครบ min_teams แต่ยังไม่จับสาย (แบบทัวร์ 6) → ไม่ปิด · หน้าที่ผู้จัด', async () => {
    const id = await tour(day(-1));
    for (let i = 0; i < 4; i++) await apply(id, 'approved');
    expect(await sweepUnderfilledPublicTournaments()).not.toContain(id);
    expect(await statusOf(id)).toBe('public');
  });

  it('ทีมขาด 1 ทีม (3 จาก 4) → ปิด — เกณฑ์คือ "น้อยกว่าขั้นต่ำ" ไม่ใช่ "ไม่มีเลย"', async () => {
    const id = await tour(day(-1));
    for (let i = 0; i < 3; i++) await apply(id, 'approved');
    expect(await sweepUnderfilledPublicTournaments()).toContain(id);
  });

  it('มีแมตช์แล้ว (จับสายไปแล้ว) แม้ทีมไม่ครบ → ไม่แตะ', async () => {
    const id = await tour(day(-1));
    const a = await apply(id, 'approved');
    const b = await apply(id, 'approved');
    await createMatch({ tournamentId: id, teamA: a.team, teamB: b.team });
    await sweepUnderfilledPublicTournaments();
    expect(await statusOf(id)).toBe('public');
  });

  it('วันแข่งยังไม่ถึง (พรุ่งนี้) → ไม่ปิด', async () => {
    const id = await tour(day(1));
    await sweepUnderfilledPublicTournaments();
    expect(await statusOf(id)).toBe('public');
  });

  it.each(['private', 'pending_approval', 'completed', 'cancelled'])('สถานะ %s → งานนี้ไม่แตะ', async (status) => {
    const id = await tour(day(-1), status);
    await sweepUnderfilledPublicTournaments();
    expect(await statusOf(id)).toBe(status);
  });

  it('ทัวร์ที่ถูกลบแล้ว (deleted_at) → ไม่แตะ', async () => {
    const id = await tour(day(-1));
    await testDb().query('UPDATE tournaments SET deleted_at = NOW() WHERE tournament_id = ?', [id]);
    await sweepUnderfilledPublicTournaments();
    expect(await statusOf(id)).toBe('public');
  });

  /** ★ ระหว่าง SELECT ของงานกับ UPDATE ผู้จัดอาจอนุมัติทีมจนครบ ⇒ UPDATE ต้องเช็คเงื่อนไขซ้ำ ไม่เชื่อผล SELECT */
  it('ตัวปิดถูกเรียกกับทัวร์ที่ทีมครบแล้ว (อนุมัติแทรก) → ไม่ปิด · ใบ pending ไม่ถูกยกเลิก', async () => {
    const id = await tour(day(-1));
    for (let i = 0; i < 4; i++) await apply(id, 'approved');
    const pending = await apply(id, 'pending');

    expect(await autoDeleteUnderfilledPublicTournament(id)).toBeNull();
    expect(await statusOf(id)).toBe('public');
    expect(await appStatus(pending.app)).toBe('pending');
  });

  it('รันซ้ำ → ไม่ปิดซ้ำ ไม่แจ้งซ้ำ', async () => {
    const id = await tour(day(-1));
    await sweepUnderfilledPublicTournaments();
    expect(await sweepUnderfilledPublicTournaments()).not.toContain(id);
    expect(await notified('tournament_auto_deleted', id)).toEqual([organizer.id]);
  });

  it('งาน BR-03 เดิม (private) ยังไม่แตะทัวร์ public', async () => {
    const id = await tour(day(-1));
    await sweepAutoDeleteTournaments();
    expect(await statusOf(id)).toBe('public');
  });
});

describe('OD-81 — เตือนผู้จัด 3 วันก่อนปิด', () => {
  it(`เหลือ ${UNDERFILLED_WARNING_DAYS} วันพอดี → ผู้จัดได้คำเตือนพร้อมจำนวนทีม · คนอื่นไม่ได้`, async () => {
    const id = await tour(day(UNDERFILLED_WARNING_DAYS));
    const pending = await apply(id, 'pending');

    expect(await warnUnderfilledPublicTournaments()).toContain(id);

    expect(await notified('tournament_auto_delete_warning', id)).toEqual([organizer.id]);
    expect(await notified('tournament_auto_delete_warning', id)).not.toContain(pending.leader.id);
    const note = await one<{ message: string }>('SELECT message FROM notifications WHERE user_id = ? AND type = ?',
      [organizer.id, 'tournament_auto_delete_warning']);
    expect(note!.message).toContain(day(UNDERFILLED_WARNING_DAYS));
    expect(note!.message).toContain('ขั้นต่ำ 4 ทีม');
  });

  it('เหลือมากกว่า 3 วัน → ยังไม่เตือน', async () => {
    const id = await tour(day(UNDERFILLED_WARNING_DAYS + 1));
    expect(await warnUnderfilledPublicTournaments()).not.toContain(id);
  });

  it('ถึงวันแข่งแล้ว → ไม่เตือน (งานปิดรับช่วงต่อ)', async () => {
    const id = await tour(day(0));
    expect(await warnUnderfilledPublicTournaments()).not.toContain(id);
  });

  it('ทีมครบแล้ว → ไม่เตือน', async () => {
    const id = await tour(day(2));
    for (let i = 0; i < 4; i++) await apply(id, 'approved');
    expect(await warnUnderfilledPublicTournaments()).not.toContain(id);
  });

  it('รันซ้ำ → เตือนครั้งเดียว', async () => {
    const id = await tour(day(2));
    await warnUnderfilledPublicTournaments();
    expect(await warnUnderfilledPublicTournaments()).not.toContain(id);
    expect(await notified('tournament_auto_delete_warning', id)).toEqual([organizer.id]);
  });

  /** ★ ป้าย "เตือนแล้ว" ใช้คอลัมน์เดียวกับ BR-03 (private 7 วัน) — เผยแพร่ต้องล้าง ไม่งั้นทัวร์ public จะไม่ได้คำเตือนนี้เลย */
  it('เคยได้คำเตือนตอนยัง private แล้วเผยแพร่ → ป้ายถูกล้าง · ยังได้คำเตือนทีมไม่ครบ', async () => {
    const id = await tour(day(2), 'private');
    await testDb().query('UPDATE tournaments SET auto_delete_warned_at = NOW() WHERE tournament_id = ?', [id]);

    expect((await publishTournament(id, organizer.id, 0)).status).not.toBe('invalid_status');
    expect(await statusOf(id)).toBe('public');

    expect(await warnUnderfilledPublicTournaments()).toContain(id);
  });
});

/** 🔴 31 ต.ค. 2569 — ขอบวันตามเวลาไทย (เหตุผลเดียวกับ tournamentAutoDelete.int.test.ts) · ตรึงเวลาเอง */
describe('OD-81 — นับวันตามเวลาไทย', () => {
  it('ตี 1 ไทยของวันแข่ง → ปิด · 23:30 ไทยของวันก่อนหน้า → ยังไม่ปิด', async () => {
    const id = await tour('2030-01-10');
    await sweepUnderfilledPublicTournaments(new Date('2030-01-09T23:30:00+07:00'));
    expect(await statusOf(id)).toBe('public');
    await sweepUnderfilledPublicTournaments(new Date('2030-01-10T01:00:00+07:00'));
    expect(await statusOf(id)).toBe('auto_deleted');
  });

  it('เตือน 3 วัน นับจากวันไทย — ตี 1 ไทยของวันที่ 7 ทัวร์วันที่ 10 อยู่ในช่วงแล้ว', async () => {
    const id = await tour('2030-01-10');
    expect(await warnUnderfilledPublicTournaments(new Date('2030-01-07T01:00:00+07:00'))).toContain(id);
  });
});
