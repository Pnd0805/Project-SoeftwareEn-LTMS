import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * BR-06 — ทีม Unofficial ต้องสมัครทัวร์อย่างน้อย 1 รายการภายใน 2 สัปดาห์หลังสร้าง
 *          และหากเว้นว่างเกิน 6 เดือนหลังทัวร์แรกจะถูกปิดการใช้งาน
 *
 * กฎทั้งสองข้ออยู่ใน SQL (SWEEP_RULES ใน team.repo.ts) — เทสอ่านเงื่อนไขจาก SQL ตรง ๆ
 * แบบเดียวกับ matchResult.undoOutcome.test.ts เพราะผลจริงต้องมีฐาน
 * การแจ้งลูกทีมหลังกวาด มีเทสแล้วใน team.service.test.ts
 */
const mocks = vi.hoisted(() => ({
  query: vi.fn((..._args: unknown[]) => Promise.resolve([[], []] as unknown)),
}));
vi.mock('../../config/db.js', () => ({ default: { query: mocks.query } }));

import { sweepInactiveTeams } from '../team.repo.js';

const selects = () => mocks.query.mock.calls.map(([sql]) => String(sql)).filter(s => s.includes('SELECT t.team_id'));
const ruleSql = (marker: RegExp) => selects().find(s => marker.test(s))!;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue([[], []]);
});

