import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  publishTournament: vi.fn(),
}));

vi.mock('../../repositories/adminScope.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({
  findSportTypeById: vi.fn(async () => ({ sport_type_id: 1, default_mode: 'onsite' })),
}));
// กฎกรรมการต่อแมตช์ (BR-11) อยู่ใน referee.service — mock ให้ on-site = 2, online = 1
vi.mock('../referee.service.js', () => ({
  refereesNeededPerMatch: vi.fn(async () => (mode: 'onsite' | 'online') => (mode === 'onsite' ? 2 : 1)),
}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({
  toTournamentDetailDto: vi.fn(),
  toTournamentListDto: vi.fn(),
}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn() }));

import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as TournamentService from '../tournament.service.js';
import * as NotificationService from '../notification.service.js';

const mockedTournamentRepo = vi.mocked(TournamentRepo);

const privateTournament = {
  tournament_id: 10,
  tournament_status: 'private',
} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('publishTournament', () => {
  it('requires a referee pool of refereesNeededPerMatch(default_mode) and reports it in REFEREES_INCOMPLETE', async () => {
    mockedTournamentRepo.publishTournament.mockResolvedValue({
      status: 'referees_incomplete',
      refereesAccepted: 1,
    } as any);

    await expect(TournamentService.publishTournament(privateTournament, 99)).rejects.toMatchObject({
      status: 409,
      code: 'REFEREES_INCOMPLETE',
      extra: { refereesAccepted: 1, refereesRequired: 2 },   // on-site + stat → 2
    });
    expect(mockedTournamentRepo.publishTournament).toHaveBeenCalledWith(privateTournament.tournament_id, 99, 2);
  });

  it('publishes when the repo accepts the pool', async () => {
    mockedTournamentRepo.publishTournament.mockResolvedValue({ status: 'ok' } as any);

    await expect(TournamentService.publishTournament(privateTournament, 99)).resolves.toEqual({
      id: privateTournament.tournament_id,
      status: 'public',
    });
    // C1-ข — กรรมการที่ตอบรับแล้วรู้ว่าทัวร์เปิดเผยแพร่
    expect(NotificationService.notifyTournamentReferees).toHaveBeenCalledWith(
      privateTournament.tournament_id, expect.objectContaining({ type: 'tournament_published' }));
  });
});
