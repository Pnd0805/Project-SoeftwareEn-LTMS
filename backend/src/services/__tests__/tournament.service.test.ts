import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../repositories/tournament.repo.js', () => ({
  publishTournament: vi.fn(),
}));

vi.mock('../../repositories/adminScope.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({
  toTournamentDetailDto: vi.fn(),
  toTournamentListDto: vi.fn(),
}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn() }));

import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as TournamentService from '../tournament.service.js';

const mockedTournamentRepo = vi.mocked(TournamentRepo);

const privateTournament = {
  tournament_id: 10,
  tournament_status: 'private',
} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('publishTournament', () => {
  it('returns the dynamic peak referee requirement in REFEREES_INCOMPLETE', async () => {
    mockedTournamentRepo.publishTournament.mockResolvedValue({
      status: 'referees_incomplete',
      refereesAccepted: 3,
      refereesRequired: 5,
    } as any);

    await expect(TournamentService.publishTournament(privateTournament, 99)).rejects.toMatchObject({
      status: 409,
      code: 'REFEREES_INCOMPLETE',
      extra: {
        refereesAccepted: 3,
        refereesRequired: 5,
      },
    });
  });

  it('reports missing planned schedule separately from referee shortage', async () => {
    mockedTournamentRepo.publishTournament.mockResolvedValue({
      status: 'schedule_incomplete',
      plannedMatches: 7,
      matchesMissingSchedule: 2,
    } as any);

    await expect(TournamentService.publishTournament(privateTournament, 99)).rejects.toMatchObject({
      status: 409,
      code: 'SCHEDULE_INCOMPLETE',
      extra: {
        plannedMatches: 7,
        matchesMissingSchedule: 2,
      },
    });
  });
});
