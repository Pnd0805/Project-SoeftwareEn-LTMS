import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/user.repo.js', () => ({
  findNotificationPrefs: vi.fn(async () => null),
  updateNotificationPrefs: vi.fn(async () => 1),
}));

vi.mock('../../repositories/notification.repo.js', () => ({
  findByUser: vi.fn(async () => ({ rows: [], totalItems: 0 })),
  countUnread: vi.fn(async () => 0),
  insertNotification: vi.fn(),
  findOwned: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  findMatchAudience: vi.fn(),
  findTournamentTeamLeaders: vi.fn(),
  findTournamentReferees: vi.fn(),
  findMatchResultParties: vi.fn(),
  findTournamentSquadsAndLeaders: vi.fn(),
  findTeamMemberIds: vi.fn(),
}));

import * as NotificationService from '../notification.service.js';
import * as NotificationRepo from '../../repositories/notification.repo.js';
import * as UserRepo from '../../repositories/user.repo.js';
import {
  MUTABLE_CATEGORIES, NOTIFICATION_CATEGORY, categoryOf, resolvePrefs, mutedTypes,
} from '../../config/notificationCategories.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(UserRepo.findNotificationPrefs).mockResolvedValue(null);
  vi.mocked(NotificationRepo.findByUser).mockResolvedValue({ rows: [], totalItems: 0 });
  vi.mocked(NotificationRepo.countUnread).mockResolvedValue(0);
  vi.mocked(UserRepo.updateNotificationPrefs).mockResolvedValue(1);
});

/**
 * OD-43 — ผู้ใช้ปิด/เปิดการแจ้งเตือนเป็นหมวดได้ (spec 08 §3)
 * เกณฑ์ของหมวด `critical` คือ "มีเส้นตายที่วัดได้ ไม่รู้แล้วเสียสิทธิ์ถาวร" — ปิดไม่ได้
 */
describe('ตารางหมวด — ความครบถ้วนและกฎพื้นฐาน', () => {
  it('ทุกชนิดในตารางต้องอยู่ในหมวดที่รู้จัก', () => {
    const known = new Set<string>([...MUTABLE_CATEGORIES, 'critical']);
    for (const [type, category] of Object.entries(NOTIFICATION_CATEGORY)) {
      expect(known.has(category), `${type} อยู่หมวด ${category} ซึ่งไม่รู้จัก`).toBe(true);
    }
  });

  it('ชนิดที่ยังไม่ได้จัดหมวด = critical (ลืมจัดหมวดต้องไม่ทำให้แจ้งเตือนหายเงียบ)', () => {
    expect(categoryOf('a_type_nobody_has_written_yet')).toBe('critical');
  });

  it('ชนิดที่มีเส้นตายจริงต้องเป็น critical', () => {
    // ทุกตัวอ้างเส้นตายของจริงได้: expires_at · dispute_window_hours · ORG_RESOLVE_HOURS · เวลาแข่ง
    for (const type of ['team_invited', 'match_scheduled', 'checkin_opened', 'result_submitted',
                        'result_disputed', 'match_result_complaint_filed', 'referee_invited']) {
      expect(categoryOf(type), type).toBe('critical');
    }
  });

  /**
   * ★ เติมหมวด 3 ต.ค. — ชนิดที่เพิ่มหลังจากสาขา `backend_shokun_2` แยกออกไป (ตกหล่นจากตาราง)
   * เทสสองข้อนี้มีเพื่อกัน "เติมแล้วหาย" ไม่ใช่เพียงกัน "ลืมเติม"
   */
  it('team_deleted เป็น critical — การกวาดทีมร้างเกิดขึ้นโดยลูกทีมไม่ได้ทำอะไรเลย', () => {
    expect(categoryOf('team_deleted')).toBe('critical');
    const allOff = Object.fromEntries(MUTABLE_CATEGORIES.map(c => [c, false]));
    expect(mutedTypes(allOff)).not.toContain('team_deleted');
  });

  /**
   * ★ OD-49 ข้อที่สาม — ประกาศของผู้จัดถูกแยกเป็นสองชนิด เพราะชนิดเดียวคุมสองความหมายที่คนละขั้ว
   * ตรึงว่า "ปิดหมวด tournament แล้วข่าวเลื่อนเวลา/เปลี่ยนสนามต้องยังมาถึง" ซึ่งเป็นเหตุผลทั้งหมดของการแยก
   * ครอบกรรมการด้วย — กรรมการได้ประกาศก้อนเดียวกับผู้เล่น ถ้าหลุดไปอยู่ tournament จะพลาดสนามที่ย้าย
   */
  it('ประกาศด่วนของผู้จัดปิดไม่ได้ แต่ประกาศทั่วไปปิดได้', () => {
    expect(categoryOf('tournament_announcement_urgent')).toBe('critical');
    expect(categoryOf('tournament_announcement')).toBe('tournament');

    const muted = mutedTypes({ tournament: false });
    expect(muted).toContain('tournament_announcement');
    expect(muted).not.toContain('tournament_announcement_urgent');
  });

  it('★ ปิดทุกหมวดที่ปิดได้ ข่าวเลื่อนเวลาแข่งก็ยังมาถึง', () => {
    const allOff = Object.fromEntries(MUTABLE_CATEGORIES.map(c => [c, false]));
    expect(mutedTypes(allOff)).not.toContain('tournament_announcement_urgent');
  });

  it('comment_rewritten_after_removal เป็น community — ไม่มีเส้นตาย รู้ช้าก็ตรวจได้', () => {
    expect(categoryOf('comment_rewritten_after_removal')).toBe('community');
    expect(mutedTypes({ community: false })).toContain('comment_rewritten_after_removal');
  });

  it('เรื่องชุมชนปิดได้ทั้งหมด — ไม่มีเส้นตาย รู้ช้าก็ไม่เสียสิทธิ์', () => {
    for (const type of ['comment_removed', 'comment_reported', 'pickem_cancelled']) {
      expect(categoryOf(type), type).toBe('community');
    }
  });
});

