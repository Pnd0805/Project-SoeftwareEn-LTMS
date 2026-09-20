import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/tournament.repo.js', () => ({
  replaceEligibilityRules: vi.fn(async () => undefined),
  hasLiveApplications: vi.fn(async () => false),
  approveTournament: vi.fn(async () => true),
  findTournamentById: vi.fn(),
}));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn() }));
vi.mock('../../repositories/application.repo.js', () => ({ findEligibilityRules: vi.fn(async () => []) }));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({ findFacultyById: vi.fn(async (id: number) => id < 100 ? { faculty_id: id, name: 'F' } : null) }));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../referee.service.js', () => ({}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn() }));

import * as Service from '../tournament.service.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as AdminScopeRepo from '../../repositories/adminScope.repo.js';
import * as ApplicationRepo from '../../repositories/application.repo.js';
import type { AdminScopeRow, TournamentRow } from '../../types/db.js';

const facultyAdmin = { scope_type: 'faculty', faculty_id: 3 } as AdminScopeRow;
const uniAdmin = { scope_type: 'university_wide', faculty_id: null } as AdminScopeRow;
const tournament = (o: Partial<TournamentRow> = {}) => ({
  tournament_id: 50, organizing_faculty_id: 3, tournament_status: 'pending_approval', registration_open: 0, ...o,
}) as unknown as TournamentRow;

beforeEach(() => vi.clearAllMocks());

describe('normalizeEligibilityRules (Q1-ค)', () => {
  it('dedupes and keeps valid faculty/year rules', async () => {
    const out = await Service.normalizeEligibilityRules([{ type: 'faculty', value: 3 }, { type: 'faculty', value: 3 }, { type: 'year', value: 1 }]);
    expect(out).toEqual([{ type: 'faculty', value: 3 }, { type: 'year', value: 1 }]);
  });
  it('rejects an unknown faculty and a year above 8', async () => {
    await expect(Service.normalizeEligibilityRules([{ type: 'faculty', value: 999 }])).rejects.toMatchObject({ status: 400 });
    await expect(Service.normalizeEligibilityRules([{ type: 'year', value: 9 }])).rejects.toMatchObject({ status: 400 });
  });
});

describe('adminCoversEligibility (Q2-ข)', () => {
  it('university_wide covers everything', () => {
    expect(Service.adminCoversEligibility(uniAdmin, 7, [])).toBe(true);
  });
  it('faculty admin covers only own-faculty organizer AND faculty rules restricted to own faculty', () => {
    expect(Service.adminCoversEligibility(facultyAdmin, 3, [{ type: 'faculty', value: 3 }])).toBe(true);
    expect(Service.adminCoversEligibility(facultyAdmin, 3, [{ type: 'faculty', value: 3 }, { type: 'year', value: 2 }])).toBe(true);
    expect(Service.adminCoversEligibility(facultyAdmin, 3, [])).toBe(false);                                        // open to all faculties
    expect(Service.adminCoversEligibility(facultyAdmin, 3, [{ type: 'faculty', value: 3 }, { type: 'faculty', value: 5 }])).toBe(false);
    expect(Service.adminCoversEligibility(facultyAdmin, 5, [{ type: 'faculty', value: 3 }])).toBe(false);          // other faculty organizes
  });
});

describe('approveTournament (C04) applies Q2-ข', () => {
  it('faculty admin cannot approve an own-faculty tournament that admits every faculty', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament());
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(facultyAdmin);
    vi.mocked(ApplicationRepo.findEligibilityRules).mockResolvedValue([]);
    await expect(Service.approveTournament(50, 1)).rejects.toMatchObject({ status: 403, code: 'ELIGIBILITY_OUT_OF_SCOPE' });
    expect(TournamentRepo.approveTournament).not.toHaveBeenCalled();
  });
  it('faculty admin approves when rules restrict to own faculty', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament());
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(facultyAdmin);
    vi.mocked(ApplicationRepo.findEligibilityRules).mockResolvedValue([{ rule_type: 'faculty', rule_value: 3 }] as never);
    await expect(Service.approveTournament(50, 1)).resolves.toMatchObject({ status: 'private' });
  });
});

describe('setEligibilityRules (PUT, C17b)', () => {
  it('replaces the rules while the tournament is still pending approval', async () => {
    const out = await Service.setEligibilityRules(tournament(), 9, { rules: [{ type: 'faculty', value: 3 }] });
    expect(TournamentRepo.replaceEligibilityRules).toHaveBeenCalledWith(50, 9, [{ type: 'faculty', value: 3 }]);
    expect(out).toEqual({ items: [{ ruleType: 'faculty', ruleValue: 3 }] });
  });
  it('409 USE_AMENDMENT_REQUEST once the tournament has been approved', async () => {
    await expect(Service.setEligibilityRules(tournament({ tournament_status: 'private' } as never), 9, { rules: [] }))
      .rejects.toMatchObject({ status: 409, code: 'USE_AMENDMENT_REQUEST' });
  });
  it('409 ELIGIBILITY_LOCKED when registration is open or teams already applied', async () => {
    await expect(Service.setEligibilityRules(tournament({ registration_open: 1 } as never), 9, { rules: [] }))
      .rejects.toMatchObject({ status: 409, code: 'ELIGIBILITY_LOCKED' });
    vi.mocked(TournamentRepo.hasLiveApplications).mockResolvedValueOnce(true);
    await expect(Service.setEligibilityRules(tournament(), 9, { rules: [] }))
      .rejects.toMatchObject({ status: 409, code: 'ELIGIBILITY_LOCKED' });
  });
});

describe('getEligibilityRules (C17) — requester sees their own pending/rejected tournament', () => {
  it.each(['pending_approval', 'rejected', 'completed'] as const)('owner reads rules while %s; stranger gets 404', async (status) => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: status, requested_by_user_id: 9 } as never));
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(null);
    vi.mocked(ApplicationRepo.findEligibilityRules).mockResolvedValue([]);
    await expect(Service.getEligibilityRules(50, 9)).resolves.toEqual({ items: [] });
    await expect(Service.getEligibilityRules(50, 10)).rejects.toMatchObject({ status: 404, code: 'TOURNAMENT_NOT_FOUND' });
    await expect(Service.getEligibilityRules(50)).rejects.toMatchObject({ status: 404 });
  });
  it('auto_deleted stays hidden even from the owner', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'auto_deleted', requested_by_user_id: 9 } as never));
    vi.mocked(AdminScopeRepo.findAdminByUserId).mockResolvedValue(null);
    await expect(Service.getEligibilityRules(50, 9)).rejects.toMatchObject({ status: 404 });
  });
});
