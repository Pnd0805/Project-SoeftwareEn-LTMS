import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../upload.service.js', () => ({
  getPresignedDownloadUrl: vi.fn((key: string) => Promise.resolve(`https://s3/${key}?signed`)),
}));
vi.mock('../../utils/imageUrl.js', () => ({
  toPublicImageUrl: (key: string | null) => (key === null ? null : `https://cdn.test/${key}`),
}));

vi.mock('../../repositories/user.repo.js', () => ({
  findById: vi.fn(),
  suspendUser: vi.fn(() => Promise.resolve(1)),
  // มติ 8 ต.ค. 2569 — grantScope/revokeScope เขียน users.user_type (staff ตอนได้ยศ)
  updateUserType: vi.fn(() => Promise.resolve()),
  hasActivePublicTournamentAsOrganizer: vi.fn(() => Promise.resolve(false)),
  hasApprovedApplicationAsLeader: vi.fn(() => Promise.resolve(false)),
}));
vi.mock('../../repositories/adminScope.repo.js', () => ({
  findAdminByUserId: vi.fn(() => Promise.resolve(null)),
  countActiveUniversityWideAdmins: vi.fn(() => Promise.resolve(5)),
  countActiveFacultyAdmins: vi.fn(() => Promise.resolve(5)),
}));
vi.mock('../../repositories/auditLog.repo.js', () => ({
  insertAuditLog: vi.fn(() => Promise.resolve(1)),
}));

import { suspendUser } from '../adminScope.service.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as UserRepo from '../../repositories/user.repo.js';
import * as AuditLogRepo from '../../repositories/auditLog.repo.js';
import type { AdminScopeRow } from '../../types/db.js';

const mockedUserRepo = vi.mocked(UserRepo);
const mockedAudit = vi.mocked(AuditLogRepo);
const mockedAdminRepo = vi.mocked(AdminRepo);

const NOW = new Date('2026-10-01T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const admin = { admin_scope_id : 1 , user_id : 1 , scope_type : 'university_wide' , faculty_id : null } as AdminScopeRow;

const target = {
  user_id : 9 , full_name : 'ผู้ใช้ทดสอบ' , email : 't@ku.th' , password_hash : 'h' ,
  gender : 'male' as const , birth_date : '2000-01-01' , user_type : 'student' as const ,
  faculty_id : 2 , department_id : 3 , year : 2 , profile_image_key : null ,
  contact_info : null , address : null , is_suspended : 0 , suspended_reason : null , suspended_until : null , suspended_category : null ,
  total_points : 0 , notification_prefs : null , show_profile_stats: 1, profile_edit_log : null , email_verified : 0 , token_version : 0 ,
  created_at : NOW , updated_at : null ,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockedUserRepo.findById.mockResolvedValue(target);
  mockedUserRepo.suspendUser.mockResolvedValue(1);
  mockedUserRepo.hasActivePublicTournamentAsOrganizer.mockResolvedValue(false);
  mockedUserRepo.hasApprovedApplicationAsLeader.mockResolvedValue(false);
  // 🔴 clearAllMocks ไม่ล้าง implementation ⇒ ต้องตั้งค่าเริ่มต้นเองทุกเทส ไม่งั้นค่าจากเทสก่อนรั่วมา
  mockedAdminRepo.findAdminByUserId.mockResolvedValue(null);
  mockedAdminRepo.countActiveUniversityWideAdmins.mockResolvedValue(5);
  mockedAdminRepo.countActiveFacultyAdmins.mockResolvedValue(5);
});
afterEach(() => { vi.useRealTimers(); });