describe('resolvePrefs — ค่าเริ่มต้นคือเปิดทุกหมวด', () => {
  it('ยังไม่เคยตั้งค่า (NULL) → เปิดหมด', () => {
    expect(resolvePrefs(null)).toEqual({ team: true, tournament: true, match: true, referee: true, result: true, community: true });
  });

  it('มีแต่ค่า false เท่านั้นที่แปลว่าปิด — คีย์ที่ขาดหายถือว่าเปิด', () => {
    expect(resolvePrefs({ community: false })).toMatchObject({ community: false, team: true });
  });

  it('JSON เพี้ยน / ไม่ใช่ object → เปิดหมด ไม่พัง', () => {
    for (const bad of ['ไม่ใช่ json', 42, [], undefined]) {
      expect(resolvePrefs(bad).team).toBe(true);
    }
  });
});

describe('mutedTypes — แปลงหมวดที่ปิดเป็นรายชื่อชนิด', () => {
  it('ไม่ได้ปิดอะไร → ลิสต์ว่าง (repo จะได้ข้ามเงื่อนไข WHERE ไปเลย)', () => {
    expect(mutedTypes(null)).toEqual([]);
  });

  it('ปิดหมวดชุมชน → ได้ชนิดของชุมชนครบ และไม่ติดของหมวดอื่นมาด้วย', () => {
    const muted = mutedTypes({ community: false });
    expect(muted).toContain('comment_removed');
    expect(muted).toContain('pickem_cancelled');
    expect(muted).not.toContain('match_scheduled');
  });

  it('★ ปิดทุกหมวดที่ปิดได้ ก็ยังไม่มี critical หลุดมาสักตัว', () => {
    const allOff = Object.fromEntries(MUTABLE_CATEGORIES.map(c => [c, false]));
    const muted = new Set(mutedTypes(allOff));
    const criticals = Object.entries(NOTIFICATION_CATEGORY).filter(([, c]) => c === 'critical').map(([t]) => t);
    expect(criticals.length).toBeGreaterThan(0);
    for (const type of criticals) {
      expect(muted.has(type), `${type} เป็น critical แต่ถูกปิดได้`).toBe(false);
    }
  });
});

describe('listMyNotifications — กรองตอนอ่าน (เปลี่ยนค่าแล้วมีผลย้อนหลัง)', () => {
  it('ไม่ได้ปิดอะไร → ส่งลิสต์ว่างให้ repo ทั้งสองตัว', async () => {
    await NotificationService.listMyNotifications(5, false, 1, 20, 0);
    expect(NotificationRepo.findByUser).toHaveBeenCalledWith(5, false, 0, 20, []);
    expect(NotificationRepo.countUnread).toHaveBeenCalledWith(5, []);
  });

  it('ปิดหมวดชุมชน → ชนิดของชุมชนถูกส่งไปให้ repo กรองออก', async () => {
    vi.mocked(UserRepo.findNotificationPrefs).mockResolvedValue({ community: false });
    await NotificationService.listMyNotifications(5, false, 1, 20, 0);

    const excluded = vi.mocked(NotificationRepo.findByUser).mock.calls[0]![4]!;
    expect(excluded).toContain('comment_reported');
    expect(excluded).not.toContain('result_submitted');
  });

  it('includeMuted=true → กล่องคืนของที่ปิดไว้ด้วย (สเปคห้ามลบ history)', async () => {
    vi.mocked(UserRepo.findNotificationPrefs).mockResolvedValue({ community: false });
    await NotificationService.listMyNotifications(5, false, 1, 20, 0, true);
    expect(NotificationRepo.findByUser).toHaveBeenCalledWith(5, false, 0, 20, []);
  });

  it('★ กระดิ่งไม่นับหมวดที่ปิด แม้ตอนขอ includeMuted — เลขต้องไม่กระพริบตาม query', async () => {
    vi.mocked(UserRepo.findNotificationPrefs).mockResolvedValue({ community: false });
    await NotificationService.listMyNotifications(5, false, 1, 20, 0, true);

    const counted = vi.mocked(NotificationRepo.countUnread).mock.calls[0]![1]!;
    expect(counted).toContain('comment_reported');
  });

  it('ส่งค่า unreadOnly กับ pagination ต่อไปเหมือนเดิม', async () => {
    vi.mocked(NotificationRepo.countUnread).mockResolvedValue(3);
    const out = await NotificationService.listMyNotifications(5, true, 2, 10, 10);
    expect(NotificationRepo.findByUser).toHaveBeenCalledWith(5, true, 10, 10, []);
    expect(out.unreadCount).toBe(3);
    expect(out.pagination).toMatchObject({ page: 2, pageSize: 10 });
  });
});

