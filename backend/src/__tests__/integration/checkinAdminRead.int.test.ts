import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ตรวจ SRS/SDS 30 ต.ค. 2569 (ข้อ 1.3 · FR-PV-04) — Admin อ่านผลเช็คอินตามขอบเขต · ไม่เห็นรูปบัตร
 *
 * ★ เดิมได้แค่ผู้จัด/กรรมการของแมตช์ — Admin อย่างเดียวได้ 403 โดยไม่ดูขอบเขตเลย
 * ★ สิ่งที่ห้ามหลุด: Admin ต้องได้ documentUrl = null เสมอ (เพิ่มสิทธิ์อ่านผล ไม่ใช่สิทธิ์ดูรูป)
 */
vi.mock('../../services/upload.service.js', async (orig) => ({
  ...(await orig<typeof import('../../services/upload.service.js')>()),
  getPresignedDownloadUrl: vi.fn(async (k: string) => `signed:${k}`),
}));

import { as } from './helpers/api.js';
import { insert } from './helpers/db.js';
import {
  addTournamentReferee, assignMatchReferee, createFaculty, createMatch, createSportType,
  createTeam, createTournament, createUser, makeAdmin, type TestUser,
} from './helpers/factories.js';

let faculty: number;
let organizer: TestUser;
let referee: TestUser;
let player: TestUser;
let match: number;
const KEY = 'checkin_document/1/00000001-0000-4000-8000-000000000000.jpg';

beforeEach(async () => {
  faculty = await createFaculty();
  const sport = await createSportType({ minMembers: 1, maxMembers: 5 });
  organizer = await createUser();
  referee = await createUser();
  player = await createUser();
  const other = await createUser();
  const tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  const teamA = await createTeam({ leader: player.id, sportTypeId: sport });
  const teamB = await createTeam({ leader: other.id, sportTypeId: sport });
  match = await createMatch({ tournamentId: tour, teamA, teamB, mode: 'online', status: 'checkin_open' });
  const refRow = await addTournamentReferee({ tournamentId: tour, userId: referee.id, invitedBy: organizer.id });
  await assignMatchReferee({ matchId: match, tournamentRefereeId: refRow });
  await insert('match_checkins', {
    match_id: match, user_id: player.id, method: 'photo_online', match_checkin_status: 'success',
    document_type: 'student_id', document_s3_key: KEY, verified_by_referee_id: referee.id, verified_at: new Date(),
  });
});

const list = (who: TestUser) => as(who).get(`/matches/${match}/checkins`);

async function admin(scope: 'university_wide' | 'faculty' | 'root', facultyId?: number) {
  const u = await createUser();
  await makeAdmin(u.id, scope, facultyId);
  return u;
}

describe('FR-PV-04 — Admin อ่านผลเช็คอินตามขอบเขต', () => {
  it.each([
    ['แอดมินมหาวิทยาลัย', () => admin('university_wide')],
    ['แอดมินคณะเจ้าภาพ', () => admin('faculty', faculty)],
  ])('%s → 200 · เห็นสถานะ/ชนิดบัตร · documentUrl = null', async (_label, make) => {
    const res = await list(await make());
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ userId: player.id, status: expect.any(String), documentType: 'student_id', documentUrl: null });
    // ไม่มีคีย์ไฟล์หลุดออกไปในรูปไหนเลย
    expect(JSON.stringify(res.body)).not.toContain('checkin_document/');
  });

  it.each([
    ['แอดมินคณะอื่น', async () => admin('faculty', await createFaculty())],
    ['root (OD-34 — แต่งตั้ง/ตรวจ ไม่ใช่คนปฏิบัติงาน)', () => admin('root')],
    ['ผู้ใช้ทั่วไป', () => createUser()],
  ])('%s → 403', async (_label, make) => {
    const res = await list(await make());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ORGANIZER_OR_REFEREE');
  });

  it('ของเดิมไม่เปลี่ยน: กรรมการของแมตช์ยังเปิดรูปได้ · ผู้จัดเห็นรายการแต่ไม่เห็นรูป', async () => {
    expect((await list(referee)).body.items[0].documentUrl).toBe(`signed:${KEY}`);
    const org = await list(organizer);
    expect(org.status).toBe(200);
    expect(org.body.items[0].documentUrl).toBeNull();
  });
});
