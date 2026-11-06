import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock ถูก hoist ขึ้นบนสุด ตัวแปร const ธรรมดาจึงยังไม่ถูก init — ต้องใช้ vi.hoisted (แบบเดียวกับ playerStat.profileTotals.test)
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));
const query = mocks.query;

import { findEligibilityRulesOfMany } from '../application.repo.js';

beforeEach(() => vi.clearAllMocks());

/**
 * คิวของแอดมินต้องคิด `canDecide` ต่อแถว (FE-admin-queue-shows-undecidable-rows)
 * ถ้าเรียก findEligibilityRules รายทัวร์จะเป็น N+1 ทันทีเมื่อคิวยาว
 */
describe('findEligibilityRulesOfMany', () => {
  it('groups the rows by tournament in one query', async () => {
    query.mockResolvedValue([[
      { tournament_id: 28, rule_type: 'faculty', rule_value: 1 },
      { tournament_id: 28, rule_type: 'year', rule_value: 2 },
      { tournament_id: 30, rule_type: 'faculty', rule_value: 5 },
    ], []]);

    const out = await findEligibilityRulesOfMany([28, 29, 30]);

    expect(query).toHaveBeenCalledTimes(1);
    expect(out.get(28)).toEqual([{ rule_type: 'faculty', rule_value: 1 }, { rule_type: 'year', rule_value: 2 }]);
    expect(out.get(30)).toEqual([{ rule_type: 'faculty', rule_value: 5 }]);
  });

  /**
   * ★ ทัวร์ที่ไม่มีกฎเลยต้องได้ [] ไม่ใช่ undefined
   * "ไม่มีกฎ" = เปิดทุกคณะ = เกินขอบเขตแอดมินคณะ ซึ่งเป็นเคสที่พบมากที่สุด
   * ถ้าคืน undefined แล้วฝั่งเรียกเผลอมองเป็น "ไม่รู้" จะติดป้ายผิดทั้งคิว
   */
  it('gives a tournament with no rules an empty array, not undefined', async () => {
    query.mockResolvedValue([[{ tournament_id: 28, rule_type: 'faculty', rule_value: 1 }], []]);

    const out = await findEligibilityRulesOfMany([28, 29]);

    expect(out.get(29)).toEqual([]);
    expect(out.has(29)).toBe(true);
  });

  it('does not hit the database for an empty page', async () => {
    const out = await findEligibilityRulesOfMany([]);

    expect(query).not.toHaveBeenCalled();
    expect(out.size).toBe(0);
  });

  it('passes the ids as one IN (?) list', async () => {
    query.mockResolvedValue([[], []]);

    await findEligibilityRulesOfMany([28, 29, 30]);

    const [sql, values] = query.mock.calls[0]!;
    expect(String(sql)).toContain('tournament_id IN (?)');
    expect(values).toEqual([[28, 29, 30]]);
  });
});
