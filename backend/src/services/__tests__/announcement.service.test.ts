import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(),
  notifyTournamentSquads: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/announcement.repo.js', () => ({
  create: vi.fn(),
  findById: vi.fn(),
  findByTournament: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

vi.mock('../../utils/checkExist.js', () => ({
  checkAnnouncement: vi.fn(),
}));

import * as announcementService from '../announcement.service.js';
import { categoryOf } from '../../config/notificationCategories.js';
import * as AnnouncementRepo from '../../repositories/announcement.repo.js';
import * as NotificationService from '../notification.service.js';
import { checkAnnouncement } from '../../utils/checkExist.js';
import type { AnnouncementRow } from '../../types/db.js';

const mockedRepo = vi.mocked(AnnouncementRepo);
const mockedNotify = vi.mocked(NotificationService);
const mockedCheck = vi.mocked(checkAnnouncement);

function row(overrides: Partial<AnnouncementRow> = {}): AnnouncementRow {
  return {
    announcement_id: 7,
    tournament_id: 20,
    match_id: null,
    created_by: 9001,
    announcement_type: 'general',
    title: 'เช็คอินก่อนเวลา 30 นาที',
    content: 'ขอให้ทุกทีมมาเช็คอินก่อนเวลาแข่ง 30 นาที',
    created_at: new Date('2026-10-01T03:00:00Z'),
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRepo.create.mockResolvedValue(7);
  mockedCheck.mockResolvedValue(row());
});

/**
 * E08 — เดิมบันทึกลงฐานแล้วจบ ไม่มีแจ้งเตือนเลย ประกาศขึ้นค้างในหน้าทัวร์
 * คนต้องเข้าไปเปิดดูเองถึงจะเห็น ⇒ ผู้จัดเลื่อนเวลาแข่งแล้วไม่มีใครรู้ (แก้ 1 ต.ค. 2569)
 */
