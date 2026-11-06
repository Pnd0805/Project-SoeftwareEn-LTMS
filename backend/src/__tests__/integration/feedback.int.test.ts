import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { all, insert, one, testDb } from './helpers/db.js';
import {
  createFaculty, createSportType, createTeam, createTournament, createUser, makeAdmin, type TestUser,
} from './helpers/factories.js';

/**
 * ความเห็น · คะแนนผู้จัด · การกำกับดูแล · เหรียญรางวัล
 *
 *   คะแนนผู้จัด: เฉพาะผู้ลงแข่ง · ผู้จัดให้ตัวเองไม่ได้ · คนอื่นแม้แต่ "มีอยู่ไหม" ก็ไม่รู้ (404)
 *   คอมเมนต์:    ใครก็ได้ในทัวร์ public · คนละ 1 อัน ส่งซ้ำ = แก้
 *   กำกับดูแล:   ผู้จัดลบได้เฉพาะคอมเมนต์ (ไม่ใช่รีวิวของผู้ลงแข่ง/โหวต MVP) · แอดมินมหาวิทยาลัยลบได้ทุกอย่าง
 */

let organizer: TestUser;
let otherOrganizer: TestUser;
let player: TestUser;
let fan: TestUser;
let fan2: TestUser;
let tour: number;