describe('suspendUser — ระยะเวลาระงับ (มติ 1 ต.ค. 2569)', () => {
  it('ไม่ส่ง days = ระงับถาวร เขียน NULL ลงคอลัมน์ เหมือนก่อน migration 033 ทุกประการ', async () => {
    await suspendUser(admin , 9 , true , 'ก่อกวน' , undefined , 'abusive_language');

    expect(mockedUserRepo.suspendUser).toHaveBeenCalledWith(9 , true , 'ก่อกวน' , null , 'abusive_language');
  });

  it('ส่ง days = คำนวณเวลาสิ้นสุดจากตอนนี้ แล้วเขียนลงคอลัมน์', async () => {
    await suspendUser(admin , 9 , true , 'ก่อกวน' , 7 , 'abusive_language');

    const until = mockedUserRepo.suspendUser.mock.calls[0]![3] as Date;
    expect(until.toISOString()).toBe(new Date(NOW.getTime() + 7 * DAY).toISOString());
  });

  /**
   * days คือเจตนาที่แอดมินกด · until คือผลที่เกิดจริง
   * ต้องเก็บทั้งคู่ เพราะตอนไล่ย้อนคำถามคือ "ตั้งใจแบนกี่วัน" ไม่ใช่แค่ "หมดเมื่อไร"
   */
  it('audit log เก็บทั้งจำนวนวันและเวลาสิ้นสุด', async () => {
    await suspendUser(admin , 9 , true , 'ก่อกวน' , 7 , 'abusive_language');

    const payload = mockedAudit.insertAuditLog.mock.calls[0]![4] as Record<string , unknown>;
    expect(payload).toMatchObject({ reason : 'ก่อกวน' , days : 7 });
    expect(payload['until']).toBe(new Date(NOW.getTime() + 7 * DAY).toISOString());
  });

  it('ระงับถาวร: audit log บอกชัดว่า days/until เป็น null ไม่ใช่ไม่มีช่อง', async () => {
    await suspendUser(admin , 9 , true , 'ก่อกวน' , undefined , 'abusive_language');

    expect(mockedAudit.insertAuditLog.mock.calls[0]![4]).toMatchObject({ days : null , until : null });
  });

  it('ปลดระงับ: ล้างเวลาสิ้นสุดไปด้วย ไม่ปล่อยค้างไว้ให้โทษรอบหน้าสืบทอดกำหนดเก่า', async () => {
    await suspendUser(admin , 9 , false , undefined , undefined , undefined);

    expect(mockedUserRepo.suspendUser).toHaveBeenCalledWith(9 , false , null);
  });

  it('เหตุผลยังบังคับเหมือนเดิม แม้จะระบุจำนวนวันมาแล้ว', async () => {
    await expect(suspendUser(admin , 9 , true , undefined , 7 , 'abusive_language')).rejects.toMatchObject({
      status : 400 , code : 'SUSPEND_REASON_REQUIRED',
    });
    expect(mockedUserRepo.suspendUser).not.toHaveBeenCalled();
  });

  // ---- ประเภทของโทษ (migration 034 · OD-40 ทางเลือก ข) ----

  it('เขียนประเภทลงคอลัมน์แยก ไม่ปนกับเหตุผลที่แอดมินพิมพ์', async () => {
    await suspendUser(admin , 9 , true , 'พิมพ์ด่าในคอมเมนต์แมตช์ที่ 88' , 7 , 'abusive_language');

    const call = mockedUserRepo.suspendUser.mock.calls[0]!;
    expect(call[2]).toBe('พิมพ์ด่าในคอมเมนต์แมตช์ที่ 88');   // บันทึกภายใน ไม่ส่งออก
    expect(call[4]).toBe('abusive_language');                  // ที่เจ้าตัวจะเห็น
  });

  /**
   * ถ้าไม่บังคับ แอดมินจะข้ามทุกครั้ง แล้วฟีเจอร์นี้กลายเป็นของตกแต่ง — คนถูกระงับยังไม่รู้อะไรเหมือนเดิม
   * เหตุผลเดียวกับที่ reason ถูกทำให้บังคับตอนแอดมินลบความเห็น
   */
  it('ไม่ส่งประเภทมา = 400 และไม่แตะฐานเลย', async () => {
    await expect(suspendUser(admin , 9 , true , 'ก่อกวน' , 7 , undefined)).rejects.toMatchObject({
      status : 400 , code : 'SUSPEND_CATEGORY_REQUIRED',
    });
    expect(mockedUserRepo.suspendUser).not.toHaveBeenCalled();
  });

  it('audit log เก็บประเภทไว้ด้วย', async () => {
    await suspendUser(admin , 9 , true , 'ก่อกวน' , undefined , 'cheating');

    expect(mockedAudit.insertAuditLog.mock.calls[0]![4]).toMatchObject({ category : 'cheating' });
  });

  it('ปลดระงับล้างประเภทไปด้วย ไม่ให้โทษรอบหน้าสืบทอดประเภทเก่า', async () => {
    await suspendUser(admin , 9 , false , undefined , undefined , undefined);

    expect(mockedUserRepo.suspendUser).toHaveBeenCalledWith(9 , false , null);
  });
});

