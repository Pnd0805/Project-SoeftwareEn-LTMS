import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { insert, testDb } from './helpers/db.js';
import {
  addTournamentReferee, createFaculty, createSportType, createTeam, createTournament, createUser, type TestUser,
} from './helpers/factories.js';

/**
 * 🆕 8 ต.ค. 2569 (FE ขอ) — `TEAM_CONFLICT_OF_INTEREST` ฝั่ง "เข้าทีม" ต้องบอก
 * `invitationStatus` + `expiresAt` เหมือนที่ฝั่ง "สมัครทัวร์" ได้ไปแล้วตอน BE-13
 *
 * ทำไมสำคัญ: pending กับ accepted ผู้ใช้ต้องทำคนละเรื่อง
 *   pending  = เขายัง **ไม่ได้ตอบรับ** → ให้เขาปฏิเสธ · ให้ผู้จัดยกเลิก · หรือรอหมดอายุ 7 วัน
 *   accepted = เขา **เป็นกรรมการจริง** → ต้องเลิกบทบาทก่อน
 * เดิมได้ข้อความเดียวกันทั้งสองกรณี ⇒ คนที่เจอ pending ไปตามให้ "เลิกเป็นกรรมการ"
 * ซึ่งไม่มีอะไรให้เลิก = ทางตัน
 *
 * ★ ไฟล์นี้ยิง API จริงถึงฐานจริง เพราะการแก้รอบนี้อยู่ใน **SQL** (เปลี่ยน EXISTS เป็น
 *   LEFT JOIN LATERAL เพื่ออ่านคอลัมน์จากแถวเดียวกับที่ใช้ตัดสิน) — เทส unit ที่ mock repo
 *   พิสูจน์ได้แค่ว่า service ส่งต่อถูก ไม่ได้พิสูจน์ว่าคิวรีคืนค่าถูก
 * ★ และพิสูจน์ด้วยว่าการเขียน SQL ใหม่ **ไม่เปลี่ยนว่าใครชน** — เคสหมดอายุยังผ่านเหมือนเดิม
 */

let sport: number;
let faculty: number;
let leader: TestUser;
let invitee: TestUser;
let organizer: TestUser;
let team: number;
let tour: number;

beforeEach(async () => {
  sport = await createSportType({ minMembers: 2, maxMembers: 10 });
  faculty = await createFaculty();
  leader = await createUser();
  invitee = await createUser();
  organizer = await createUser();
  team = await createTeam({ leader: leader.id, sportTypeId: sport });
  tour = await createTournament({
    organizer: organizer.id, sportTypeId: sport, facultyId: faculty,
    status: 'public', name: 'ทัวร์ที่ทีมนี้สมัครอยู่',
  });
  // ทีมสมัครทัวร์นี้ไว้แล้ว (pending) — เงื่อนไขตั้งต้นของกฎ CoI ทั้งหมด
  await insert('tournament_applications', {
    tournament_id: tour, team_id: team, tournament_application_status: 'pending',
  });
});

const invite = () =>
  as(leader).post(`/teams/${team}/invitations`).send({ invitedUserId: invitee.id });

