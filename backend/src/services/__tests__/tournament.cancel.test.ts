import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/notification.repo.js', () => ({
  findTournamentCancellationAudience: vi.fn(async () => [7, 30, 31, 40, 99]),
}));
vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
  cancelTournament: vi.fn(async () => ({ fromStatus: 'public' })),
  restoreCancelledTournament: vi.fn(async () => ({ restoredTo: 'public' })),
  findRestoreIssues: vi.fn(async () => ({ deletedTeams: [], playersLeftTeam: [] })),
}));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(async () => null) }));
vi.mock('../../repositories/match.repo.js', () => ({}));
vi.mock('../matchResult.service.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../referee.service.js', () => ({}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn() }));

import * as Service from '../tournament.service.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as AdminScopeRepo from '../../repositories/adminScope.repo.js';
import * as NotificationRepo from '../../repositories/notification.repo.js';
import * as NotificationService from '../notification.service.js';
import type { TournamentRow } from '../../types/db.js';

const ORG = 7;
const tournament = (o: Partial<TournamentRow> = {}) => ({
  tournament_id: 50, name: 'Cup', requested_by_user_id: ORG, tournament_status: 'public', ...o,
}) as unknown as TournamentRow;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament());
  vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(null);
});

// migration 053 · มติ 28 ต.ค. 2569
describe('cancelTournament (POST /tournaments/:id/cancel)', () => {
  it('organizer cancels a public tournament → repo called with role organizer', async () => {
    await expect(Service.cancelTournament(50, ORG, 'สนามปิดซ่อม')).resolves.toEqual({
      id: 50, status: 'cancelled', fromStatus: 'public', reason: 'สนามปิดซ่อม', cancelledBy: 'organizer',
    });
    expect(TournamentRepo.cancelTournament).toHaveBeenCalledWith(50, ORG, 'สนามปิดซ่อม', 'organizer');
  });

  it('organizer can cancel a private (approved, unpublished) tournament too', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'private' }));
    vi.mocked(TournamentRepo.cancelTournament).mockResolvedValueOnce({ fromStatus: 'private' });
    await expect(Service.cancelTournament(50, ORG, 'x')).resolves.toMatchObject({ fromStatus: 'private' });
  });

  it('university_wide admin cancels on behalf → role admin, message says ผู้ดูแลระบบ', async () => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);
    await expect(Service.cancelTournament(50, 99, 'ผู้จัดติดต่อไม่ได้')).resolves.toMatchObject({ cancelledBy: 'admin' });
    expect(TournamentRepo.cancelTournament).toHaveBeenCalledWith(50, 99, 'ผู้จัดติดต่อไม่ได้', 'admin');
    expect(vi.mocked(NotificationService.notifyUsers).mock.calls[0]![1].message).toContain('ผู้ดูแลระบบ');
  });

  it.each([
    ['faculty admin', { scope_type: 'faculty' }],
    ['plain user', null],
  ])('%s → 403 NOT_ORGANIZER and nothing written', async (_label, admin) => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(admin as never);
    await expect(Service.cancelTournament(50, 123, 'x')).rejects.toMatchObject({ status: 403, code: 'NOT_ORGANIZER' });
    expect(TournamentRepo.cancelTournament).not.toHaveBeenCalled();
    expect(NotificationService.notifyUsers).not.toHaveBeenCalled();
  });

  it('403 before 409 — an outsider learns nothing about the status', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'completed' }));
    await expect(Service.cancelTournament(50, 123, 'x')).rejects.toMatchObject({ status: 403 });
  });

  it.each([
    ['completed', 'TOURNAMENT_COMPLETED'],
    ['cancelled', 'TOURNAMENT_CANCELLED'],
    ['auto_deleted', 'INVALID_STATUS_TRANSITION'],
  ] as const)('%s → 409 %s', async (status, code) => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: status }));
    await expect(Service.cancelTournament(50, 99, 'x')).rejects.toMatchObject({ status: 409, code });
    expect(TournamentRepo.cancelTournament).not.toHaveBeenCalled();
  });

  it.each(['pending_approval', 'rejected'] as const)('%s (not yet approved) → admin gets 409 INVALID_STATUS_TRANSITION (use delete instead)', async (status) => {
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: status }));
    await expect(Service.cancelTournament(50, 99, 'x')).rejects.toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('404 when the tournament does not exist', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(null);
    await expect(Service.cancelTournament(50, ORG, 'x')).rejects.toMatchObject({ status: 404, code: 'TOURNAMENT_NOT_FOUND' });
  });

  it('409 INVALID_STATUS_TRANSITION when the row changed under us (concurrent click)', async () => {
    vi.mocked(TournamentRepo.cancelTournament).mockResolvedValueOnce(null);
    await expect(Service.cancelTournament(50, ORG, 'x')).rejects.toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
    expect(NotificationService.notifyUsers).not.toHaveBeenCalled();
  });

  it('notifies the whole audience except the actor, with the reason, type tournament_cancelled', async () => {
    await Service.cancelTournament(50, ORG, 'ฝนตกหนัก');
    expect(NotificationRepo.findTournamentCancellationAudience).toHaveBeenCalledWith(50);
    const [users, content] = vi.mocked(NotificationService.notifyUsers).mock.calls[0]!;
    expect(users).toEqual([30, 31, 40, 99]);
    expect(content).toMatchObject({ type: 'tournament_cancelled', relatedEntityType: 'tournament', relatedEntityId: 50 });
    expect(content.message).toContain('ฝนตกหนัก');
    expect(content.title).toContain('Cup');
  });

  it('a notification failure does not undo or fail the cancellation', async () => {
    vi.mocked(NotificationRepo.findTournamentCancellationAudience).mockRejectedValueOnce(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(Service.cancelTournament(50, ORG, 'x')).resolves.toMatchObject({ status: 'cancelled' });
    spy.mockRestore();
  });
});

