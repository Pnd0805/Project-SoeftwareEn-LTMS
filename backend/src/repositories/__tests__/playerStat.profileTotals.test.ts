import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import { findProfileTotals } from '../playerStat.repo.js';
import { MVP_VOTING_HOURS } from '../../config/scoring.js';

beforeEach(() => vi.clearAllMocks());

describe('findProfileTotals', () => {
  it('reads active MVP votes, MVP times and follower count', async () => {
    mocks.query
      .mockResolvedValueOnce([[{ mvp_votes: 3, follower_count: 7 }], []])
      .mockResolvedValueOnce([[{ mvp_times: 2 }], []]);

    await expect(findProfileTotals(5)).resolves.toEqual({
      mvp_votes: 3,
      mvp_times: 2,
      follower_count: 7,
    });

    const [sql, values] = mocks.query.mock.calls[0]!;
    // ★ 4 ต.ค. — ห้ามดึงแต้ม Pick'em มาอีก โปรไฟล์สาธารณะไม่คืนแต้มรวมทุกทัวร์อีกแล้ว
    expect(sql).not.toContain('total_points');
    expect(sql).toContain("tf.feedback_type = 'mvp_vote'");
    expect(sql).toContain('tf.removed_at IS NULL');
    expect(sql).toContain('FROM follows f');
    expect(values).toEqual([MVP_VOTING_HOURS, 5]);
  });

  /**
   * OD-23 ข้อ 10 — `GET /users/:id/stats` เป็น endpoint สาธารณะไม่มี middleware
   * ถ้านับโหวตของแมตช์ที่ยังเปิดโหวตอยู่ ใครก็ poll โปรไฟล์ดูเลขวิ่งได้ ทั้งที่หน้าแมตช์ตั้งใจไม่ส่งจำนวนโหวตออกไป
   */
  it('counts only votes from matches whose voting window has closed', async () => {
    mocks.query
      .mockResolvedValueOnce([[{ mvp_votes: 0, follower_count: 0 }], []])
      .mockResolvedValueOnce([[{ mvp_times: 0 }], []]);
    await findProfileTotals(5);

    const [sql, values] = mocks.query.mock.calls[0]!;
    expect(sql).toContain('LEFT JOIN matches m ON m.match_id = tf.match_id');
    expect(sql).toContain('m.actual_end_time <= DATE_SUB(NOW(), INTERVAL ? HOUR)');
    // โหวตระดับทัวร์ของเก่าไม่มีหน้าต่างเวลา ต้องยังนับอยู่
    expect(sql).toContain('tf.match_id IS NULL');
    // ชั่วโมงมาจาก config ไม่ใช่เลขฮาร์ดโค้ดในคิวรี
    expect(sql).not.toContain('INTERVAL 24 HOUR');
    expect(values[0]).toBe(MVP_VOTING_HOURS);
  });

  /**
   * OD-60 (4 ต.ค. 2569) — `mvp_times` = จำนวนครั้งที่ได้เป็น MVP (ได้โหวตมากสุดในแมตช์นั้น)
   * ต่างจาก `mvp_votes` ที่เป็นยอดโหวตดิบ ซึ่งโตตามจำนวนคนดู ไม่ใช่ตามฝีมือ
   */
  describe('mvp_times — ครั้งที่ได้เป็น MVP', () => {
    beforeEach(() => {
      mocks.query
        .mockResolvedValueOnce([[{ mvp_votes: 0, follower_count: 0 }], []])
        .mockResolvedValueOnce([[{ mvp_times: 0 }], []]);
    });

    it('★ เสมอที่อันดับหนึ่งได้ทั้งคู่ — ใช้ RANK() ไม่ใช่ ROW_NUMBER()/LIMIT 1 (มติ ①)', async () => {
      await findProfileTotals(5);
      const [sql] = mocks.query.mock.calls[1]!;

      expect(sql).toContain('RANK() OVER (PARTITION BY tf.match_id ORDER BY COUNT(*) DESC)');
      expect(sql).toContain('ranked.rnk = 1');
      // ROW_NUMBER จะเลือกคนเดียวแบบสุ่มเมื่อเสมอ ⇒ ผู้เล่นเสียสิทธิ์โดยไม่มีกฎที่อธิบายได้
      expect(sql).not.toContain('ROW_NUMBER');
    });

    it('★ นับเฉพาะแมตช์ที่ปิดโหวตแล้ว ด้วยเงื่อนไขชุดเดียวกับ mvp_votes (มติ ②)', async () => {
      await findProfileTotals(5);
      const [sql, values] = mocks.query.mock.calls[1]!;

      expect(sql).toContain('m.actual_end_time IS NOT NULL');
      expect(sql).toContain('m.actual_end_time <= DATE_SUB(NOW(), INTERVAL ? HOUR)');
      expect(sql).toContain('tf.removed_at IS NULL');
      expect(values[0]).toBe(MVP_VOTING_HOURS);
      expect(sql).not.toContain('INTERVAL 24 HOUR');
    });

    it('★ ผลแมตช์ที่ถูกแก้/ยกทิ้งไม่กระทบ — ห้ามมีเงื่อนไขเรื่อง match_results (มติ ③)', async () => {
      await findProfileTotals(5);
      const [sql] = mocks.query.mock.calls[1]!;

      expect(sql).not.toContain('match_results');
      expect(sql).not.toContain('match_result_status');
    });

    it('โหวตระดับทัวร์ของเก่า (match_id NULL) ไม่เข้ามานับ — JOIN ปกติ ไม่ใช่ LEFT JOIN', async () => {
      await findProfileTotals(5);
      const [sql] = mocks.query.mock.calls[1]!;

      expect(sql).toContain('JOIN matches m ON m.match_id = tf.match_id');
      expect(sql).not.toContain('LEFT JOIN matches m ON m.match_id = tf.match_id');
    });

    it('จัดอันดับเฉพาะแมตช์ที่คนนี้มีโหวต ไม่ใช่ทุกแมตช์ในระบบ', async () => {
      await findProfileTotals(5);
      const [sql, values] = mocks.query.mock.calls[1]!;

      expect(sql).toContain('tf.match_id IN (SELECT match_id FROM tournament_feedback');
      expect(values).toEqual([MVP_VOTING_HOURS, 5, 5]);
    });
  });
});