describe('sweepInactiveTeams — เงื่อนไขของ BR-06', () => {
  it('มีกฎสองข้อพอดี', async () => {
    await sweepInactiveTeams();
    expect(selects()).toHaveLength(2);
  });

  describe('ข้อ 1 — ไม่สมัครทัวร์ภายใน 2 สัปดาห์', () => {
    it('ใช้ 14 วันนับจากวันสร้าง', async () => {
      await sweepInactiveTeams();
      expect(ruleSql(/INTERVAL 14 DAY/)).toContain('t.created_at < NOW() - INTERVAL 14 DAY');
    });

    it('นับว่า "สมัครแล้ว" จากใบสมัครสถานะใดก็ได้ (ยื่นไปแล้ว = ทำตามกฎแล้ว แม้ถูกปฏิเสธ)', async () => {
      await sweepInactiveTeams();
      const sql = ruleSql(/INTERVAL 14 DAY/);
      expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM tournament_applications a WHERE a\.team_id = t\.team_id\)/);
    });

    it('ไม่กวาดทีมที่ถูกปิดไปแล้ว', async () => {
      await sweepInactiveTeams();
      expect(ruleSql(/INTERVAL 14 DAY/)).toContain('t.deleted_at IS NULL');
    });
  });

  describe('ข้อ 2 — เว้นว่างเกิน 6 เดือนหลังทัวร์แรก', () => {
    it('วัดจากแมตช์ที่จบล่าสุด (completed) เทียบ 6 เดือน', async () => {
      await sweepInactiveTeams();
      const sql = ruleSql(/inactive|INTERVAL 6 MONTH/);
      expect(sql).toMatch(/MAX\(m\.updated_at\)[\s\S]*m\.match_status = 'completed'[\s\S]*< NOW\(\) - INTERVAL 6 MONTH/);
    });

    it('นับทั้งแมตช์ที่ทีมเป็นฝั่ง A และฝั่ง B', async () => {
      await sweepInactiveTeams();
      expect(ruleSql(/INTERVAL 6 MONTH/)).toContain('(m.team_a_id = t.team_id OR m.team_b_id = t.team_id)');
    });

    it('ทีมที่มีใบสมัครที่ยังเดินอยู่ (pending/approved) ภายใน 6 เดือน → ไม่ถูกกวาด', async () => {
      await sweepInactiveTeams();
      expect(ruleSql(/INTERVAL 6 MONTH/)).toMatch(
        /NOT EXISTS[\s\S]*tournament_application_status IN \('pending','approved'\)[\s\S]*a\.applied_at > NOW\(\) - INTERVAL 6 MONTH/);
    });

    it('ทีมที่ไม่เคยแข่งเลย → MAX() เป็น NULL ⇒ ข้อนี้ไม่จับ (เป็นหน้าที่ของข้อ 1)', async () => {
      // NULL < x เป็น NULL (ไม่จริง) ใน SQL ⇒ ทีมที่ "ยังไม่มีทัวร์แรก" ไม่ถูกกฎ 6 เดือนกวาด ตรงกับคำว่า "หลังทัวร์แรก"
      await sweepInactiveTeams();
      expect(ruleSql(/INTERVAL 6 MONTH/)).not.toMatch(/COALESCE|IFNULL/);
    });
  });

  describe('การปิดทีม', () => {
    it('ปิดแบบ soft delete พร้อมเหตุผล และเปลี่ยนชื่อให้ชื่อเดิมว่างให้ตั้งใหม่ได้', async () => {
      mocks.query.mockImplementation(async (sql: unknown) => {
        const s = String(sql);
        if (s.includes('INTERVAL 14 DAY') && s.includes('SELECT')) return [[{ team_id: 3, name: 'ทีมเงียบ' }], []];
        if (s.startsWith('SELECT') || s.includes('SELECT t.team_id')) return [[], []];
        return [{ affectedRows: 1 }, []];
      });

      await expect(sweepInactiveTeams()).resolves.toEqual([{ teamId: 3, name: 'ทีมเงียบ', reason: 'no_registration' }]);
      const update = mocks.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE teams'))!;
      expect(String(update[0])).toMatch(/SET deleted_at = NOW\(\), deleted_reason = \?, name = CONCAT/);
      expect(String(update[0])).toContain('deleted_at IS NULL');   // ไม่ปิดซ้ำ
      expect(update[1]).toEqual(['no_registration', 3]);
    });

    it('มีคนอื่นปิดไปก่อน (affectedRows 0) → ไม่นับว่ากวาดในรอบนี้ ไม่แจ้งซ้ำ', async () => {
      mocks.query.mockImplementation(async (sql: unknown) => {
        const s = String(sql);
        if (s.includes('INTERVAL 6 MONTH') && s.includes('SELECT t.team_id')) return [[{ team_id: 4, name: 'X' }], []];
        if (s.includes('SELECT t.team_id')) return [[], []];
        return [{ affectedRows: 0 }, []];
      });
      await expect(sweepInactiveTeams()).resolves.toEqual([]);
    });
  });

  /**
   * 🔴 มติ 6 ต.ค. 2569 (B3) — ปิดช่องว่างระหว่าง SRS กับโค้ด
   *
   * BR-06 ระบุว่ากฎ 2 สัปดาห์ / 6 เดือน ใช้กับ "ทีม Unofficial" แต่ SQL เดิมไม่กรอง
   * official_status เลย ⇒ ทีม Official ที่ไม่ได้แข่ง 6 เดือนก็ถูกปิดอัตโนมัติไปด้วย
   * (เดิมเป็น it.todo รอเคาะ — เคาะแล้วว่าตาม SRS)
   *
   * ★ ต้องยืนยัน **ทั้งสองกฎ** แยกกัน ไม่ใช่เช็ครวม: เงื่อนไขอยู่ใน SQL คนละก้อน
   *   เติมข้อเดียวแล้วอีกข้อลืม = ทีม Official ยังถูกกวาดได้ด้วยกฎที่ลืม
   */
  describe('ทีม Official ไม่ถูกกวาด (BR-06 ใช้กับทีม Unofficial เท่านั้น)', () => {
    it('กฎข้อ 1 (14 วัน) กรองเฉพาะทีม Unofficial', async () => {
      await sweepInactiveTeams();
      expect(ruleSql(/INTERVAL 14 DAY/)).toContain("t.official_status = 'Unofficial'");
    });

    it('กฎข้อ 2 (6 เดือน) กรองเฉพาะทีม Unofficial', async () => {
      await sweepInactiveTeams();
      expect(ruleSql(/INTERVAL 6 MONTH/)).toContain("t.official_status = 'Unofficial'");
    });

    /** ★ กันเคสที่มีคนเติมเงื่อนไขไว้ข้อเดียว — ทั้งสอง SELECT ต้องมีครบ */
    it('ทุกกฎที่กวาดทีม มีเงื่อนไขนี้ครบ', async () => {
      await sweepInactiveTeams();
      const sqls = selects();
      expect(sqls).toHaveLength(2);
      expect(sqls.every(sql => sql.includes("t.official_status = 'Unofficial'"))).toBe(true);
    });
  });
});
