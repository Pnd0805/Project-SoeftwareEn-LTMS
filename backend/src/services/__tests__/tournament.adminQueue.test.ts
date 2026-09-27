import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/tournament.repo.js', () => ({
  findPendingTournamentRequests: vi.fn(),
  findTournamentById: vi.fn(),
}));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn() }));
vi.mock('../../repositories/application.repo.js', () => ({
  findEligibilityRules: vi.fn(async () => []),
  findEligibilityRulesOfMany: vi.fn(async () => new Map()),
}));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../referee.service.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({}));
vi.mock('../../mappers/user.mapper.js', () => ({
  toUserRef: vi.fn((row: Record<string, unknown>) => ({ id: row['user_id'], fullName: row['full_name'] })),
}));

import * as Service from '../tournament.service.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as AdminScopeRepo from '../../repositories/adminScope.repo.js';
import * as ApplicationRepo from '../../repositories/application.repo.js';
import type { AdminScopeRow } from '../../types/db.js';

const facultyAdmin = { scope_type: 'faculty', faculty_id: 1 } as AdminScopeRow;
const uniAdmin = { scope_type: 'university_wide', faculty_id: null } as AdminScopeRow;

const row = (id: number, facultyId: number | null = 1) => ({
  tournament_id: id, name: `Cup ${id}`, sport_type_id: 3,
  event_start_date: '2026-10-10', created_at: new Date('2026-09-20T00:00:00Z'),
  organizing_faculty_id: facultyId,
  user_id: 500, full_name: 'ผู้ยื่น', profile_image_key: null,
}) as never;

const rulesMap = (entries: Array<[number, Array<{ rule_type: 'faculty' | 'year'; rule_value: number }>]>) =>
  new Map(entries) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ApplicationRepo.findEligibilityRulesOfMany).mockReset().mockResolvedValue(new Map() as never);
});

/**
 * FE-admin-queue-shows-undecidable-rows (มติ 27 ก.ย. ทางเลือก ข)
 *
 * คิวกรองด้วย `organizing_faculty_id` เงื่อนไขเดียว แต่ด่านอนุมัติเช็ค `adminCoversEligibility` เพิ่ม
 * ค่า default ของฟอร์มคือ "ทุกคณะ" (= ไม่มีกฎคณะ) ⇒ คำขอที่กรอกตามปกติที่สุดโผล่ในคิวของแอดมินคณะ
 * แล้วกดไม่ได้ทุกแถว · FE ยิงจริงแล้วได้ 403 ทั้ง 3 แถว — คิวที่ทุกแถวปฏิเสธไม่ใช่คิว
 */
