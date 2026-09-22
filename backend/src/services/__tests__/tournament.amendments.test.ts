import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({ findAmendmentsByTournament: vi.fn() }));
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

import * as Service from '../tournament.service.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';

beforeEach(() => vi.clearAllMocks());

// C09b — FE-organizer-see-their-own (21 ก.ย.)
describe('getTournamentAmendments', () => {
  it('maps every request with the requester reason and the admin decision', async () => {
    vi.mocked(TournamentRepo.findAmendmentsByTournament).mockResolvedValue([
      { tournament_amendment_request_id: 5, requested_changes: JSON.stringify({ maxTeams: 12 }), request_reason: 'มีทีมสมัครเยอะ',
        tournament_amendment_request_status: 'rejected', requested_at: new Date('2026-09-20T01:00:00Z'),
        reviewed_by: 9001, reviewed_at: new Date('2026-09-20T02:00:00Z'), rejection_reason: 'สนามรองรับไม่พอ', reviewer_name: 'สมชาย' },
      { tournament_amendment_request_id: 6, requested_changes: { venue: 'B' }, request_reason: null,
        tournament_amendment_request_status: 'pending', requested_at: new Date('2026-09-21T01:00:00Z'),
        reviewed_by: null, reviewed_at: null, rejection_reason: null, reviewer_name: null },
    ]);
    await expect(Service.getTournamentAmendments(26)).resolves.toEqual({ items: [
      { id: 5, requestedChanges: { maxTeams: 12 }, reason: 'มีทีมสมัครเยอะ', status: 'rejected', requestedAt: '2026-09-20T01:00:00.000Z',
        reviewedAt: '2026-09-20T02:00:00.000Z', reviewedBy: { id: 9001, name: 'สมชาย' }, rejectionReason: 'สนามรองรับไม่พอ' },
      { id: 6, requestedChanges: { venue: 'B' }, reason: null, status: 'pending', requestedAt: '2026-09-21T01:00:00.000Z',
        reviewedAt: null, reviewedBy: null, rejectionReason: null },
    ] });
    expect(TournamentRepo.findAmendmentsByTournament).toHaveBeenCalledWith(26);
  });
});
