import { describe, it, expect, vi, afterEach } from 'vitest';
import { isCurrentlySuspended, suspensionEndsAt, suspendedSql, notSuspendedSql, MAX_SUSPENSION_DAYS } from '../suspension.js';

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
