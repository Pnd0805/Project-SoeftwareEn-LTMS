import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../utils/parseId.js', () => ({
  parseId: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(),
}));

vi.mock('../../repositories/match.repo.js', () => ({
  findById: vi.fn(),
}));

import { requireOrganizer, requireOrganizerOfMatch } from '../requireOrganizer.js';
import { parseId } from '../../utils/parseId.js';
import { findTournamentById } from '../../repositories/tournament.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import { AppError } from '../../utils/AppError.js';
import type { TournamentRow, MatchRow, UserRow } from '../../types/db.js';

const mockedParseId = vi.mocked(parseId);
const mockedFindTournamentById = vi.mocked(findTournamentById);
const mockedFindMatchById = vi.mocked(MatchRepo.findById);

function makeReq(params: Record<string, string>, user?: UserRow): Request {
  return { params, user } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    user_id: 1,
    full_name: 'Test User',
    email: 'test@example.com',
    password_hash: 'hashed-password',
    gender: 'other',
    birth_date: '2000-01-01',
    user_type: 'student',
    faculty_id: null,
    department_id: null,
    year: null,
    profile_image_key: null,
    contact_info: null,
    address: null,
    is_suspended: 0,
    suspended_reason: null,
    total_points: 0,
    notification_prefs: null,
    profile_edit_log: null,
    created_at: new Date(),
    updated_at: null,
    ...overrides,
  };
}

const organizerUser = makeUser({ user_id: 5 });
const otherUser = makeUser({ user_id: 99 });

// NOTE: tournament_status is 'pending_approval' | 'rejected' | 'private' |
// 'public' | 'completed' | 'auto_deleted' — 'public' is the valid "open for
// business" baseline status here (there is no 'approved' value).
const baseTournament: TournamentRow = {
  tournament_id: 20,
  name: 'Inter-Faculty Championship',
  sport_type_id: 1,
  bracket_format: 'single_elimination',
  scope_type: 'university',
  organizing_faculty_id: null,
  organizing_department_id: null,
  requested_by_user_id: 5,
  organizer_external_approval_status: 'not_required',
  organizer_external_reviewed_by: null,
  organizer_external_reviewed_at: null,
  organizer_external_rejection_reason: null,
  organizer_external_verification_docs: null,
  tournament_status: 'public',
  registration_open: 1,
  registration_start: null,
  registration_end: null,
  event_start_date: '2026-10-01',
  event_end_date: null,
  max_teams: 16,
  min_teams: 4,
  venue: null,
  dispute_window_hours: 24,
  gender_requirement: 'any',
  min_age: null,
  max_age: null,
  rejection_reason: null,
  approved_by: null,
  approved_at: null,
  created_at: new Date(),
  updated_at: null,
  updated_by: null,
  deleted_at: null,
  deleted_by: null,
};

