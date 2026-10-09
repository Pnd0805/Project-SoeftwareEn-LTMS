import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import { findMyStanding, findLeaderboard } from '../pickem.repo.js';

beforeEach(() => vi.clearAllMocks());

/**
 * E29 — แต้ม + อันดับของคนเดียวในทัวร์เดียว (OD-51)
 *
 * ★ ความเสี่ยงของ endpoint นี้ไม่ใช่ SQL พัง แต่เป็น **อันดับไม่ตรงกับ E28**
 *   ซึ่งจะเงียบ: ทั้งสองหน้าตอบ 200 เหมือนกัน แค่เลขอันดับไม่เท่ากัน เทสที่ดูแค่ว่า
 *   "คืนตัวเลขออกมาไหม" จึงจับไม่ได้ ⇒ เทสชุดนี้ตรึงกฎการเสมอให้ตรงกันทั้งสองฝั่ง
 */
describe('findMyStanding — กฎอันดับต้องตรงกับ findLeaderboard', () => {
  it('อันดับนับจาก "แต้มมากกว่า" หรือ "แต้มเท่ากันแต่ทายถูกมากกว่า" — ตรงกับกฎเสมอของ E28', async () => {
    mocks.query.mockResolvedValueOnce([[{ points: 40, correct: 4, settled: 6, rank_no: 3 }], []]);
    await findMyStanding(20, 5);

    const [sql] = mocks.query.mock.calls[0]!;
    expect(sql).toContain('o.points > t.points');
    expect(sql).toContain('o.points = t.points AND o.correct > t.correct');
    // settled ต้องไม่มีผลกับอันดับ — E28 ก็ไม่ใช้มันตัดสินการเสมอ
    expect(sql).not.toContain('o.settled');
  });

  /**
   * 🔴 B3 ② (8 ต.ค. 2569) — อันดับย้ายมาคิดใน SQL เพราะต้องคิด **ก่อน** LIMIT
   *   ถ้าใครเปลี่ยนเป็น DENSE_RANK() จะได้ (1,1,2) ซึ่งผิดกฎเสมอของเรา และจะไม่ตรงกับ findMyStanding
   *   ถ้าเอา full_name เข้า window ด้วย คนแต้มเท่ากันจะได้อันดับไม่เท่ากัน
   */
  it('จัดอันดับใน SQL ด้วย RANK() ตามแต้มและจำนวนที่ทายถูกเท่านั้น', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findLeaderboard(20);
    const [sql] = mocks.query.mock.calls[0]!;
    expect(sql).toMatch(/RANK\(\)\s*OVER\s*\(\s*ORDER BY t\.points DESC, t\.correct DESC\s*\)/);
    expect(sql).not.toContain('DENSE_RANK');
    expect(sql).not.toMatch(/OVER\s*\([^)]*full_name/);
  });

  it('นับจำนวนคนทั้งทัวร์ในคิวรีเดียวกัน และแบ่งหน้าด้วย LIMIT/OFFSET', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findLeaderboard(20 , 40 , 25);
    const [sql , params] = mocks.query.mock.calls[0]!;
    expect(sql).toContain('COUNT(*) OVER ()');
    expect(sql).toContain('LIMIT ? OFFSET ?');
    expect(params).toEqual([20 , 25 , 40]);     // ทัวร์ → ขนาดหน้า → offset (สลับกันจะได้หน้าผิด)
  });

  it('ไม่มีใครทายเลย → totalItems เป็น 0 ไม่ใช่ undefined', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    expect(await findLeaderboard(20)).toEqual({ rows: [] , totalItems: 0 });
  });

  it('ทั้งสองคิวรีกรองด้วยเงื่อนไขชุดเดียวกัน — ทัวร์เดียวกัน และนับเฉพาะที่ตัดสินแล้ว', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findMyStanding(20, 5);
    const [standingSql] = mocks.query.mock.calls[0]!;

    mocks.query.mockResolvedValueOnce([[], []]);
    await findLeaderboard(20);
    const [leaderboardSql] = mocks.query.mock.calls[1]!;

    for (const sql of [standingSql, leaderboardSql]) {
      expect(sql).toContain('m.tournament_id = ?');
      expect(sql).toContain('p.points_earned IS NOT NULL');
      expect(sql).toContain('SUM(p.points_earned > 0)');
    }
  });

  it('ส่งค่าเรียงลำดับถูก — ทัวร์ก่อน ผู้ใช้ทีหลัง (สลับกันจะได้อันดับของทัวร์ที่ไม่มีจริง)', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findMyStanding(20, 777);
    expect(mocks.query.mock.calls[0]![1]).toEqual([20, 777]);
  });

  it('ไม่มีแถว → null (ให้ service ตัดสินว่าจะแปลว่าอะไร ไม่เดาที่ชั้น repo)', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await expect(findMyStanding(20, 5)).resolves.toBeNull();
  });

  it('MySQL คืน SUM เป็น string ได้ — ต้องแปลงเป็นเลขทุกช่อง', async () => {
    mocks.query.mockResolvedValueOnce([[{ points: '40', correct: '4', settled: '6', rank_no: '3' }], []]);
    await expect(findMyStanding(20, 5)).resolves.toEqual({ points: 40, correct: 4, settled: 6, rank_no: 3 });
  });

  // `RANK` เป็น reserved word ของ MySQL 8 — ถ้า alias ตรง ๆ จะพังตอนรันจริงแต่เทสที่ mock pool ไม่เห็น
  it('alias ไม่ใช้คำว่า rank เปล่า ๆ เพราะเป็น reserved word ของ MySQL 8', async () => {
    mocks.query.mockResolvedValueOnce([[], []]);
    await findMyStanding(20, 5);
    const [sql] = mocks.query.mock.calls[0]!;
    expect(sql).toContain('AS rank_no');
    expect(sql).not.toMatch(/AS rank\b/i);
  });
});
