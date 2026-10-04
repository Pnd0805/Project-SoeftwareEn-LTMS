import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/tournamentReferee.repo.js', () => ({
  findAssignableByTournament: vi.fn(),
  findActiveByTournamentAndUser: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../repositories/matchReferee.repo.js', () => ({}));
vi.mock('../../repositories/match.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../../repositories/tournament.repo.js', () => ({}));
vi.mock('../notification.service.js', () => ({ notifyUsers: vi.fn(), notify: vi.fn() }));
vi.mock('../refereeIdentity.service.js', () => ({ resolveApprovalForAccept: vi.fn() }));
vi.mock('../../utils/checkExist.js', () => ({ checkTournament: vi.fn() }));

import * as Service from '../referee.service.js';
import * as RefRepo from '../../repositories/tournamentReferee.repo.js';
import { checkTournament } from '../../utils/checkExist.js';

const TOURNAMENT = 50, ORG = 9001, REF_SELF = 9002, OTHER_REF = 9003, OUTSIDER = 9900;

/** แถว active ที่ repo คืนมา (SQL กรองสถานะมาแล้ว) */
const row = (userId: number, name: string, upcoming: number, trId = userId) =>
  ({ tournament_referee_id: trId, user_id: userId, full_name: name,
     profile_image_key: null, upcoming_match_count: upcoming });

const activeRow = { invitation_status: 'accepted', is_external: 0, external_approval_status: 'not_required',
                    removed_at: null } as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkTournament).mockReset()
    .mockResolvedValue({ tournament_id: TOURNAMENT, requested_by_user_id: ORG,
                         tournament_status: 'published' } as never);
  vi.mocked(RefRepo.findActiveByTournamentAndUser).mockReset().mockResolvedValue([]);
  vi.mocked(RefRepo.findAssignableByTournament).mockReset()
    .mockResolvedValue([row(OTHER_REF, 'กรรมการ ข', 0), row(REF_SELF, 'กรรมการ ก', 2)] as never);
});

/**
 * F02b · OD-59 (4 ต.ค. 2569) — รายชื่อปลายทางของคำขอโอน/แลกแมตช์
 *
 * มาจาก `TO-BACKEND-2026-10-01-frontend-workflows.md` ข้อ 8:
 *   F02 ติด requireOrganizer ⇒ หน้าของกรรมการเรียกไม่ได้ ⇒ FE ต้องรวบรวมปลายทางจาก
 *   `GET /matches/:id/referees` ของแมตช์อื่น ⇒ **กรรมการที่ยังไม่ได้รับแมตช์เลยไม่โผล่**
 *   ซึ่งเป็นคนที่ควรโผล่ที่สุดเพราะว่างที่สุด
 */
describe('listAssignableReferees — ใครเรียกได้', () => {
  it('ผู้จัดเรียกได้', async () => {
    await expect(Service.listAssignableReferees(TOURNAMENT, ORG)).resolves.toHaveProperty('items');
    // ผู้จัดผ่านด่านโดยไม่ต้องถามว่าเป็นกรรมการไหม
    expect(RefRepo.findActiveByTournamentAndUser).not.toHaveBeenCalled();
  });

  it('★ กรรมการที่ใช้งานได้จริงของทัวร์นี้เรียกได้ — นี่คือเหตุผลที่เส้นนี้มี', async () => {
    vi.mocked(RefRepo.findActiveByTournamentAndUser).mockResolvedValue([activeRow]);

    await expect(Service.listAssignableReferees(TOURNAMENT, REF_SELF)).resolves.toHaveProperty('items');
  });

  it('คนนอกทัวร์ → 403 ไม่ใช่ลิสต์ว่าง (ลิสต์ว่างจะทำให้ FE คิดว่าไม่มีใครในทัวร์)', async () => {
    await expect(Service.listAssignableReferees(TOURNAMENT, OUTSIDER))
      .rejects.toMatchObject({ status: 403, code: 'NOT_TOURNAMENT_REFEREE' });

    expect(RefRepo.findAssignableByTournament).not.toHaveBeenCalled();
  });

  it('กรรมการที่ถูกถอด/ยังไม่ตอบรับ → 403 (findActiveRefereeRow คืน null)', async () => {
    vi.mocked(RefRepo.findActiveByTournamentAndUser)
      .mockResolvedValue([{ invitation_status: 'pending', is_external: 0,
                            external_approval_status: 'not_required', removed_at: null } as never]);

    await expect(Service.listAssignableReferees(TOURNAMENT, REF_SELF))
      .rejects.toMatchObject({ status: 403 });
  });
});

describe('listAssignableReferees — คืนอะไร', () => {
  beforeEach(() => {
    vi.mocked(RefRepo.findActiveByTournamentAndUser).mockResolvedValue([activeRow]);
  });

  it('★ ตัวผู้เรียกเองไม่อยู่ในลิสต์ — ไม่มีใครขอโอนแมตช์ให้ตัวเอง', async () => {
    const { items } = await Service.listAssignableReferees(TOURNAMENT, REF_SELF);

    expect(items.map(i => i.user.id)).toEqual([OTHER_REF]);
  });

  it('คืนแค่ id ของใบเชิญ · ตัวคน · ภาระงาน — ไม่มีเรื่องเอกสารตัวตนของใครเลย', async () => {
    const { items } = await Service.listAssignableReferees(TOURNAMENT, ORG);

    expect(Object.keys(items[0]!).sort()).toEqual(['id', 'upcomingMatchCount', 'user']);
    expect(items[0]).not.toHaveProperty('isExternal');
    expect(items[0]).not.toHaveProperty('externalApprovalStatus');
    expect(items[0]).not.toHaveProperty('invitationStatus');
  });

  it('id ที่คืนคือ tournament_referee_id ไม่ใช่ user_id — POST ต้องใช้ตัวนี้', async () => {
    vi.mocked(RefRepo.findAssignableByTournament)
      .mockResolvedValue([row(OTHER_REF, 'กรรมการ ข', 1, 777)] as never);

    const { items } = await Service.listAssignableReferees(TOURNAMENT, ORG);

    expect(items[0]!.id).toBe(777);
    expect(items[0]!.user.id).toBe(OTHER_REF);
  });

  it('upcomingMatchCount เป็น number เสมอ แม้ไดรเวอร์คืน COUNT() มาเป็น string', async () => {
    vi.mocked(RefRepo.findAssignableByTournament)
      .mockResolvedValue([{ ...row(OTHER_REF, 'กรรมการ ข', 0), upcoming_match_count: '3' }] as never);

    const { items } = await Service.listAssignableReferees(TOURNAMENT, ORG);

    expect(items[0]!.upcomingMatchCount).toBe(3);
  });

  it('ทัวร์ที่ยังไม่มีกรรมการ active → items ว่าง ไม่ error', async () => {
    vi.mocked(RefRepo.findAssignableByTournament).mockResolvedValue([]);
    vi.mocked(RefRepo.findActiveByTournamentAndUser).mockResolvedValue([]);

    await expect(Service.listAssignableReferees(TOURNAMENT, ORG)).resolves.toEqual({ items: [] });
  });
});