describe('createAnnouncement — แจ้งเตือน', () => {
  it('แจ้งนักแข่งกับหัวหน้าทีม และไม่ส่งกลับหาผู้จัดที่โพสต์เอง', async () => {
    await announcementService.createAnnouncement(20, 'เช็คอินก่อนเวลา 30 นาที', 'ขอให้ทุกทีมมาเช็คอินก่อนเวลาแข่ง 30 นาที', 9001);

    expect(mockedNotify.notifyTournamentSquads).toHaveBeenCalledWith(
      20,
      expect.objectContaining({
        type: 'tournament_announcement',
        message: 'ขอให้ทุกทีมมาเช็คอินก่อนเวลาแข่ง 30 นาที',
        relatedEntityType: 'tournament',
        relatedEntityId: 20,
      }),
      { exceptUserId: 9001 },
    );
  });

  /**
   * notifyTournamentSquads ครอบแค่ผู้เล่นในรายชื่อลงแข่งกับหัวหน้าทีม — ไม่มีกรรมการ
   * แต่ schedule_change/venue_change เป็นเรื่องที่กรรมการต้องรู้ก่อนใคร จึงยิงสองกลุ่ม
   */
  it('แจ้งกรรมการของทัวร์ด้วย ไม่ใช่แค่นักแข่ง', async () => {
    await announcementService.createAnnouncement(20, 'ย้ายสนาม', 'ย้ายไปสนาม 2', 9001, 'venue_change');

    expect(mockedNotify.notifyTournamentReferees).toHaveBeenCalledWith(
      20,
      expect.objectContaining({ type: 'tournament_announcement_urgent' }),
    );
  });

  /**
   * OD-49 — ประกาศถูกแยกเป็นสองชนิดตอนยิง เพราะ announcement_type เดียวคุมสองความหมายที่คนละขั้ว
   *   schedule_change/venue_change  ไม่รู้ = ไปผิดวัน/ผิดสนาม = แพ้บาย (M10)  → critical ปิดไม่ได้
   *   general/result/livestream     ไม่รู้ก็ไม่เสียสิทธิ์                      → tournament ปิดได้
   * เทสนี้ตรึงการจับคู่ ไม่ใช่แค่ว่า "ยิงออกไป" — เพราะถ้าจับคู่ผิดจะไม่มีอะไรพังให้เห็น
   */
  it.each([
    ['schedule_change' , 'tournament_announcement_urgent'],
    ['venue_change'    , 'tournament_announcement_urgent'],
    ['general'         , 'tournament_announcement'],
    ['result'          , 'tournament_announcement'],
    ['livestream'      , 'tournament_announcement'],
  ] as const)('ประกาศประเภท %s ยิงเป็นชนิด %s', async (announcementType, notificationType) => {
    await announcementService.createAnnouncement(20, 'หัวข้อ', 'เนื้อหา', 9001, announcementType);

    expect(mockedNotify.notifyTournamentSquads).toHaveBeenCalledWith(
      20, expect.objectContaining({ type: notificationType }), { exceptUserId: 9001 },
    );
    expect(mockedNotify.notifyTournamentReferees).toHaveBeenCalledWith(
      20, expect.objectContaining({ type: notificationType }),
    );
  });

  /**
   * ★ ชนิดที่ยิงต้องอยู่ในตารางหมวดจริง ไม่ใช่สตริงที่พิมพ์ถูกโดยบังเอิญ
   * tsc กันไว้ให้ชั้นหนึ่งแล้ว (NotificationInput.type เป็น union) แต่ตรึงที่ runtime ด้วย
   * เพราะ union กันได้แค่ตอน compile — ถ้ามีใคร cast ทิ้งมันจะหลุด
   */
  it('ชนิดที่ยิงอยู่ในตารางหมวดทั้งสองตัว และอยู่หมวดที่ตั้งใจ', async () => {
    expect(categoryOf('tournament_announcement_urgent')).toBe('critical');
    expect(categoryOf('tournament_announcement')).toBe('tournament');
  });

  it('ทั้งสองกลุ่มได้เนื้อหาชุดเดียวกัน', async () => {
    await announcementService.createAnnouncement(20, 'ย้ายสนาม', 'ย้ายไปสนาม 2', 9001, 'venue_change');

    const squadContent = mockedNotify.notifyTournamentSquads.mock.calls[0]![1];
    const refereeContent = mockedNotify.notifyTournamentReferees.mock.calls[0]![1];
    expect(refereeContent).toEqual(squadContent);
  });

  // ตารางมี announcement_type อยู่แล้วแต่ไม่มีใครใช้ ประกาศทุกประเภทจึงหน้าตาเหมือนกันหมด
  it.each([
    ['general'         , 'ประกาศจากผู้จัด: หัวข้อ'],
    ['schedule_change' , 'เปลี่ยนกำหนดการแข่ง: หัวข้อ'],
    ['venue_change'    , 'เปลี่ยนสนามแข่ง: หัวข้อ'],
    ['result'          , 'ประกาศผลการแข่งขัน: หัวข้อ'],
    ['livestream'      , 'ถ่ายทอดสด: หัวข้อ'],
  ] as const)('ประเภท %s ขึ้นหัวข้อว่า "%s"', async (type, expected) => {
    await announcementService.createAnnouncement(20, 'หัวข้อ', 'เนื้อหา', 9001, type);

    expect(mockedNotify.notifyTournamentSquads).toHaveBeenCalledWith(
      20, expect.objectContaining({ title: expected }), { exceptUserId: 9001 },
    );
  });

  it('ไม่ระบุประเภทมา = general', async () => {
    await announcementService.createAnnouncement(20, 'หัวข้อ', 'เนื้อหา', 9001);

    expect(mockedNotify.notifyTournamentSquads).toHaveBeenCalledWith(
      20, expect.objectContaining({ title: 'ประกาศจากผู้จัด: หัวข้อ' }), { exceptUserId: 9001 },
    );
  });

  // แจ้งเตือนต้องยิง "หลัง" บันทึกสำเร็จ — ประกาศที่บันทึกไม่ลงต้องไม่มีใครได้รับแจ้ง
  it('บันทึกไม่สำเร็จ = ไม่ยิงแจ้งเตือนเลย', async () => {
    mockedCheck.mockRejectedValue(new Error('ANNOUNCEMENT_NOT_FOUND'));

    await expect(announcementService.createAnnouncement(20, 'x', 'y', 9001)).rejects.toThrow();
    expect(mockedNotify.notifyTournamentSquads).not.toHaveBeenCalled();
    expect(mockedNotify.notifyTournamentReferees).not.toHaveBeenCalled();
  });
});

/**
 * แก้/ลบประกาศ **ไม่ยิงซ้ำโดยเจตนา** — ผู้จัดแก้คำผิดคำเดียวจะกลายเป็นยิงใหม่ทั้งทัวร์
 * ถ้าเรื่องสำคัญพอให้คนรู้อีกครั้ง ผู้จัดโพสต์ใหม่ได้
 */
describe('updateAnnouncement / deleteAnnouncement — ไม่แจ้งซ้ำ', () => {
  it('แก้ประกาศไม่ยิงแจ้งเตือน', async () => {
    mockedRepo.update.mockResolvedValue(undefined as never);

    await announcementService.updateAnnouncement(7, { title: 'แก้คำผิด' }, 9001);

    expect(mockedNotify.notifyTournamentSquads).not.toHaveBeenCalled();
    expect(mockedNotify.notifyTournamentReferees).not.toHaveBeenCalled();
  });

  it('ลบประกาศไม่ยิงแจ้งเตือน', async () => {
    mockedRepo.softDelete.mockResolvedValue(true);

    await announcementService.deleteAnnouncement(7, 9001);

    expect(mockedNotify.notifyTournamentSquads).not.toHaveBeenCalled();
    expect(mockedNotify.notifyTournamentReferees).not.toHaveBeenCalled();
  });
});
