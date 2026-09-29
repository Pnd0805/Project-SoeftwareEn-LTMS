import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  changeTournamentStatus: vi.fn(),
  changeRegistrationState: vi.fn(),
}));
vi.mock('../../repositories/adminScope.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../../repositories/match.repo.js', () => ({}));
vi.mock('../referee.service.js', () => ({}));
vi.mock('../matchResult.service.js', () => ({}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn() }));
vi.mock('../../middlewares/requireOrganizer.js', () => ({}));

import * as Service from '../tournament.service.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as NotificationService from '../notification.service.js';
import type { TournamentRow } from '../../types/db.js';

const mockedTournamentRepo = vi.mocked(TournamentRepo);
const mockedNotifyLeaders = vi.mocked(NotificationService.notifyTournamentTeamLeaders);

const tournament = (o: Partial<TournamentRow> = {}) => ({
  tournament_id: 50, name: 'Cup', tournament_status: 'public', registration_open: 0, ...o,
}) as TournamentRow;

beforeEach(() => vi.resetAllMocks());

describe('unpublishTournament', () => {
  it('409 INVALID_STATUS_TRANSITION when the tournament is not currently public', async () => {
    await expect(Service.unpublishTournament(tournament({ tournament_status: 'private' }), 9)).rejects.toMatchObject({
      status: 409, code: 'INVALID_STATUS_TRANSITION',
    });
  });

  it('409 REGISTRATION_OPEN when registration has not been closed first', async () => {
    await expect(Service.unpublishTournament(tournament({ registration_open: 1 }), 9)).rejects.toMatchObject({
      status: 409, code: 'REGISTRATION_OPEN',
    });
  });

  it('409 INVALID_STATUS_TRANSITION when the status changed under us', async () => {
    mockedTournamentRepo.changeTournamentStatus.mockResolvedValue(false);
    await expect(Service.unpublishTournament(tournament(), 9)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('moves the tournament from public to private', async () => {
    mockedTournamentRepo.changeTournamentStatus.mockResolvedValue(true);
    const result = await Service.unpublishTournament(tournament(), 9);
    expect(mockedTournamentRepo.changeTournamentStatus).toHaveBeenCalledWith(50, 9, 'public', 'private');
    expect(result).toEqual({ id: 50, status: 'private' });
  });
});

describe('openRegistration', () => {
  it('409 INVALID_STATUS_TRANSITION unless the tournament is public with registration currently closed', async () => {
    await expect(Service.openRegistration(tournament({ tournament_status: 'private' }), 9)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
    await expect(Service.openRegistration(tournament({ registration_open: 1 }), 9)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('409 INVALID_STATUS_TRANSITION when the state changed under us', async () => {
    mockedTournamentRepo.changeRegistrationState.mockResolvedValue(false);
    await expect(Service.openRegistration(tournament(), 9)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('opens registration and notifies team leaders', async () => {
    mockedTournamentRepo.changeRegistrationState.mockResolvedValue(true);
    const result = await Service.openRegistration(tournament(), 9);
    expect(mockedTournamentRepo.changeRegistrationState).toHaveBeenCalledWith(50, 9, true);
    expect(mockedNotifyLeaders).toHaveBeenCalledWith(50, expect.objectContaining({ type: 'registration_toggled' }));
    expect(result).toEqual({ id: 50, registrationOpen: true });
  });
});

describe('closeRegistration', () => {
  it('409 INVALID_STATUS_TRANSITION unless the tournament is public with registration currently open', async () => {
    await expect(Service.closeRegistration(tournament({ registration_open: 0 }), 9)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
    await expect(Service.closeRegistration(tournament({ tournament_status: 'private', registration_open: 1 }), 9)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('409 INVALID_STATUS_TRANSITION when the state changed under us', async () => {
    mockedTournamentRepo.changeRegistrationState.mockResolvedValue(false);
    await expect(Service.closeRegistration(tournament({ registration_open: 1 }), 9)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('closes registration and notifies team leaders', async () => {
    mockedTournamentRepo.changeRegistrationState.mockResolvedValue(true);
    const result = await Service.closeRegistration(tournament({ registration_open: 1 }), 9);
    expect(mockedTournamentRepo.changeRegistrationState).toHaveBeenCalledWith(50, 9, false);
    expect(mockedNotifyLeaders).toHaveBeenCalledWith(50, expect.objectContaining({ type: 'registration_toggled' }));
    expect(result).toEqual({ id: 50, registrationOpen: false });
  });
});