describe('เชิญเข้าทีม — คนที่ถูกเชิญเป็นกรรมการของทัวร์ที่ทีมนี้สมัคร', () => {
  it("ตอบรับคำเชิญกรรมการแล้ว → invitationStatus 'accepted' และไม่มีทางลัด", async () => {
    await addTournamentReferee({ tournamentId: tour, userId: invitee.id, invitedBy: organizer.id,
                                 invitationStatus: 'accepted' });

    const res = await invite();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_CONFLICT_OF_INTEREST');
    // ★ errorHandler กระจาย `extra` ลงใน `error` ตรง ๆ ไม่มีชั้น `extra` ในคำตอบจริง
    expect(res.body.error).toMatchObject({ tournamentId: tour, role: 'referee', invitationStatus: 'accepted' });
    // accepted ไม่มีวันหมดอายุให้รอ ⇒ ต้องไม่หลอกว่ารอได้
    expect(res.body.error.expiresAt).toBeNull();
    expect(res.body.error.message).not.toContain('หมดอายุ');
  });

  /** 🔴 เคสที่เป็นเหตุผลของการแก้รอบนี้ — เดิมบอกว่า "เป็นกรรมการ" ทั้งที่ยังไม่ได้ตอบรับ */
  it("ถูกเชิญเป็นกรรมการแต่ยังไม่ตอบ → invitationStatus 'pending' + expiresAt + บอกทางออกที่ทำได้จริง", async () => {
    const trId = await addTournamentReferee({ tournamentId: tour, userId: invitee.id, invitedBy: organizer.id,
                                              invitationStatus: 'pending' });
    await testDb().query(
      'UPDATE tournament_referees SET expires_at = NOW() + INTERVAL 7 DAY WHERE tournament_referee_id = ?', [trId]);

    const res = await invite();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ tournamentId: tour, role: 'referee', invitationStatus: 'pending' });
    expect(typeof res.body.error.expiresAt).toBe('string');
    // ข้อความต้องพาไปทางที่ทำได้จริง ไม่ใช่ "เลิกเป็นกรรมการ" ที่ยังไม่มีอะไรให้เลิก
    expect(res.body.error.message).toContain('ยังไม่ได้ตอบรับ');
    expect(res.body.error.message).toContain('ยกเลิกคำเชิญ');
  });

  /**
   * ★ พิสูจน์ว่าการเขียน SQL ใหม่ไม่เปลี่ยนว่าใครชน — คำเชิญกรรมการที่หมดอายุแล้ว
   *   ไม่นับเป็นกรรมการ ⇒ เชิญเข้าทีมได้ตามปกติ (กฎเดิมตั้งแต่ BE-13)
   */
  it('คำเชิญกรรมการหมดอายุแล้ว → ไม่ชน เชิญเข้าทีมได้', async () => {
    const trId = await addTournamentReferee({ tournamentId: tour, userId: invitee.id, invitedBy: organizer.id,
                                              invitationStatus: 'pending' });
    await testDb().query(
      'UPDATE tournament_referees SET expires_at = NOW() - INTERVAL 1 DAY WHERE tournament_referee_id = ?', [trId]);

    expect((await invite()).status).toBe(201);
  });

  /** กรรมการที่ถูกถอดออกจากทัวร์แล้ว ก็ไม่ชน — เงื่อนไข `removed_at IS NULL` ยังอยู่ */
  it('กรรมการที่ถูกถอดออกจากทัวร์แล้ว → ไม่ชน', async () => {
    const trId = await addTournamentReferee({ tournamentId: tour, userId: invitee.id, invitedBy: organizer.id,
                                              invitationStatus: 'accepted' });
    await testDb().query(
      'UPDATE tournament_referees SET removed_at = NOW() WHERE tournament_referee_id = ?', [trId]);

    expect((await invite()).status).toBe(201);
  });

  /** ผู้จัดไม่มีคำเชิญ ⇒ สองช่องใหม่ต้องเป็น null ไม่ใช่ค่ามั่ว */
  it('ผู้ถูกเชิญเป็นผู้จัดทัวร์นั้น → role organizer · สองช่องใหม่เป็น null', async () => {
    const res = await as(leader).post(`/teams/${team}/invitations`).send({ invitedUserId: organizer.id });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'TEAM_CONFLICT_OF_INTEREST',
      tournamentId: tour, role: 'organizer', invitationStatus: null, expiresAt: null,
    });
  });

  /** ทัวร์ที่ทีมไม่ได้สมัคร ไม่เกี่ยว — กันคิวรีใหม่กวาดกว้างเกิน */
  it('เป็นกรรมการของทัวร์อื่นที่ทีมนี้ไม่ได้สมัคร → ไม่ชน', async () => {
    const other = await createTournament({
      organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public', name: 'ทัวร์อื่น',
    });
    await addTournamentReferee({ tournamentId: other, userId: invitee.id, invitedBy: organizer.id,
                                 invitationStatus: 'accepted' });

    expect((await invite()).status).toBe(201);
  });
});