beforeEach(async () => {
  const faculty = await createFaculty();
  const sport = await createSportType();
  organizer = await createUser();
  otherOrganizer = await createUser();
  player = await createUser();
  fan = await createUser();
  fan2 = await createUser();
  tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  await createTournament({ organizer: otherOrganizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
  const team = await createTeam({ leader: player.id, sportTypeId: sport });
  const app = await insert('tournament_applications', { tournament_id: tour, team_id: team, tournament_application_status: 'approved' });
  await insert('application_players', { tournament_application_id: app, tournament_id: tour, user_id: player.id });
});

const feedbackRows = (type: string) => all<{ tournament_feedback_id: number; user_id: number; removed_at: Date | null; is_reported: number }>(
  'SELECT tournament_feedback_id, user_id, removed_at, is_reported FROM tournament_feedback WHERE tournament_id = ? AND feedback_type = ?',
  [tour, type]);

// ───────────────────────────── คะแนนผู้จัด ─────────────────────────────

describe('POST /tournaments/:id/feedback — ให้คะแนนผู้จัด', () => {
  beforeEach(async () => {
    // เปิดให้คะแนนได้ตั้งแต่วันแรกของการแข่ง
    await testDb().query('UPDATE tournaments SET event_start_date = CURDATE() - INTERVAL 1 DAY WHERE tournament_id = ?', [tour]);
  });
  const rate = (who: TestUser, rating = 4) => as(who).post(`/tournaments/${tour}/feedback`).send({ rating, content: 'จัดดี' });

  it('ผู้ลงแข่งให้คะแนนได้ · ส่งซ้ำ = แก้ (แถวเดียว)', async () => {
    expect((await rate(player, 4)).status).toBeLessThan(300);
    expect((await rate(player, 2)).status).toBeLessThan(300);
    expect(await feedbackRows('organizer_feedback')).toHaveLength(1);
  });

  it('คนดูทั่วไป → 403 FEEDBACK_NOT_ALLOWED', async () => {
    const res = await rate(fan);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FEEDBACK_NOT_ALLOWED');
    expect(await feedbackRows('organizer_feedback')).toEqual([]);
  });

  it('ผู้จัดให้คะแนนตัวเอง → 403 ORGANIZER_CANNOT_REVIEW_OWN', async () => {
    const res = await rate(organizer, 5);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORGANIZER_CANNOT_REVIEW_OWN');
  });

  it('คะแนนนอกช่วง 1–5 → 400', async () => {
    expect((await rate(player, 6)).status).toBe(400);
    expect((await rate(player, 0)).status).toBe(400);
  });

  it('ทัวร์ยังไม่เริ่มแข่ง → 409 TOURNAMENT_NOT_STARTED', async () => {
    await testDb().query('UPDATE tournaments SET event_start_date = CURDATE() + INTERVAL 10 DAY WHERE tournament_id = ?', [tour]);
    const res = await rate(player);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TOURNAMENT_NOT_STARTED');
  });

  it('🔒 รายงานคะแนนผู้จัด: เฉพาะผู้จัดเห็น/รายงานได้ · คนอื่นได้ 404 เหมือนไม่มีอยู่', async () => {
    await rate(player);
    const id = (await feedbackRows('organizer_feedback'))[0]!.tournament_feedback_id;
    const asFan = await as(fan).post(`/feedback/${id}/report`);
    const missing = await as(fan).post('/feedback/999999/report');
    expect(asFan.status).toBe(404);
    expect(asFan.body).toEqual(missing.body);
    expect((await feedbackRows('organizer_feedback'))[0]!.is_reported).toBe(0);
  });
});

// ───────────────────────────── คอมเมนต์ ─────────────────────────────

describe('คอมเมนต์ทัวร์', () => {
  const comment = (who: TestUser, content = 'สนุกมาก') => as(who).post(`/tournaments/${tour}/comments`).send({ content });

  it('ใครก็คอมเมนต์ได้ · ส่งซ้ำ = แก้ (คนละ 1 อัน)', async () => {
    expect((await comment(fan, 'ครั้งแรก')).status).toBeLessThan(300);
    expect((await comment(fan, 'แก้แล้ว')).status).toBeLessThan(300);
    expect(await feedbackRows('comment')).toHaveLength(1);
    expect(JSON.stringify((await anon.get(`/tournaments/${tour}/comments`)).body)).toContain('แก้แล้ว');
  });

  it('ทัวร์ไม่ public → 409', async () => {
    await testDb().query("UPDATE tournaments SET tournament_status = 'private' WHERE tournament_id = ?", [tour]);
    expect((await comment(fan)).status).toBe(409);
  });

  it('ลบของตัวเองได้ · ไม่กระทบของคนอื่น', async () => {
    await comment(fan);
    await comment(fan2);
    expect((await as(fan).delete(`/tournaments/${tour}/comments/me`)).status).toBeLessThan(300);
    const live = (await feedbackRows('comment')).filter(r => r.removed_at === null);
    expect(live.map(r => r.user_id)).toEqual([fan2.id]);
  });

  it('รายงานคอมเมนต์ตัวเอง → 400 CANNOT_REPORT_OWN_COMMENT', async () => {
    await comment(fan);
    const id = (await feedbackRows('comment'))[0]!.tournament_feedback_id;
    const res = await as(fan).post(`/feedback/${id}/report`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_REPORT_OWN_COMMENT');
  });

  describe('การกำกับดูแลคอมเมนต์', () => {
    let fanComment: number;
    beforeEach(async () => {
      await comment(fan, 'ข้อความไม่เหมาะสม');
      fanComment = (await feedbackRows('comment'))[0]!.tournament_feedback_id;
    });
    const removed = async (id: number) =>
      (await one<{ removed_at: Date | null }>('SELECT removed_at FROM tournament_feedback WHERE tournament_feedback_id = ?', [id]))!.removed_at !== null;

    it('ผู้จัดลบคอมเมนต์ได้ (ต้องมีเหตุผล)', async () => {
      expect((await as(organizer).delete(`/tournaments/${tour}/comments/${fanComment}`).send({})).status).toBe(400);
      expect(await removed(fanComment)).toBe(false);
      expect((await as(organizer).delete(`/tournaments/${tour}/comments/${fanComment}`).send({ reason: 'ไม่สุภาพ' })).status).toBeLessThan(300);
      expect(await removed(fanComment)).toBe(true);
    });

    it.each([
      ['ผู้จัดทัวร์อื่น', () => otherOrganizer],
      ['ผู้ใช้คนอื่น', () => fan2],
    ])('%s ลบคอมเมนต์ในทัวร์นี้ → 403 · ยังอยู่', async (_label, who) => {
      expect((await as(who()).delete(`/tournaments/${tour}/comments/${fanComment}`).send({ reason: 'x' })).status).toBe(403);
      expect(await removed(fanComment)).toBe(false);
    });

    it('🔒 ผู้จัดลบรีวิวของผู้ลงแข่ง (ที่ให้คะแนนตัวเองต่ำ) → 403 · ลบได้แค่คอมเมนต์', async () => {
      await testDb().query('UPDATE tournaments SET event_start_date = CURDATE() - INTERVAL 1 DAY WHERE tournament_id = ?', [tour]);
      expect((await as(player).post(`/tournaments/${tour}/feedback`).send({ rating: 1, content: 'จัดแย่' })).status).toBeLessThan(300);
      const review = (await feedbackRows('organizer_feedback'))[0]!.tournament_feedback_id;
      const res = await as(organizer).delete(`/tournaments/${tour}/comments/${review}`).send({ reason: 'ไม่ชอบ' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FEEDBACK_NOT_REMOVABLE_BY_ORGANIZER');
      expect(await removed(review)).toBe(false);
    });

    it('ปิดเรื่องที่ถูกรายงาน: ผู้จัดทำได้ · คนอื่นไม่ได้', async () => {
      expect((await as(fan2).post(`/feedback/${fanComment}/report`)).status).toBeLessThan(300);
      expect((await as(fan2).post(`/tournaments/${tour}/comments/${fanComment}/dismiss-report`)).status).toBe(403);
      expect((await as(organizer).post(`/tournaments/${tour}/comments/${fanComment}/dismiss-report`)).status).toBe(200);
      expect((await feedbackRows('comment'))[0]!.is_reported).toBe(0);
    });

    it('แอดมินลบ: แอดมินคณะไม่ได้ · แอดมินมหาวิทยาลัยได้ · คนเขียนส่งใหม่ไม่ได้', async () => {
      const facAdmin = await createUser();
      await makeAdmin(facAdmin.id, 'faculty', await createFaculty());
      const uniAdmin = await createUser();
      await makeAdmin(uniAdmin.id, 'university_wide');

      expect((await as(facAdmin).delete(`/admin/feedback/${fanComment}`).send({ reason: 'x' })).status).toBe(403);
      expect(await removed(fanComment)).toBe(false);
      expect((await as(uniAdmin).delete(`/admin/feedback/${fanComment}`).send({ reason: 'ละเมิดกฎ' })).status).toBeLessThan(300);
      expect(await removed(fanComment)).toBe(true);

      const again = await comment(fan, 'ส่งใหม่');
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('COMMENT_REMOVED');
    });
  });
});

// ───────────────────────────── เหรียญรางวัล ─────────────────────────────

describe('PATCH /me/rewards/:id/display — ตั้งค่าได้เฉพาะเหรียญของตัวเอง', () => {
  it('🔒 ซ่อนเหรียญของคนอื่น → 404 · ของเขายังแสดงอยู่', async () => {
    const rewardId = (await one<{ reward_id: number }>('SELECT reward_id FROM rewards ORDER BY reward_id LIMIT 1'))!.reward_id;
    await insert('user_rewards', { user_id: fan2.id, reward_id: rewardId, is_displayed: 1 });

    const res = await as(fan).patch(`/me/rewards/${rewardId}/display`).send({ isDisplayed: false });
    expect(res.status).toBe(404);
    expect((await one<{ is_displayed: number }>('SELECT is_displayed FROM user_rewards WHERE user_id = ?', [fan2.id]))!.is_displayed).toBe(1);

    expect((await as(fan2).patch(`/me/rewards/${rewardId}/display`).send({ isDisplayed: false })).status).toBe(200);
    expect((await one<{ is_displayed: number }>('SELECT is_displayed FROM user_rewards WHERE user_id = ?', [fan2.id]))!.is_displayed).toBe(0);
  });

  it('แคตตาล็อกเหรียญอ่านได้โดยไม่ต้องล็อกอิน (ข้อมูลจาก migration 041 ยังอยู่หลังล้างฐาน)', async () => {
    const res = await anon.get('/rewards');
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body).length).toBeGreaterThan(20);
  });
});

/**
 * 🆕 FE-38 (7 ต.ค. 2569 · มติ ค ก) — รายการความเห็น/รีวิวที่ถูกลบ
 *
 * ปัญหา: ระบบมีปุ่มลบและปุ่มกู้คืนอยู่แล้ว แต่**ไม่มีที่ไหนบอกว่ามีอะไรถูกลบไปบ้าง**
 * ⇒ แอดมินที่ลบไปแล้วหาเลขกลับมากู้คืนไม่ได้ ต้องไปขุดจาก /admin/audit-logs
 * ⇒ ปุ่ม restore ที่ทำไว้ใช้งานจริงแทบไม่ได้ · นี่คือชิ้นที่หายไปของฟีเจอร์ที่มีอยู่แล้ว
 *
 * ★ มติ ค ก แยกสองเรื่องออกจากกันชัด ๆ:
 *     **เห็น** — มหาวิทยาลัยเห็นหมด · คณะเห็นของคณะตัวเอง · root ไม่เห็น (OD-34)
 *     **ลบ/กู้คืน** — คงไว้ที่แอดมินมหาวิทยาลัยเท่านั้นตามเดิม ไม่ขยายอำนาจใคร
 *   เทสชุดนี้ต้องตรึงทั้งสองฝั่ง — ถ้าวันหน้าใครเผลอเปิดให้แอดมินคณะกู้คืนได้ เทสจะแดง
 */
describe('GET /admin/feedback/removed — รายการของที่ถูกลบ (FE-38)', () => {
  let uniAdmin: TestUser;
  let sameFacAdmin: TestUser;
  let otherFacAdmin: TestUser;
  let removedComment: number;
  let removedReview: number;

  const list = (who: TestUser) => as(who).get('/admin/feedback/removed');
  const idsSeenBy = async (who: TestUser) =>
    ((await list(who)).body.items as { id: number }[]).map(i => i.id).sort();

  beforeEach(async () => {
    const tourFaculty = (await one<{ organizing_faculty_id: number }>(
      'SELECT organizing_faculty_id FROM tournaments WHERE tournament_id = ?', [tour]))!.organizing_faculty_id;
    uniAdmin = await createUser();
    sameFacAdmin = await createUser();
    otherFacAdmin = await createUser();
    await makeAdmin(uniAdmin.id, 'university_wide');
    await makeAdmin(sameFacAdmin.id, 'faculty', tourFaculty);
    await makeAdmin(otherFacAdmin.id, 'faculty', await createFaculty());

    // ① คอมเมนต์ที่ผู้จัดลบ
    expect((await as(fan).post(`/tournaments/${tour}/comments`).send({ content: 'ไม่สุภาพ' })).status).toBeLessThan(300);
    removedComment = (await feedbackRows('comment'))[0]!.tournament_feedback_id;
    expect((await as(organizer).delete(`/tournaments/${tour}/comments/${removedComment}`).send({ reason: 'ใช้คำหยาบ' })).status).toBeLessThan(300);

    // ② รีวิวที่มีคะแนน ซึ่งแอดมินมหาวิทยาลัยลบ
    await testDb().query('UPDATE tournaments SET event_start_date = CURDATE() - INTERVAL 1 DAY WHERE tournament_id = ?', [tour]);
    expect((await as(player).post(`/tournaments/${tour}/feedback`).send({ rating: 1, content: 'สแปม' })).status).toBeLessThan(300);
    removedReview = (await feedbackRows('organizer_feedback'))[0]!.tournament_feedback_id;
    expect((await as(uniAdmin).delete(`/admin/feedback/${removedReview}`).send({ reason: 'เป็นสแปม' })).status).toBeLessThan(300);
  });

  it('แอดมินมหาวิทยาลัยเห็นทั้งหมด พร้อมเหตุผล ผู้ลบ และบทบาทของผู้ลบ', async () => {
    const res = await list(uniAdmin);

    expect(res.status).toBe(200);
    expect(await idsSeenBy(uniAdmin)).toEqual([removedComment, removedReview].sort());
    const byId = (id: number) => res.body.items.find((i: { id: number }) => i.id === id);
    // ★ เหตุผลอยู่ใน audit_logs ไม่ใช่คอลัมน์ในตาราง — ถ้า JOIN พลาด ค่านี้จะเป็น null
    expect(byId(removedComment)).toMatchObject({
      feedbackType: 'comment', removalReason: 'ใช้คำหยาบ',
      removedByRole: 'organizer', removedBy: { id: organizer.id }, canRestore: true,
    });
    expect(byId(removedReview)).toMatchObject({
      feedbackType: 'organizer_feedback', rating: 1, removalReason: 'เป็นสแปม',
      removedByRole: 'admin', removedBy: { id: uniAdmin.id }, canRestore: true,
    });
  });

  it('แอดมินคณะเจ้าภาพเห็นของคณะตัวเอง แต่กู้คืนไม่ได้ (canRestore false)', async () => {
    const res = await list(sameFacAdmin);

    expect(res.status).toBe(200);
    expect(await idsSeenBy(sameFacAdmin)).toEqual([removedComment, removedReview].sort());
    expect(res.body.items.every((i: { canRestore: boolean }) => i.canRestore === false)).toBe(true);
  });

  it('แอดมินคณะอื่นไม่เห็นอะไรเลย', async () => {
    expect(await idsSeenBy(otherFacAdmin)).toEqual([]);
  });

  /**
   * 🔴 root อ่านไม่ได้ ต้องเป็น **403 ไม่ใช่รายการว่าง** — มติ 28 ก.ย. (OD-34)
   *   root เป็นคนแต่งตั้ง+คนตรวจ ไม่ใช่คนปฏิบัติงาน · ของที่ root เห็นคือคิวค้างแบบไม่มีเนื้อหา
   *   รายการว่างจะอ่านเหมือน "ไม่มีอะไรถูกลบ" ซึ่งเป็นคำตอบผิด ไม่ใช่การปฏิเสธ
   */
  it('root → 403 (ไม่ใช่รายการว่าง)', async () => {
    const root = await createUser();
    await makeAdmin(root.id, 'root');

    const res = await list(root);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ADMIN_SCOPE');
  });

  it.each([
    ['ผู้ใช้ทั่วไป', () => fan],
    ['ผู้จัดทัวร์', () => organizer],
  ])('%s → 403', async (_label, who) => {
    expect((await list(who())).status).toBe(403);
  });

  it('ไม่ล็อกอิน → 401', async () => {
    expect((await anon.get('/admin/feedback/removed')).status).toBe(401);
  });

  /**
   * ★ ของที่ **เจ้าตัวลบเอง** ต้องไม่ขึ้นที่นี่ — เส้นนั้นเป็น DELETE จริง ไม่มีแถวเหลือ
   *   (มติ 7 ต.ค.: ลบเองแล้วหายจริงเหมือน YouTube/Facebook ⇒ ไม่มีใครควรกู้คืนได้)
   */
  it('คอมเมนต์ที่เจ้าตัวลบเอง → ไม่ขึ้นในรายการ', async () => {
    expect((await as(fan2).post(`/tournaments/${tour}/comments`).send({ content: 'เดี๋ยวลบเอง' })).status).toBeLessThan(300);
    expect((await as(fan2).delete(`/tournaments/${tour}/comments/me`)).status).toBeLessThan(300);

    expect(await idsSeenBy(uniAdmin)).toEqual([removedComment, removedReview].sort());
  });

  it('กู้คืนจากเลขที่เห็นในรายการได้จริง → หายออกจากรายการ', async () => {
    expect((await as(uniAdmin).post(`/admin/feedback/${removedReview}/restore`)).status).toBeLessThan(300);

    expect(await idsSeenBy(uniAdmin)).toEqual([removedComment]);
  });

  /** ★ ด่านอำนาจต้องไม่ขยายตามการมองเห็น — เห็นได้ ≠ แก้ได้ */
  it('แอดมินคณะกู้คืนไม่ได้ → 403 · ยังถูกลบอยู่', async () => {
    const res = await as(sameFacAdmin).post(`/admin/feedback/${removedReview}/restore`);

    expect(res.status).toBe(403);
    expect(await idsSeenBy(sameFacAdmin)).toEqual([removedComment, removedReview].sort());
  });
});
