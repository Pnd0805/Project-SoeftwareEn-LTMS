import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../repositories/team.repo.js', () => ({
  findById: vi.fn(),
}));

import { requireTeamLeader } from '../requireTeamLeader.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import { AppError } from '../../utils/AppError.js';
import type { TeamRow, UserRow } from '../../types/db.js';

const mockedFindById = vi.mocked(TeamRepo.findById);

function makeReq(params: Record<string, string>, user?: UserRow): Request {
  return { params, user } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

const baseTeam: TeamRow = {
  team_id: 10,
  name: 'Dream Team',
  sport_type_id: 1,
  leader_id: 5,
  readiness_status: 'Forming',
  official_status: 'Unofficial',
  created_at: new Date(),
  updated_at: null,
  last_competed_at: null,
  deleted_at: null,
  deleted_reason: null,
};

const leaderUser: UserRow = {
  user_id: 5,
  full_name: 'Leader User',
  email: 'leader@example.com',
  password_hash: 'hash',
  gender: 'male',
  birth_date: '1998-01-01',
  user_type: 'student',
  faculty_id: 1,
  department_id: 1,
  year: 4,
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
};

const nonLeaderUser: UserRow = { ...leaderUser, user_id: 99 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireTeamLeader middleware', () => {
  it('calls next with TEAM_NOT_FOUND when the team does not exist', async () => {
    const req = makeReq({ id: '10' }, leaderUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedFindById.mockResolvedValue(null);

    await requireTeamLeader(req, res, next);

    expect(mockedFindById).toHaveBeenCalledWith(10);
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(404);
    expect(err.code).toBe('TEAM_NOT_FOUND');
  });

  it('calls next with USER_NOT_FOUND when req.user is not set', async () => {
    const req = makeReq({ id: '10' }, undefined);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedFindById.mockResolvedValue(baseTeam);

    await requireTeamLeader(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(404);
    expect(err.code).toBe('USER_NOT_FOUND');
  });

  it('calls next with NOT_TEAM_LEADER when the user is not the leader of the team', async () => {
    const req = makeReq({ id: '10' }, nonLeaderUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedFindById.mockResolvedValue(baseTeam);

    await requireTeamLeader(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('NOT_TEAM_LEADER');
    expect(req.team).toBeUndefined();
  });

  it('attaches req.team and calls next() with no error when the user is the leader', async () => {
    const req = makeReq({ id: '10' }, leaderUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedFindById.mockResolvedValue(baseTeam);

    await requireTeamLeader(req, res, next);

    expect(req.team).toEqual(baseTeam);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('converts req.params.id to a number before querying the repo', async () => {
    const req = makeReq({ id: '10' }, leaderUser);
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    mockedFindById.mockResolvedValue(baseTeam);

    await requireTeamLeader(req, res, next);

    expect(mockedFindById).toHaveBeenCalledWith(10);
  });
});