describe('restoreCancelledTournament (POST /admin/tournaments/:id/restore)', () => {
  beforeEach(() => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'cancelled' }));
  });

  it('restores to the previous status and reports registration stays closed', async () => {
    await expect(Service.restoreCancelledTournament(50, 99)).resolves.toEqual({
      id: 50, status: 'public', registrationOpen: false, issues: { deletedTeams: [], playersLeftTeam: [] },
    });
    expect(TournamentRepo.restoreCancelledTournament).toHaveBeenCalledWith(50, 99);
    expect(NotificationService.notify).not.toHaveBeenCalled();   // ไม่มีปัญหา ⇒ ไม่มีแจ้งเตือนพิเศษถึงผู้จัด
  });

  // มติ 28 ต.ค. — กู้คืนได้ + บอกว่าทีมไหนมีปัญหา (ทีมถูกลบ / คนในรายชื่อออกจากทีม ระหว่างถูกยกเลิก)
  it('reports teams that changed while cancelled, and tells the organizer with names', async () => {
    const issues = {
      deletedTeams: [{ teamId: 3, teamName: 'ทีมหาย' }],
      playersLeftTeam: [{ teamId: 4, teamName: 'ทีมสี่', userId: 41, fullName: 'สมชาย' }],
    };
    vi.mocked(TournamentRepo.findRestoreIssues).mockResolvedValueOnce(issues);
    await expect(Service.restoreCancelledTournament(50, 99)).resolves.toMatchObject({ issues });
    const sent = vi.mocked(NotificationService.notify).mock.calls[0]![0] as { userId: number; type: string; message: string };
    expect(sent).toMatchObject({ userId: ORG, type: 'tournament_restored', relatedEntityId: 50 });
    expect(sent.message).toContain('ทีมหาย');
    expect(sent.message).toContain('สมชาย (ทีมสี่)');
  });

  it('only deleted teams → message mentions just that part', async () => {
    vi.mocked(TournamentRepo.findRestoreIssues).mockResolvedValueOnce({ deletedTeams: [{ teamId: 3, teamName: 'ทีมหาย' }], playersLeftTeam: [] });
    await Service.restoreCancelledTournament(50, 99);
    const sent = vi.mocked(NotificationService.notify).mock.calls[0]![0] as { message: string };
    expect(sent.message).toContain('ทีมที่ถูกลบไปแล้ว');
    expect(sent.message).not.toContain('ออกจากทีม');
  });

  it('notifies everyone (including the organizer) except the admin, type tournament_restored', async () => {
    await Service.restoreCancelledTournament(50, 99);
    const [users, content] = vi.mocked(NotificationService.notifyUsers).mock.calls[0]!;
    expect(users).toEqual([7, 30, 31, 40]);
    expect(content).toMatchObject({ type: 'tournament_restored', relatedEntityId: 50 });
  });

  it.each(['public', 'private', 'completed'] as const)('%s → 409 TOURNAMENT_NOT_CANCELLED', async (status) => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: status }));
    await expect(Service.restoreCancelledTournament(50, 99)).rejects.toMatchObject({ status: 409, code: 'TOURNAMENT_NOT_CANCELLED' });
    expect(TournamentRepo.restoreCancelledTournament).not.toHaveBeenCalled();
  });

  it('409 when the repo finds it no longer cancelled (double restore)', async () => {
    vi.mocked(TournamentRepo.restoreCancelledTournament).mockResolvedValueOnce(null);
    await expect(Service.restoreCancelledTournament(50, 99)).rejects.toMatchObject({ status: 409, code: 'TOURNAMENT_NOT_CANCELLED' });
    expect(NotificationService.notifyUsers).not.toHaveBeenCalled();
  });
});
