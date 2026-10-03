import { describe, it, expect, vi } from 'vitest';

// mapper ประกอบ URL จาก env — ตรึงไว้ให้เทสต์ไม่ผูกกับค่า S3_PUBLIC_BASE ของเครื่องที่รัน
vi.mock('../../utils/imageUrl.js', () => ({
  toPublicImageUrl: (key: string | null) => (key === null ? null : `https://cdn.test/${key}`),
}));

import { toUserReportDto } from '../userReport.mapper.js';
import type { getUserReport } from '../../repositories/userReport.repo.js';

const CREATED_AT = new Date('2026-09-28T03:00:00Z');
const REVIEWED_AT = new Date('2026-09-29T08:30:00Z');

function row(overrides: Partial<getUserReport> = {}): getUserReport {
  return {
    user_report_id: 5,
    reason: 'ใช้ถ้อยคำไม่เหมาะสมในคอมเมนต์',
    evidence: null,
    user_report_status: 'pending',
    created_at: CREATED_AT,
    reporter_id: 9001, reporter_name: 'สมชาย ใจดี', reporter_avatar_key: null,
    target_id: 9002, target_name: 'สมหญิง ตั้งใจ', target_faculty_id: 1,
    target_is_admin: 0, target_avatar_key: null,
    reviewed_by: null, reviewed_by_name: null, reviewed_at: null, rejection_reason: null,
    ...overrides,
  };
}

describe('toUserReportDto', () => {
  it('คำร้องที่ยังไม่ถูกพิจารณา: ช่องผลการพิจารณาเป็น null ครบทั้งสี่', () => {
    const dto = toUserReportDto(row(), []);

    expect(dto).toMatchObject({
      id: 5, status: 'pending', reason: 'ใช้ถ้อยคำไม่เหมาะสมในคอมเมนต์',
      reviewedBy: null, reviewedByName: null, reviewedAt: null, rejectionReason: null,
    });
    expect(dto.createdAt).toBe('2026-09-28T03:00:00.000Z');
  });

  /**
   * แก้ 30 ก.ย. 2569 — `rejection_reason` ถูกบังคับให้แอดมินพิมพ์ตอนปฏิเสธ เก็บลงฐาน
   * แล้วไม่มี endpoint ไหนคืนออกมาเลย (คอลัมน์ที่เขียนแล้วไม่มีใครอ่าน — รูปแบบเดียวกับ
   * FE-replay-link-write-only / FE-checkin-reject-reason-not-listed)
   * แอดมินคนถัดไปจึงไม่รู้ว่าเรื่องคล้ายกันเคยถูกปฏิเสธเพราะอะไร และตัดสินสวนกันเองได้
   */
  it('คำร้องที่ถูกปฏิเสธ: คืนเหตุผล คนตัดสิน และเวลา', () => {
    const dto = toUserReportDto(row({
      user_report_status: 'rejected',
      reviewed_by: 9003, reviewed_by_name: 'ผู้ดูแลระบบ', reviewed_at: REVIEWED_AT,
      rejection_reason: 'หลักฐานไม่เพียงพอ',
    }), []);

    expect(dto).toMatchObject({
      status: 'rejected',
      reviewedBy: 9003,
      reviewedByName: 'ผู้ดูแลระบบ',
      reviewedAt: '2026-09-29T08:30:00.000Z',
      rejectionReason: 'หลักฐานไม่เพียงพอ',
    });
  });

  it('คำร้องที่อนุมัติ: มีคนตัดสินและเวลา แต่ไม่มีเหตุผลปฏิเสธ', () => {
    const dto = toUserReportDto(row({
      user_report_status: 'approved',
      reviewed_by: 9003, reviewed_by_name: 'ผู้ดูแลระบบ', reviewed_at: REVIEWED_AT,
    }), []);

    expect(dto).toMatchObject({ status: 'approved', reviewedBy: 9003, rejectionReason: null });
  });

  // เดิม hardcode null ทั้งสองฝั่ง — รอบที่ไล่แก้ avatar (49faf77) ไม่ถึงไฟล์นี้
  // เพราะ mapper สร้าง UserRefDto ด้วยมือ ไม่ได้เรียก toUserRef
  it('คืนรูปโปรไฟล์ของทั้งผู้แจ้งและผู้ถูกแจ้งเป็น URL', () => {
    const dto = toUserReportDto(row({
      reporter_avatar_key: 'avatar/9001/a.png',
      target_avatar_key: 'avatar/9002/b.png',
    }), []);

    expect(dto.reporter.avatarUrl).toBe('https://cdn.test/avatar/9001/a.png');
    expect(dto.target.avatarUrl).toBe('https://cdn.test/avatar/9002/b.png');
  });

  it('ไม่มีรูปก็ยังเป็น null ไม่ใช่สตริงว่าง', () => {
    const dto = toUserReportDto(row(), []);
    expect(dto.reporter.avatarUrl).toBeNull();
    expect(dto.target.avatarUrl).toBeNull();
  });

  // evidence เป็นหลักฐานส่วนตัว ต้อง presign มาจาก service ก่อนแล้ว — mapper แค่ส่งต่อ ไม่แตะ row.evidence ดิบเลย
  // (ต่างจาก avatarUrl ที่ mapper ประกอบ URL สาธารณะเองได้ตรงๆ เพราะ evidence ไม่ใช่ของสาธารณะ)
  it('evidence ที่ presign มาแล้วถูกส่งต่อตรงๆ ไม่ถูกแตะ', () => {
    expect(toUserReportDto(row(), []).evidence).toEqual([]);
    expect(toUserReportDto(row({ evidence: ['k1', 'k2'] }), ['https://signed/k1', 'https://signed/k2']).evidence)
      .toEqual(['https://signed/k1', 'https://signed/k2']);
  });

  it('isAdmin มาจากเลข 1/0 ของ SQL ไม่ใช่ค่าความจริงแบบหลวม', () => {
    expect(toUserReportDto(row({ target_is_admin: 1 }), []).target.isAdmin).toBe(true);
    expect(toUserReportDto(row({ target_is_admin: 0 }), []).target.isAdmin).toBe(false);
  });
});
