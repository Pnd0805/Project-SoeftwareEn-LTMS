import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import { findProfileTotals } from '../playerStat.repo.js';
import { MVP_VOTING_HOURS } from '../../config/scoring.js';

beforeEach(() => vi.clearAllMocks());

describe('findProfileTotals', () => {
  it('reads pickem points, active MVP votes and follower count in one query', async () => {
    mocks.query.mockResolvedValueOnce([[{
      mvp_votes: 3,
      follower_count: 7,
    }], []]);

    await expect(findProfileTotals(5)).resolves.toEqual({
      mvp_votes: 3,
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
    mocks.query.mockResolvedValueOnce([[{ mvp_votes: 0, follower_count: 0 }], []]);
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
});