/**
 * ด่าน USER_HAS_ACTIVE_OBLIGATIONS — เดิม **ไม่มีเทสไหนเอ่ยถึงเลย** (ไล่ตรวจ 6 ต.ค. 2569)
 *
 * ★ นี่คือมติของทีมเรื่องอำนาจแอดมิน ไม่ใช่ validation เฉย ๆ:
 *   ห้ามระงับคนที่ยังถือภาระค้างอยู่ เพราะถ้าระงับ คนที่เดือดร้อนคือ "คนอื่น" —
 *   ทัวร์ที่เขาจัดอยู่จะไม่มีคนดูแล และทีมที่เขาเป็นหัวหน้าจะไม่มีคนกดอะไรได้
 *   ⇒ ต้องจัดการภาระให้จบก่อน แล้วค่อยระงับ
 *
 * 🔴 ถ้าด่านนี้เงียบ จะไม่มีอะไรฟ้องเลย — การระงับสำเร็จตามปกติ
 *   ความเสียหายไปโผล่ที่ทัวร์ที่ค้างอยู่ทีหลัง ซึ่งไล่ย้อนกลับมาหาสาเหตุนี้ยากมาก
 */
describe('suspendUser — ภาระค้างอยู่ (USER_HAS_ACTIVE_OBLIGATIONS)', () => {
  it('ยังจัดทัวร์ที่เปิดอยู่ = 409 และไม่ระงับ', async () => {
    mockedUserRepo.hasActivePublicTournamentAsOrganizer.mockResolvedValue(true);

    await expect(suspendUser(admin , 9 , true , 'ก่อกวน' , 7 , 'abusive_language')).rejects.toMatchObject({
      status : 409 , code : 'USER_HAS_ACTIVE_OBLIGATIONS',
    });
    expect(mockedUserRepo.suspendUser).not.toHaveBeenCalled();
    expect(mockedAudit.insertAuditLog).not.toHaveBeenCalled();
  });

  it('เป็นหัวหน้าทีมที่มีใบสมัครอนุมัติแล้ว = 409 และไม่ระงับ', async () => {
    mockedUserRepo.hasApprovedApplicationAsLeader.mockResolvedValue(true);

    await expect(suspendUser(admin , 9 , true , 'ก่อกวน' , 7 , 'abusive_language')).rejects.toMatchObject({
      status : 409 , code : 'USER_HAS_ACTIVE_OBLIGATIONS',
    });
    expect(mockedUserRepo.suspendUser).not.toHaveBeenCalled();
  });

  /**
   * ★ ต้องเช็คทั้งสองอย่างพร้อมกันเสมอ (Promise.all) ไม่ใช่ลัดวงจรหยุดที่ตัวแรก
   *   ไม่ใช่เรื่องความเร็ว แต่เพราะถ้าวันหนึ่งมีคนอยากให้ error บอกว่า "ค้างอะไรอยู่"
   *   ต้องมีคำตอบทั้งสองข้าง ไม่ใช่รู้แค่ข้อแรกที่เจอ
   */
  it('ไม่มีภาระค้าง = ระงับได้ และถาม ครบทั้งสองอย่าง', async () => {
    await suspendUser(admin , 9 , true , 'ก่อกวน' , 7 , 'abusive_language');

    expect(mockedUserRepo.hasActivePublicTournamentAsOrganizer).toHaveBeenCalledWith(9);
    expect(mockedUserRepo.hasApprovedApplicationAsLeader).toHaveBeenCalledWith(9);
    expect(mockedUserRepo.suspendUser).toHaveBeenCalled();
  });

  /**
   * ปลดระงับต้องไม่ติดด่านนี้ ไม่งั้นคนที่ถูกระงับไว้ตอนยังไม่มีภาระ
   * แต่ภายหลังทีมของเขาได้รับอนุมัติ จะกลายเป็นปลดไม่ออกตลอดกาล
   */
  it('ปลดระงับไม่ติดด่านนี้ แม้มีภาระค้างอยู่', async () => {
    mockedUserRepo.hasActivePublicTournamentAsOrganizer.mockResolvedValue(true);

    await suspendUser(admin , 9 , false , undefined , undefined , undefined);

    expect(mockedUserRepo.suspendUser).toHaveBeenCalledWith(9 , false , null);
  });
});

