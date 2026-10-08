import { describe, it, expect } from 'vitest';
import { parseCriteria, isStatCriteria, STAT_COLUMNS } from '../rewardCriteria.js';
import { PICKEM_TIER_POINTS } from '../scoring.js';

/**
 * OD-64 — เกณฑ์เหรียญเก็บเป็นข้อมูลใน `rewards.criteria` ซึ่งแอดมินแก้ได้
 * ค่าจากตรงนั้นถูกเอาไปต่อเป็นชื่อคอลัมน์ใน SQL จึงต้องผ่าน allowlist ทุกครั้ง
 */
describe('parseCriteria — รูปที่รองรับ', () => {
  it('รูปสถิติ: อ่านออกและบอกได้ว่าเป็นสาย stat', () => {
    const c = parseCriteria({ stat: 'wins', gte: 10 });
    expect(c).toEqual({ stat: 'wins', gte: 10 });
    expect(isStatCriteria(c!)).toBe(true);
  });

  it('รูป Pick\'em: อ่านออกและไม่ใช่สาย stat', () => {
    const c = parseCriteria({ pickem: 'spot_on', gte: 5 });
    expect(c).toEqual({ pickem: 'spot_on', gte: 5 });
    expect(isStatCriteria(c!)).toBe(false);
  });

  it('รับทุกคอลัมน์ใน allowlist', () => {
    for (const stat of STAT_COLUMNS) {
      expect(parseCriteria({ stat, gte: 1 }), stat).toEqual({ stat, gte: 1 });
    }
  });

  it('คอลัมน์ JSON ที่ไดรเวอร์คืนมาเป็นสตริงก็อ่านออก', () => {
    expect(parseCriteria('{"stat":"wins","gte":3}')).toEqual({ stat: 'wins', gte: 3 });
  });
});

describe('parseCriteria — ของที่ต้องปฏิเสธ', () => {
  it('★ ชื่อคอลัมน์นอก allowlist ต้องไม่ผ่าน (กันยิง SQL ผ่านแถว rewards)', () => {
    expect(parseCriteria({ stat: 'total_points', gte: 1 })).toBeNull();
    expect(parseCriteria({ stat: 'wins`, (SELECT 1)', gte: 1 })).toBeNull();
    expect(parseCriteria({ stat: '*', gte: 1 })).toBeNull();
  });

  it('gte ต้องเป็นจำนวนเต็มบวก', () => {
    for (const gte of [0, -1, 1.5, '10', null, undefined]) {
      expect(parseCriteria({ stat: 'wins', gte }), String(gte)).toBeNull();
    }
  });

  it('pickem ชั้นอื่นยังไม่รองรับ', () => {
    expect(parseCriteria({ pickem: 'close', gte: 5 })).toBeNull();
    expect(parseCriteria({ pickem: 'side_only', gte: 5 })).toBeNull();
  });

  it('NULL · สตริงพัง · array · รูปที่ไม่รู้จัก → null ไม่โยน error', () => {
    for (const bad of [null, undefined, 'ไม่ใช่ json', '{', [], 42, {}, { gte: 5 }, { foo: 'bar', gte: 1 }]) {
      expect(parseCriteria(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('ผูกกับชั้นจริงของ OD-56', () => {
  // ★ OD-65 — เกณฑ์เก็บ "ชื่อชั้น" ไม่ใช่ "เลขแต้ม" แล้ว
  //   ⇒ ค่าที่ parse ออกมาต้องเป็นชั้นที่ระบบคิดแต้มรู้จักจริง
  //   ไม่งั้น SQL จะเทียบกับ enum ที่ไม่มีค่านั้นแล้วได้ 0 แถวเงียบ ๆ
  it('ชั้นที่ criteria ยอมรับ ต้องเป็นชั้นที่ระบบคิดแต้มรู้จัก', () => {
    const parsed = parseCriteria({ pickem: 'spot_on', gte: 5 });
    expect(parsed).toEqual({ pickem: 'spot_on', gte: 5 });
    expect(Object.keys(PICKEM_TIER_POINTS)).toContain('spot_on');
  });
});
