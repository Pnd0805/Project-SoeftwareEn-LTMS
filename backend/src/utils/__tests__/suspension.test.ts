import { describe, it, expect, vi, afterEach } from 'vitest';
import { isCurrentlySuspended, suspensionEndsAt, suspendedSql, notSuspendedSql, MAX_SUSPENSION_DAYS,
         SUSPENSION_CATEGORIES, SUSPENSION_CATEGORY_KEYS, suspensionCategoryLabel, suspendedMessage, suspendedError } from '../suspension.js';

const NOW = new Date('2026-10-01T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

afterEach(() => { vi.useRealTimers(); });

function freeze(){
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
}

describe('isCurrentlySuspended', () => {
  it('ไม่ถูกระงับ ก็คือไม่ถูกระงับ แม้จะมีเวลาสิ้นสุดค้างอยู่จากโทษครั้งก่อน', () => {
    freeze();
    expect(isCurrentlySuspended({ is_suspended : 0 , suspended_until : null })).toBe(false);
    expect(isCurrentlySuspended({ is_suspended : 0 , suspended_until : new Date(NOW.getTime() + DAY) })).toBe(false);
  });

  it('suspended_until = null คือระงับถาวร — พฤติกรรมเดิมก่อน migration 033', () => {
    freeze();
    expect(isCurrentlySuspended({ is_suspended : 1 , suspended_until : null })).toBe(true);
  });

  it('ยังไม่ถึงกำหนด = ยังถูกระงับ', () => {
    freeze();
    expect(isCurrentlySuspended({ is_suspended : 1 , suspended_until : new Date(NOW.getTime() + DAY) })).toBe(true);
  });

  /**
   * หัวใจของทั้งก้อน — ไม่มี cron มาล้าง is_suspended ให้ แถวในฐานจึงยังเป็น 1 อยู่
   * ถ้าตรงนี้ตอบ true คนที่พ้นโทษแล้วจะถูกล็อกออกตลอดไป และ countActiveUniversityWideAdmins
   * จะคิดว่าไม่เหลือแอดมินทั้งที่เหลือ
   */
  it('เลยกำหนดแล้ว = ไม่ถูกระงับ ทั้งที่ธงในฐานยังเป็น 1', () => {
    freeze();
    expect(isCurrentlySuspended({ is_suspended : 1 , suspended_until : new Date(NOW.getTime() - 1000) })).toBe(false);
  });

  it('เวลาสิ้นสุดเท่ากับตอนนี้เป๊ะ ถือว่าพ้นแล้ว', () => {
    freeze();
    expect(isCurrentlySuspended({ is_suspended : 1 , suspended_until : new Date(NOW) })).toBe(false);
  });
});

describe('suspensionEndsAt', () => {
  it('ไม่ระบุจำนวนวัน = ถาวร (null ลงคอลัมน์ได้ตรงๆ)', () => {
    expect(suspensionEndsAt(undefined)).toBeNull();
  });

  it('นับจากเวลาปัจจุบัน ไม่ใช่เที่ยงคืนของวันนั้น', () => {
    freeze();
    expect(suspensionEndsAt(7)?.toISOString()).toBe('2026-10-08T12:00:00.000Z');
  });

  it('เพดานคือ 90 วัน — ค่านี้ถูกอ้างในทั้ง schema และเอกสาร จึงตรึงไว้', () => {
    expect(MAX_SUSPENSION_DAYS).toBe(90);
  });
});

describe('ชิ้นส่วน SQL', () => {
  it('ถามทั้งสองคอลัมน์เสมอ ไม่ใช่แค่ธง', () => {
    const sql = suspendedSql('u');
    expect(sql).toContain('u.is_suspended = 1');
    expect(sql).toContain('u.suspended_until IS NULL');
    expect(sql).toContain('u.suspended_until > NOW()');
  });

  it('รับ alias ได้ เพราะบาง query ใช้ชื่อตารางเต็ม', () => {
    expect(suspendedSql('users')).toContain('users.is_suspended');
  });

  it('notSuspendedSql เป็นนิเสธของอีกตัวพอดี ไม่ใช่เงื่อนไขที่เขียนซ้ำแยกกัน', () => {
    expect(notSuspendedSql('u')).toBe(`NOT ${suspendedSql('u')}`);
  });
});

// ============ ประเภทของโทษที่ส่งให้เจ้าตัวเห็น (migration 034 · OD-40 ทางเลือก ข) ============
describe('ประเภทของโทษ', () => {
  it('ทุกประเภทมีถ้อยคำไทยที่ไม่ว่าง — คีย์ลอยๆ ที่ไม่มีข้อความคือของที่แสดงบนจอไม่ได้', () => {
    for(const key of SUSPENSION_CATEGORY_KEYS){
      expect(SUSPENSION_CATEGORIES[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('ชุดคีย์ตรงกับ ENUM ในฐาน (migration 034) — ถ้าเพิ่มที่เดียวฝั่งใดฝั่งหนึ่งจะพังตอน INSERT', () => {
    expect([...SUSPENSION_CATEGORY_KEYS].sort()).toEqual(
      ['abusive_language' , 'cheating' , 'false_information' , 'other' , 'spam']);
  });

  it('other ต้องไม่ว่างเปล่า — คนอ่านต้องรู้ว่ามีกฎถูกละเมิด แม้ไม่รู้ข้อไหน', () => {
    expect(SUSPENSION_CATEGORIES.other).toContain('ละเมิดกฎ');
  });

  it('แถวเก่าก่อน migration 034 เป็น null คืน null ไม่ใช่ข้อความเดา', () => {
    expect(suspensionCategoryLabel(null)).toBeNull();
    expect(suspensionCategoryLabel('spam')).toBe(SUSPENSION_CATEGORIES.spam);
  });
});

describe('ข้อความและ error ของ 403', () => {
  it('ไม่รู้ประเภท: ข้อความกลางๆ เหมือนก่อน migration 034', () => {
    expect(suspendedMessage(null)).toBe('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  });

  // client ที่แสดงแค่ message ได้ประโยชน์โดยไม่ต้องแก้อะไร
  it('รู้ประเภท: ต่อถ้อยคำเข้าไปในข้อความเลย', () => {
    expect(suspendedMessage('cheating')).toContain(SUSPENSION_CATEGORIES.cheating);
  });

  it('403 แนบทั้งกำหนดพ้น ประเภท และถ้อยคำ', () => {
    const until = new Date('2026-10-08T12:00:00Z');
    const err = suspendedError({ suspended_category : 'spam' , suspended_until : until });

    expect(err.status).toBe(403);
    expect(err.code).toBe('ACCOUNT_SUSPENDED');
    expect(err.extra).toEqual({
      suspendedUntil : '2026-10-08T12:00:00.000Z',
      suspendedCategory : 'spam',
      suspendedCategoryLabel : SUSPENSION_CATEGORIES.spam,
    });
  });

  it('ระงับถาวรและไม่รู้ประเภท: ทั้งสามช่องเป็น null ไม่ใช่หายไป — จอต้องแยกกรณีได้', () => {
    const err = suspendedError({ suspended_category : null , suspended_until : null });
    expect(err.extra).toEqual({ suspendedUntil : null , suspendedCategory : null , suspendedCategoryLabel : null });
  });
});