/**
 * 🔴 A1 (แก้ 6 ต.ค. 2569) — ห้ามระงับบัญชี root ไม่ว่าใครจะเป็นคนขอ
 *
 * เดิม university admin ระงับ root ได้ ⇒ root เรียก API อะไรไม่ได้เลย (requireAuth ตอบ 403)
 * ขัดกับเจตนาในโค้ดเอง: revokeScope ห้ามถอนสิทธิ์ root เพราะระบบต้องมี root เสมอ
 * แต่การระงับบัญชีให้ผลเดียวกัน ⇒ เดินอ้อมด่านนั้นได้ด้วยปุ่มอื่น
 * ★ กันเฉพาะ "ระงับ" ไม่กัน "ปลดระงับ" — ปลดระงับคือการกู้คืน root ที่ติดอยู่
 */
describe('suspendUser — ห้ามระงับ root (A1)', () => {
  const rootScope = { admin_scope_id : 99 , user_id : 9 , scope_type : 'root' , faculty_id : null } as AdminScopeRow;

  it('university admin ระงับ root → 403 CANNOT_SUSPEND_ROOT และไม่เขียนฐานเลย', async () => {
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(rootScope);

    await expect(suspendUser(admin , 9 , true , 'ก่อกวน' , undefined , 'abusive_language'))
      .rejects.toMatchObject({ status : 403 , code : 'CANNOT_SUSPEND_ROOT' });

    expect(mockedUserRepo.suspendUser).not.toHaveBeenCalled();
    expect(mockedAudit.insertAuditLog).not.toHaveBeenCalled();
  });

  /** ★ ปลดระงับ root ต้องยังทำได้ — ไม่งั้น root ที่ถูกระงับไว้ก่อนหน้านี้จะติดถาวร */
  it('ปลดระงับ root ยังทำได้', async () => {
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(rootScope);

    await suspendUser(admin , 9 , false , undefined , undefined , undefined);

    expect(mockedUserRepo.suspendUser).toHaveBeenCalledWith(9 , false , null);
  });

  /** ★ แอดมินคณะยังระงับได้ตามเดิม — ด่าน root ต้องไม่กินกว้างเกิน (B5 ก็ไม่แตะเคสนี้) */
  it('ระงับแอดมินคณะยังทำได้ตามเดิม', async () => {
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(
      { admin_scope_id : 7 , user_id : 9 , scope_type : 'faculty' , faculty_id : 2 } as AdminScopeRow);

    await suspendUser(admin , 9 , true , 'ก่อกวน' , undefined , 'abusive_language');

    expect(mockedUserRepo.suspendUser).toHaveBeenCalled();
  });
});

