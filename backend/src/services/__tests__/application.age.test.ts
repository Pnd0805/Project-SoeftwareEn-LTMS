import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/application.repo.js', () => ({
  findTeamForApply: vi.fn(),
  findExistingApplication: vi.fn(),
  findTeamMembersForFilter: vi.fn(),
  findRefereesAmongUsers: vi.fn(() => Promise.resolve([])),
  findEligibilityRules: vi.fn(),
  insertApplication: vi.fn(),
  insertApplicationWithPlayers: vi.fn(),
  findPlayerConflicts: vi.fn(() => Promise.resolve([])),
  deletePlayersByApplication: vi.fn(),
}));

vi.mock('../../repositories/sportType.repo.js', () => ({
  findSportTypeById: vi.fn(() => Promise.resolve({ min_members: 1, max_members: 20 })),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
}));

vi.mock('../../mappers/team.mapper.js', () => ({ toTeamRef: vi.fn() }));
vi.mock('../../mappers/application.mapper.js', () => ({
  toApplicationDetailDto: vi.fn(),
  toMyApplicationDto: vi.fn(),
  toOrganizerApplicationDto: vi.fn(),
}));

import * as ApplicationRepo from '../../repositories/application.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as ApplicationService from '../application.service.js';

const mockedApplicationRepo = vi.mocked(ApplicationRepo);
const mockedTournamentRepo = vi.mocked(TournamentRepo);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-15T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('application age eligibility', () => {
  it('calculates completed age at registration_end rather than today', async () => {
    mockedApplicationRepo.findTeamForApply.mockResolvedValue({
      team_id: 20,
      leader_id: 7,
      sport_type_id: 1,
      readiness_status: 'Ready',
    } as any);
    mockedTournamentRepo.findTournamentById.mockResolvedValue({
      tournament_id: 30,
      sport_type_id: 1,
      requested_by_user_id: 999,
      registration_open: 1,
      registration_end: new Date('2027-01-02T00:00:00Z'),
      gender_requirement: 'any',
      min_age: 17,
      max_age: null,
    } as any);
    mockedApplicationRepo.findExistingApplication.mockResolvedValue(null);
    mockedApplicationRepo.findTeamMembersForFilter.mockResolvedValue([
      {
        user_id: 7,
        full_name: 'Boundary Player',
        birth_date: '2009-12-31',
        gender: 'male',
        year: 1,
        faculty_id: 1,
      },
    ] as any);
    mockedApplicationRepo.findEligibilityRules.mockResolvedValue([]);
    mockedApplicationRepo.insertApplicationWithPlayers.mockResolvedValue(123);

    await expect(ApplicationService.applyTournament(30, 20, 7, [7])).resolves.toMatchObject({
      id: 123,
      status: 'pending',
      hardFilterPassed: true,
    });
  });
});