const baseMatch: MatchRow = {
  match_id: 30,
  tournament_id: 20,
  bracket_node_id: null,
  next_match_id: null,
  loser_next_match_id: null,
  round_number: 1,
  team_a_id: null,
  team_b_id: null,
  scheduled_time: null,
  venue: null,
  checkin_open_at: null,
  match_status: 'scheduled',
  mode: 'onsite',
  created_at: new Date(),
  updated_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireOrganizer middleware', () => {
  it('calls next with NO_TOKEN when req.user is missing', async () => {
    const req = makeReq({ id: '20' }, undefined);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireOrganizer(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('NO_TOKEN');
    expect(mockedParseId).not.toHaveBeenCalled();
  });

  it('parses the tournament id from req.params using the Thai label', async () => {
    const req = makeReq({ id: '20' }, organizerUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedParseId.mockReturnValue(20 as any);
    mockedFindTournamentById.mockResolvedValue(baseTournament);

    await requireOrganizer(req, res, next);

    expect(mockedParseId).toHaveBeenCalledWith('20', 'รหัสทัวร์นาเมนต์');
    expect(mockedFindTournamentById).toHaveBeenCalledWith(20);
  });

  it('calls next with TOURNAMENT_NOT_FOUND when the tournament does not exist', async () => {
    const req = makeReq({ id: '20' }, organizerUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedParseId.mockReturnValue(20 as any);
    mockedFindTournamentById.mockResolvedValue(null);

    await requireOrganizer(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(404);
    expect(err.code).toBe('TOURNAMENT_NOT_FOUND');
  });

  it('calls next with NOT_ORGANIZER when the user did not request the tournament', async () => {
    const req = makeReq({ id: '20' }, otherUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedParseId.mockReturnValue(20 as any);
    mockedFindTournamentById.mockResolvedValue(baseTournament);

    await requireOrganizer(req, res, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('NOT_ORGANIZER');
    expect((req as any).tournament).toBeUndefined();
  });

  it.each(['pending_approval', 'rejected'] as const)(
    'calls next with NOT_ORGANIZER when the tournament status is %s, even for the owner',
    async (status) => {
      const req = makeReq({ id: '20' }, organizerUser);
      const res = makeRes();
      const next = vi.fn() as NextFunction;
      mockedParseId.mockReturnValue(20 as any);
      mockedFindTournamentById.mockResolvedValue({
        ...baseTournament,
        tournament_status: status,
      });

      await requireOrganizer(req, res, next);

      const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
      expect(err.status).toBe(403);
      expect(err.code).toBe('NOT_ORGANIZER');
    },
  );

  it.each(['private', 'public', 'completed', 'auto_deleted'] as const)(
    'attaches req.tournament and calls next() for the owning organizer when status is %s',
    async (status) => {
      const req = makeReq({ id: '20' }, organizerUser);
      const res = makeRes();
      const next = vi.fn() as NextFunction;
      mockedParseId.mockReturnValue(20 as any);
      mockedFindTournamentById.mockResolvedValue({
        ...baseTournament,
        tournament_status: status,
      });

      await requireOrganizer(req, res, next);

      expect((req as any).tournament).toEqual({ ...baseTournament, tournament_status: status });
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    },
  );

  it('rejects (does not call next) when parseId throws for a malformed id', async () => {
    const req = makeReq({ id: 'not-a-number' }, organizerUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    const parseError = new AppError(400, 'INVALID_ID', 'รหัสทัวร์นาเมนต์ไม่ถูกต้อง');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(requireOrganizer(req, res, next)).rejects.toBe(parseError);
    expect(next).not.toHaveBeenCalled();
    expect(mockedFindTournamentById).not.toHaveBeenCalled();
  });
});

describe('requireOrganizerOfMatch middleware', () => {
  it('calls next with NO_TOKEN when req.user is missing', async () => {
    const req = makeReq({ id: '30' }, undefined);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    await requireOrganizerOfMatch(req, res, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(401);
    expect(err.code).toBe('NO_TOKEN');
    expect(mockedParseId).not.toHaveBeenCalled();
  });

  it('parses the match id using the Thai label and looks up the match', async () => {
    const req = makeReq({ id: '30' }, organizerUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedParseId.mockReturnValue(30 as any);
    mockedFindMatchById.mockResolvedValue(baseMatch);
    mockedFindTournamentById.mockResolvedValue(baseTournament);

    await requireOrganizerOfMatch(req, res, next);

    expect(mockedParseId).toHaveBeenCalledWith('30', 'รหัสแมตช์');
    expect(mockedFindMatchById).toHaveBeenCalledWith(30);
  });

  it('calls next with MATCH_NOT_FOUND when the match does not exist', async () => {
    const req = makeReq({ id: '30' }, organizerUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedParseId.mockReturnValue(30 as any);
    mockedFindMatchById.mockResolvedValue(null);

    await requireOrganizerOfMatch(req, res, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(404);
    expect(err.code).toBe('MATCH_NOT_FOUND');
    expect(mockedFindTournamentById).not.toHaveBeenCalled();
  });

  it('calls next with TOURNAMENT_NOT_FOUND when the match exists but its tournament does not', async () => {
    const req = makeReq({ id: '30' }, organizerUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedParseId.mockReturnValue(30 as any);
    mockedFindMatchById.mockResolvedValue(baseMatch);
    mockedFindTournamentById.mockResolvedValue(null);

    await requireOrganizerOfMatch(req, res, next);

    expect(mockedFindTournamentById).toHaveBeenCalledWith(20);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(404);
    expect(err.code).toBe('TOURNAMENT_NOT_FOUND');
  });

  it('calls next with NOT_ORGANIZER when the user is not the tournament organizer', async () => {
    const req = makeReq({ id: '30' }, otherUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedParseId.mockReturnValue(30 as any);
    mockedFindMatchById.mockResolvedValue(baseMatch);
    mockedFindTournamentById.mockResolvedValue(baseTournament);

    await requireOrganizerOfMatch(req, res, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('NOT_ORGANIZER');
    expect((req as any).match).toBeUndefined();
    expect((req as any).tournament).toBeUndefined();
  });

  it('attaches req.match and req.tournament and calls next() for the owning organizer', async () => {
    const req = makeReq({ id: '30' }, organizerUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedParseId.mockReturnValue(30 as any);
    mockedFindMatchById.mockResolvedValue(baseMatch);
    mockedFindTournamentById.mockResolvedValue(baseTournament);

    await requireOrganizerOfMatch(req, res, next);

    expect((req as any).match).toEqual(baseMatch);
    expect((req as any).tournament).toEqual(baseTournament);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects (does not call next) when parseId throws for a malformed id', async () => {
    const req = makeReq({ id: 'not-a-number' }, organizerUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    const parseError = new AppError(400, 'INVALID_ID', 'รหัสแมตช์ไม่ถูกต้อง');
    mockedParseId.mockImplementation(() => {
      throw parseError;
    });

    await expect(requireOrganizerOfMatch(req, res, next)).rejects.toBe(parseError);
    expect(next).not.toHaveBeenCalled();
    expect(mockedFindMatchById).not.toHaveBeenCalled();
  });
});