/**
 * 🔴 B5 (มติ 6 ต.ค. 2569 ทางเลือก ก) — ระงับแอดมินมหาวิทยาลัยด้วยปุ่มเดียวไม่ได้
 *
 * เดิมทำได้ กันแค่ "คนสุดท้าย" ขณะที่การถอนสิทธิ์ระดับเดียวกันทำไม่ได้เลย
 * ⇒ ถอนสิทธิ์เพื่อนร่วมระดับไม่ได้ แต่ปิดบัญชีเขาได้ ซึ่งผลหนักกว่า = เดินอ้อมกฎอำนาจ
 * ★ ทางที่เลือกคือ 2 ขั้น: root ถอนสิทธิ์ก่อน → แล้วระงับในฐานะผู้ใช้ทั่วไป
 *   (ไม่ให้อำนาจกดใหม่กับ root เลย ⇒ ไม่ขัดมติ 28 ก.ย. OD-34)
 */
describe('suspendUser — ระงับแอดมินมหาวิทยาลัยไม่ได้ (B5)', () => {
  const univScope = { admin_scope_id : 7 , user_id : 9 , scope_type : 'university_wide' , faculty_id : null } as AdminScopeRow;

  it('ระงับแอดมินมหาวิทยาลัยคนอื่น → 403 CANNOT_SUSPEND_UNIVERSITY_ADMIN และไม่เขียนฐาน', async () => {
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(univScope);

    await expect(suspendUser(admin , 9 , true , 'ก่อกวน' , undefined , 'abusive_language'))
      .rejects.toMatchObject({ status : 403 , code : 'CANNOT_SUSPEND_UNIVERSITY_ADMIN' });

    expect(mockedUserRepo.suspendUser).not.toHaveBeenCalled();
    expect(mockedAudit.insertAuditLog).not.toHaveBeenCalled();
  });

  /** ★ ปฏิเสธโดยไม่ต้องสนว่าเหลือกี่คน — เหตุผลคือ "อำนาจระดับเดียวกัน" ไม่ใช่ "คนสุดท้าย" */
  it('ปฏิเสธแม้มีแอดมินมหาวิทยาลัยเหลืออีกหลายคน', async () => {
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(univScope);
    mockedAdminRepo.countActiveUniversityWideAdmins.mockResolvedValue(9);

    await expect(suspendUser(admin , 9 , true , 'ก่อกวน' , undefined , 'abusive_language'))
      .rejects.toMatchObject({ code : 'CANNOT_SUSPEND_UNIVERSITY_ADMIN' });
  });

  /** ★ ขั้นที่สองของทางเลือก ก: ถอนสิทธิ์แล้ว (ไม่มี scope) ⇒ ระงับได้ตามปกติ */
  it('ถอนสิทธิ์ไปแล้ว (เป็นผู้ใช้ทั่วไป) ⇒ ระงับได้ตามปกติ', async () => {
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(null);

    await suspendUser(admin , 9 , true , 'ก่อกวน' , undefined , 'abusive_language');

    expect(mockedUserRepo.suspendUser).toHaveBeenCalled();
  });

  /** ★ ปลดระงับยังทำได้ — ด่านนี้อยู่ในเส้น "ระงับ" เท่านั้น ไม่ใช่เส้นกู้คืน */
  it('ปลดระงับแอดมินมหาวิทยาลัยยังทำได้', async () => {
    mockedAdminRepo.findAdminByUserId.mockResolvedValue(univScope);

    await suspendUser(admin , 9 , false , undefined , undefined , undefined);

    expect(mockedUserRepo.suspendUser).toHaveBeenCalledWith(9 , false , null);
  });
});