describe('getMyNotificationPrefs — FE ไม่ต้อง hardcode รายชื่อหมวด', () => {
  it('คืนทุกหมวดพร้อมธง locked · critical มาเป็นตัวแรกและ locked เสมอ', async () => {
    const out = await NotificationService.getMyNotificationPrefs(5);
    expect(out.categories[0]).toEqual({ key: 'critical', enabled: true, locked: true });
    expect(out.categories).toHaveLength(MUTABLE_CATEGORIES.length + 1);
    expect(out.categories.filter(c => c.locked)).toHaveLength(1);
  });

  it('ยังไม่เคยตั้งค่า → ทุกหมวดเปิด', async () => {
    const out = await NotificationService.getMyNotificationPrefs(5);
    expect(out.categories.every(c => c.enabled)).toBe(true);
  });

  it('ปิดไว้หมวดหนึ่ง → สะท้อนกลับมาถูกตัว', async () => {
    vi.mocked(UserRepo.findNotificationPrefs).mockResolvedValue({ match: false });
    const out = await NotificationService.getMyNotificationPrefs(5);
    expect(out.categories.find(c => c.key === 'match')).toMatchObject({ enabled: false, locked: false });
    expect(out.categories.find(c => c.key === 'team')).toMatchObject({ enabled: true });
  });
});

describe('updateMyNotificationPrefs — PATCH คงค่าที่ไม่ได้ส่งมา', () => {
  it('ส่งมาหมวดเดียว หมวดอื่นต้องไม่ถูกล้างเป็นค่าเริ่มต้น', async () => {
    vi.mocked(UserRepo.findNotificationPrefs).mockResolvedValue({ community: false });
    await NotificationService.updateMyNotificationPrefs(5, { match: false });

    expect(UserRepo.updateNotificationPrefs).toHaveBeenCalledWith(5,
      expect.objectContaining({ community: false, match: false, team: true }));
  });

  it('เปิดกลับได้ (ส่ง true ทับค่าเดิม)', async () => {
    vi.mocked(UserRepo.findNotificationPrefs).mockResolvedValue({ community: false });
    await NotificationService.updateMyNotificationPrefs(5, { community: true });
    expect(UserRepo.updateNotificationPrefs).toHaveBeenCalledWith(5, expect.objectContaining({ community: true }));
  });

  it('เขียนค่าครบทุกหมวดลงฐานเสมอ — อ่านย้อนหลังแล้วไม่ต้องเดาว่าคีย์ที่หายคืออะไร', async () => {
    await NotificationService.updateMyNotificationPrefs(5, { team: false });
    const written = vi.mocked(UserRepo.updateNotificationPrefs).mock.calls[0]![1]!;
    expect(Object.keys(written).sort()).toEqual([...MUTABLE_CATEGORIES].sort());
  });

  it('ไม่มี user นั้น → 404', async () => {
    vi.mocked(UserRepo.updateNotificationPrefs).mockResolvedValue(0);
    await expect(NotificationService.updateMyNotificationPrefs(999, { team: false }))
      .rejects.toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
  });

  it('ตั้งค่าเสร็จแล้วคืนสถานะล่าสุดกลับไปเลย (FE ไม่ต้องยิง GET ซ้ำ)', async () => {
    vi.mocked(UserRepo.findNotificationPrefs).mockResolvedValue({ result: false });
    const out = await NotificationService.updateMyNotificationPrefs(5, { result: false });
    expect(out.categories.find(c => c.key === 'result')).toMatchObject({ enabled: false });
  });
});
