import { describe, it, expect } from 'vitest';
import { suspendUserSchema, approveUserReportSchema } from '../admin.schema.js';
import { MAX_SUSPENSION_DAYS } from '../../utils/suspension.js';

describe('suspendUserSchema — ระยะเวลาระงับ (เพิ่ม 1 ต.ค. 2569)', () => {
  it('ไม่ส่ง days = ระงับถาวร ซึ่งเป็นพฤติกรรมเดิมทั้งหมด จึงต้องผ่านต่อไป', () => {
    const parsed = suspendUserSchema.safeParse({ suspended : true , reason : 'ก่อกวน' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.days).toBeUndefined();
  });

  it.each([1 , 7 , 30 , MAX_SUSPENSION_DAYS])('รับ %i วัน', (days) => {
    expect(suspendUserSchema.safeParse({ suspended : true , reason : 'ก่อกวน' , days }).success).toBe(true);
  });

  // เพดานมีไว้กัน "ระงับ 3650 วัน" ซึ่งคือถาวรที่แอบซ่อนอยู่ ทำให้ลิสต์ของแอดมินอ่านไม่ออกว่าใครโดนถาวรจริง
  it.each([
    ['เกินเพดาน' , MAX_SUSPENSION_DAYS + 1],
    ['ศูนย์วัน' , 0],
    ['ติดลบ' , -5],
    ['เศษส่วน' , 1.5],
  ])('ปฏิเสธ %s', (_label , days) => {
    expect(suspendUserSchema.safeParse({ suspended : true , reason : 'ก่อกวน' , days }).success).toBe(false);
  });

  it('ข้อความตอนเกินเพดานต้องบอกทางออก ไม่ใช่บอกแค่ว่าผิด', () => {
    const parsed = suspendUserSchema.safeParse({ suspended : true , reason : 'ก่อกวน' , days : 365 });
    expect(parsed.success).toBe(false);
    const message = parsed.success ? '' : parsed.error.issues[0]!.message;
    expect(message).toContain(String(MAX_SUSPENSION_DAYS));
    expect(message).toContain('ถาวร');
  });
});

describe('approveUserReportSchema', () => {
  // endpoint นี้เดิมไม่รับ body เลย — client เก่าที่ยิงมาโดยไม่มี body ต้องไม่พังเพราะเราเพิ่ม days
  it('ไม่มี body เลยก็ผ่าน', () => {
    expect(approveUserReportSchema.safeParse(undefined).success).toBe(true);
  });

  it('body ว่างก็ผ่าน', () => {
    expect(approveUserReportSchema.safeParse({}).success).toBe(true);
  });

  it('ใช้เพดานชุดเดียวกับ PATCH suspend', () => {
    expect(approveUserReportSchema.safeParse({ days : 14 }).success).toBe(true);
    expect(approveUserReportSchema.safeParse({ days : MAX_SUSPENSION_DAYS + 1 }).success).toBe(false);
  });
});
