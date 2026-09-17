import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/s3.js', () => ({ default: {} }));
vi.mock('../../config/env.js', () => ({ env: { S3_BUCKET: 'ltms-test' } }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(() => Promise.resolve('https://s3/signed')),
}));

vi.mock('../../repositories/match.repo.js', () => ({
  findMatchById: vi.fn(),
  isUserInTeams: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
}));

import * as uploadService from '../upload.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import { AppError } from '../../utils/AppError.js';

const checkinInput = { purpose: 'checkin_document', contentType: 'image/jpeg', matchId: 1 } as never;

function match(overrides: Record<string, unknown> = {}) {
  return { match_id: 1, team_a_id: 11, team_b_id: 12, match_status: 'checkin_open', ...overrides } as never;
}

async function expectAppError(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  expect((err as AppError).code).toBe(code);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createPresignedUpload — checkin_document', () => {
  it('gives an upload URL to a player of the match while check-in is open', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.isUserInTeams).mockResolvedValue(true);

    const result = await uploadService.createPresignedUpload(checkinInput, 9001);

    expect(MatchRepo.isUserInTeams).toHaveBeenCalledWith(9001, [11, 12]);
    expect(result.uploadUrl).toBe('https://s3/signed');
    expect(result.objectKey).toMatch(/^checkin_document\/1\/.+\.jpg$/);
    expect(result.expiresIn).toBe(1200);
  });

  it('refuses a user who is not in either team with NOT_IN_APPROVED_ROSTER', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match());
    vi.mocked(MatchRepo.isUserInTeams).mockResolvedValue(false);

    await expectAppError(uploadService.createPresignedUpload(checkinInput, 9999), 403, 'NOT_IN_APPROVED_ROSTER');
  });

  it.each(['scheduled', 'in_progress', 'completed'])('refuses while the match is %s with CHECKIN_NOT_OPEN', async (status) => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(match({ match_status: status }));

    await expectAppError(uploadService.createPresignedUpload(checkinInput, 9001), 409, 'CHECKIN_NOT_OPEN');
    expect(MatchRepo.isUserInTeams).not.toHaveBeenCalled();
  });

  it('returns MATCH_NOT_FOUND for an unknown match', async () => {
    vi.mocked(MatchRepo.findMatchById).mockResolvedValue(null);

    await expectAppError(uploadService.createPresignedUpload(checkinInput, 9001), 404, 'MATCH_NOT_FOUND');
  });
});

describe('createPresignedUpload — soft_filter_document (unchanged: no roster rule)', () => {
  it('only requires the tournament to exist', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 20 } as never);

    const result = await uploadService.createPresignedUpload(
      { purpose: 'soft_filter_document', contentType: 'image/png', tournamentId: 20 } as never, 9001);

    expect(result.objectKey).toMatch(/^soft_filter_document\/20\/.+\.png$/);
  });
});