describe('getPendingTournamentRequests — canDecide', () => {
  it('marks the common case (open to every faculty) as undecidable for a faculty admin', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(facultyAdmin);
    vi.mocked(TournamentRepo.findPendingTournamentRequests).mockResolvedValue({ rows: [row(28)], totalItems: 1 } as never);
    vi.mocked(ApplicationRepo.findEligibilityRulesOfMany).mockResolvedValue(rulesMap([[28, []]]));

    const out = await Service.getPendingTournamentRequests(1, 0, 1, 20);

    expect(out.items[0]).toMatchObject({ id: 28, canDecide: false, cannotDecideReason: 'ELIGIBILITY_OUT_OF_SCOPE' });
  });

  // ★ แถวยังอยู่ในคิว ไม่ได้ถูกกรองออก — แอดมินคณะต้องเห็นว่าคณะตัวเองมีคำขอค้าง
  it('still returns the row and keeps totalItems intact', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(facultyAdmin);
    vi.mocked(TournamentRepo.findPendingTournamentRequests).mockResolvedValue({ rows: [row(28), row(29)], totalItems: 2 } as never);
    vi.mocked(ApplicationRepo.findEligibilityRulesOfMany).mockResolvedValue(rulesMap([[28, []], [29, []]]));

    const out = await Service.getPendingTournamentRequests(1, 0, 1, 20);

    expect(out.items).toHaveLength(2);
    expect(out.pagination.totalItems).toBe(2);
    expect(out.items.every(i => i.canDecide === false)).toBe(true);
  });

  it('marks a row the faculty admin really can sign', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(facultyAdmin);
    vi.mocked(TournamentRepo.findPendingTournamentRequests).mockResolvedValue({ rows: [row(30)], totalItems: 1 } as never);
    vi.mocked(ApplicationRepo.findEligibilityRulesOfMany).mockResolvedValue(
      rulesMap([[30, [{ rule_type: 'faculty', rule_value: 1 }]]]));

    const out = await Service.getPendingTournamentRequests(1, 0, 1, 20);

    expect(out.items[0]).toMatchObject({ canDecide: true, cannotDecideReason: null });
  });

  it('mixes decidable and undecidable rows in one page', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(facultyAdmin);
    vi.mocked(TournamentRepo.findPendingTournamentRequests).mockResolvedValue({ rows: [row(28), row(30)], totalItems: 2 } as never);
    vi.mocked(ApplicationRepo.findEligibilityRulesOfMany).mockResolvedValue(
      rulesMap([[28, []], [30, [{ rule_type: 'faculty', rule_value: 1 }]]]));

    const out = await Service.getPendingTournamentRequests(1, 0, 1, 20);

    expect(out.items.map(i => i.canDecide)).toEqual([false, true]);
  });

  // กฎคณะที่รับคณะอื่นด้วย ก็เกินขอบเขตของแอดมินคณะเหมือนกัน (OD-15 Q2-ข)
  it('marks a row undecidable when the rules admit another faculty as well', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(facultyAdmin);
    vi.mocked(TournamentRepo.findPendingTournamentRequests).mockResolvedValue({ rows: [row(31)], totalItems: 1 } as never);
    vi.mocked(ApplicationRepo.findEligibilityRulesOfMany).mockResolvedValue(
      rulesMap([[31, [{ rule_type: 'faculty', rule_value: 1 }, { rule_type: 'faculty', rule_value: 5 }]]]));

    const out = await Service.getPendingTournamentRequests(1, 0, 1, 20);

    expect(out.items[0]!.canDecide).toBe(false);
  });

  /** university_wide ตัดสินได้ทุกแถว — ไม่ควรเสียคิวรีหากฎทิ้งเปล่า ๆ และเป็นคนที่คิวยาวที่สุด */
  it('short-circuits for a university admin without querying the rules at all', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(uniAdmin);
    vi.mocked(TournamentRepo.findPendingTournamentRequests).mockResolvedValue({ rows: [row(28), row(29, 7)], totalItems: 2 } as never);

    const out = await Service.getPendingTournamentRequests(1, 0, 1, 20);

    expect(out.items.every(i => i.canDecide === true)).toBe(true);
    expect(ApplicationRepo.findEligibilityRulesOfMany).not.toHaveBeenCalled();
  });

  it('asks for every tournament on the page in one query, not one per row', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(facultyAdmin);
    vi.mocked(TournamentRepo.findPendingTournamentRequests).mockResolvedValue({ rows: [row(28), row(29), row(30)], totalItems: 3 } as never);
    vi.mocked(ApplicationRepo.findEligibilityRulesOfMany).mockResolvedValue(rulesMap([[28, []], [29, []], [30, []]]));

    await Service.getPendingTournamentRequests(1, 0, 1, 20);

    expect(ApplicationRepo.findEligibilityRulesOfMany).toHaveBeenCalledTimes(1);
    expect(ApplicationRepo.findEligibilityRulesOfMany).toHaveBeenCalledWith([28, 29, 30]);
    expect(ApplicationRepo.findEligibilityRules).not.toHaveBeenCalled();
  });

  it('403 for someone who is not an admin at all', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(null);
    await expect(Service.getPendingTournamentRequests(1, 0, 1, 20))
      .rejects.toMatchObject({ status: 403, code: 'INSUFFICIENT_ADMIN_SCOPE' });
  });

  it('an empty queue does not query the rules', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(facultyAdmin);
    vi.mocked(TournamentRepo.findPendingTournamentRequests).mockResolvedValue({ rows: [], totalItems: 0 } as never);

    const out = await Service.getPendingTournamentRequests(1, 0, 1, 20);

    expect(out.items).toEqual([]);
    expect(ApplicationRepo.findEligibilityRulesOfMany).toHaveBeenCalledWith([]);
  });
});
