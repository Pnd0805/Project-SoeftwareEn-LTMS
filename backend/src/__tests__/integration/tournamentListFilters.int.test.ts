import { beforeEach, describe, expect, it } from 'vitest';
import { anon } from './helpers/api.js';
import { testDb } from './helpers/db.js';
import { createSportType, createTournament, createUser, type TestUser } from './helpers/factories.js';

/**
 * FR-TR-01 (SRS เทียบโค้ด 30 ต.ค. 2569) — ตัวกรองรายการแข่งขัน `GET /tournaments`
 *   ใหม่: `registration=open|closed` · `startFrom` / `startTo` (YYYY-MM-DD รวมวันขอบ)
 *
 * ★ "เปิดรับสมัคร" = เงื่อนไขเดียวกับตอนกดสมัครจริง: ธง registration_open **และ** NOW() อยู่ในช่วงวัน (NULL = ไม่มีขอบ)
 * ★ เวลาทั้งหมดตั้งด้วย NOW() ของฐาน — ไม่ใช่เวลาฝั่งเทส (บทเรียนเดียวกับ dbTimezone.int.test.ts)
 */
let organizer: TestUser;
let sport: number;

beforeEach(async () => {
  organizer = await createUser();
  sport = await createSportType();
});

const tour = (o: { name: string; open?: boolean; sportTypeId?: number }) =>
  createTournament({ organizer: organizer.id, sportTypeId: o.sportTypeId ?? sport, status: 'public', registrationOpen: o.open ?? false, name: o.name });
/** ตั้งช่วงรับสมัครแบบเลื่อนจาก NOW() ของฐาน (ชั่วโมง) · null = ไม่ตั้ง */
const window = (id: number, startHours: number | null, endHours: number | null) => testDb().query(
  `UPDATE tournaments SET
     registration_start = ${startHours === null ? 'NULL' : `NOW() + INTERVAL ${startHours} HOUR`},
     registration_end   = ${endHours === null ? 'NULL' : `NOW() + INTERVAL ${endHours} HOUR`}
   WHERE tournament_id = ?`, [id]);
const startsOn = (id: number, date: string) =>
  testDb().query('UPDATE tournaments SET event_start_date = ?, event_end_date = ? WHERE tournament_id = ?', [date, date, id]);
const names = async (query: string) => {
  const res = await anon.get(`/tournaments?${query}`);
  expect(res.status).toBe(200);
  return (res.body.items as { name: string }[]).map(i => i.name).sort();
};

describe('registration=open|closed', () => {
  beforeEach(async () => {
    await window(await tour({ name: 'A เปิดอยู่', open: true }), -24, 24);
    await window(await tour({ name: 'B ยังไม่ถึงวันเปิด', open: true }), 24, 48);
    await window(await tour({ name: 'C ปิดไปแล้ว', open: true }), -48, -24);
    await window(await tour({ name: 'D ผู้จัดยังไม่กดเปิด', open: false }), -24, 24);
    await window(await tour({ name: 'E เปิดธง ไม่ตั้งวันเลย', open: true }), null, null);
    await window(await tour({ name: 'F ปิดธง ไม่ตั้งวันเลย', open: false }), null, null);
  });

  it('เทส 1: open = ธงเปิด และ NOW() อยู่ในช่วง (ตรงกับตอนกดสมัครจริง)', async () => {
    expect(await names('registration=open')).toEqual(['A เปิดอยู่', 'E เปิดธง ไม่ตั้งวันเลย']);
  });

  it('เทส 2: closed = ยังไม่เปิด + ปิดแล้ว + ผู้จัดยังไม่กดเปิด', async () => {
    expect(await names('registration=closed')).toEqual(
      ['B ยังไม่ถึงวันเปิด', 'C ปิดไปแล้ว', 'D ผู้จัดยังไม่กดเปิด', 'F ปิดธง ไม่ตั้งวันเลย']);
  });

  it('🔴 เทส 3: วันรับสมัคร NULL ไม่ทำให้แถวหายเงียบ — open + closed ครบทุกทัวร์', async () => {
    const all = await names('');
    expect([...await names('registration=open'), ...await names('registration=closed')].sort()).toEqual(all);
    expect(all).toHaveLength(6);
  });

  it('ค่าอื่นนอกจาก open/closed → 400 VALIDATION_FAILED', async () => {
    const res = await anon.get('/tournaments?registration=yes');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('startFrom / startTo', () => {
  beforeEach(async () => {
    await startsOn(await tour({ name: '1 พ.ย.' }), '2026-11-01');
    await startsOn(await tour({ name: '15 พ.ย.' }), '2026-11-15');
    await startsOn(await tour({ name: '30 พ.ย.' }), '2026-11-30');
  });

  it('🔴 เทส 4: คร่อมวันเริ่มแข่งพอดี → รวมวันขอบ (inclusive)', async () => {
    expect(await names('startFrom=2026-11-01&startTo=2026-11-15')).toEqual(['1 พ.ย.', '15 พ.ย.']);
    expect(await names('startFrom=2026-11-15')).toEqual(['15 พ.ย.', '30 พ.ย.']);
    expect(await names('startTo=2026-11-01')).toEqual(['1 พ.ย.']);
  });

  it.each([
    ['startFrom=2026/11/01'], ['startFrom=2026-13-01'], ['startTo=2026-02-30'], ['startFrom=abc'], ['startTo='],
  ])('🔴 เทส 5: %s → 400 VALIDATION_FAILED (ไม่ใช่ 500 หรือรายการว่าง)', async (query) => {
    const res = await anon.get(`/tournaments?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('startFrom หลัง startTo → 400', async () => {
    expect((await anon.get('/tournaments?startFrom=2026-11-30&startTo=2026-11-01')).status).toBe(400);
  });
});

it('เทส 6: ใช้ร่วมกับ q + sportTypeId + registration + ช่วงวัน ได้ ไม่ทับกัน', async () => {
  const other = await createSportType();
  const hit = await tour({ name: 'ฟุตบอลคณะ เปิดอยู่', open: true });
  await window(hit, -1, 24);
  await startsOn(hit, '2026-11-10');
  const wrongSport = await tour({ name: 'ฟุตบอลคณะ กีฬาอื่น', open: true, sportTypeId: other });
  await window(wrongSport, -1, 24);
  await startsOn(wrongSport, '2026-11-10');
  const wrongDate = await tour({ name: 'ฟุตบอลคณะ เดือนหน้า', open: true });
  await window(wrongDate, -1, 24);
  await startsOn(wrongDate, '2026-12-10');
  const closed = await tour({ name: 'ฟุตบอลคณะ ปิดแล้ว', open: true });
  await window(closed, -48, -24);
  await startsOn(closed, '2026-11-10');
  await startsOn(await tour({ name: 'บาสคณะ', open: true }), '2026-11-10');

  expect(await names(`q=${encodeURIComponent('ฟุตบอล')}&sportTypeId=${sport}&registration=open&startFrom=2026-11-01&startTo=2026-11-30`))
    .toEqual(['ฟุตบอลคณะ เปิดอยู่']);
});
