import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/follow.repo.js', () => ({
  follow: vi.fn(),
  unfollow: vi.fn(),
  isFollowing: vi.fn(() => Promise.resolve(false)),
  countFollowers: vi.fn(() => Promise.resolve(0)),
  countFollowing: vi.fn(() => Promise.resolve(0)),
  findFollowers: vi.fn(() => Promise.resolve([])),
  findFollowingUsers: vi.fn(() => Promise.resolve([])),
  findFollowingTeams: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../repositories/profile.repo.js', () => ({
  findCareer: vi.fn(() => Promise.resolve([])),
  countMvpVotesReceived: vi.fn(() => Promise.resolve(0)),
}));
vi.mock('../../repositories/team.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../utils/checkExist.js', () => ({ checkUser: vi.fn() }));

import * as Service from '../follow.service.js';
import * as FollowRepo from '../../repositories/follow.repo.js';
import * as ProfileRepo from '../../repositories/profile.repo.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import { checkUser } from '../../utils/checkExist.js';
import { AppError } from '../../utils/AppError.js';

async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as AppError);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkUser).mockResolvedValue({ user_id: 20 } as never);
  vi.mocked(TeamRepo.findById).mockResolvedValue({ team_id: 30, deleted_at: null } as never);
  vi.mocked(FollowRepo.countFollowers).mockResolvedValue(0);
  vi.mocked(FollowRepo.isFollowing).mockResolvedValue(false);
});

describe('follow / unfollow (มติ OD-24 ข้อ 1)', () => {
  it('follows a user and returns the new follower count', async () => {
    vi.mocked(FollowRepo.countFollowers).mockResolvedValue(3);
    await expect(Service.follow(10, { kind: 'user', id: 20 })).resolves.toEqual({ following: true, followerCount: 3 });
    expect(FollowRepo.follow).toHaveBeenCalledWith(10, { kind: 'user', id: 20 });
  });

  it('follows a team', async () => {
    await Service.follow(10, { kind: 'team', id: 30 });
    expect(FollowRepo.follow).toHaveBeenCalledWith(10, { kind: 'team', id: 30 });
  });

  it('400 CANNOT_FOLLOW_SELF', async () => {
    expect(await errOf(Service.follow(10, { kind: 'user', id: 10 }))).toMatchObject({ status: 400, code: 'CANNOT_FOLLOW_SELF' });
    expect(FollowRepo.follow).not.toHaveBeenCalled();
  });

  it('404 USER_NOT_FOUND for a user that does not exist', async () => {
    vi.mocked(checkUser).mockRejectedValue(new AppError(404, 'USER_NOT_FOUND', 'x'));
    expect(await errOf(Service.follow(10, { kind: 'user', id: 999 }))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' });
  });

  it('404 TEAM_NOT_FOUND for a missing or deleted team', async () => {
    vi.mocked(TeamRepo.findById).mockResolvedValueOnce(null);
    expect(await errOf(Service.follow(10, { kind: 'team', id: 999 }))).toMatchObject({ status: 404, code: 'TEAM_NOT_FOUND' });
    vi.mocked(TeamRepo.findById).mockResolvedValueOnce({ team_id: 30, deleted_at: new Date() } as never);
    expect(await errOf(Service.follow(10, { kind: 'team', id: 30 }))).toMatchObject({ status: 404, code: 'TEAM_NOT_FOUND' });
  });

  it('unfollow returns following false', async () => {
    await expect(Service.unfollow(10, { kind: 'team', id: 30 })).resolves.toEqual({ following: false, followerCount: 0 });
    expect(FollowRepo.unfollow).toHaveBeenCalledWith(10, { kind: 'team', id: 30 });
  });
});

describe('lists and counts', () => {
  it('getFollowers returns total, isFollowing of the viewer, items and pagination', async () => {
    vi.mocked(FollowRepo.countFollowers).mockResolvedValue(1);
    vi.mocked(FollowRepo.isFollowing).mockResolvedValue(true);
    vi.mocked(FollowRepo.findFollowers).mockResolvedValue([{ user_id: 10, full_name: 'ก', profile_image_key: null, followed_at: new Date(0) }]);

    const result = await Service.getFollowers({ kind: 'user', id: 20 }, 10, 1, 20, 0);

    expect(result).toEqual({
      total: 1, isFollowing: true,
      items: [{ id: 10, fullName: 'ก', avatarUrl: null, followedAt: new Date(0) }],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    });
  });

  it('getFollowers without a viewer → isFollowing false and never asks', async () => {
    const result = await Service.getFollowers({ kind: 'team', id: 30 }, undefined, 1, 20, 0);
    expect(result.isFollowing).toBe(false);
    expect(FollowRepo.isFollowing).not.toHaveBeenCalled();
  });

  it('getProfileCounts: viewing yourself is never "following"', async () => {
    vi.mocked(FollowRepo.countFollowers).mockResolvedValue(5);
    vi.mocked(FollowRepo.countFollowing).mockResolvedValue(2);
    await expect(Service.getProfileCounts(20, 20)).resolves.toEqual({ followerCount: 5, followingCount: 2, isFollowing: false });
    expect(FollowRepo.isFollowing).not.toHaveBeenCalled();
  });
});

describe('career (มติ OD-24 ข้อ 3)', () => {
  it('maps played / wins / losses and the champion flag', async () => {
    vi.mocked(ProfileRepo.findCareer).mockResolvedValue([
      { tournament_id: 1, tournament_name: 'Cup', sport_type_id: 2, tournament_status: 'completed', event_start_date: null,
        champion_team_id: 30, team_id: 30, team_name: 'A', played: 3, wins: 3 },
      { tournament_id: 2, tournament_name: 'League', sport_type_id: 2, tournament_status: 'public', event_start_date: null,
        champion_team_id: null, team_id: 31, team_name: 'B', played: 2, wins: 0 },
    ]);

    const { items } = await Service.getCareer(20);

    expect(items[0]).toEqual({ tournament: { id: 1, name: 'Cup', sportTypeId: 2, status: 'completed' }, team: { id: 30, name: 'A' },
      played: 3, wins: 3, losses: 0, champion: true });
    expect(items[1]).toMatchObject({ played: 2, wins: 0, losses: 2, champion: false });
  });

  it('404 for a user that does not exist', async () => {
    vi.mocked(checkUser).mockRejectedValue(new AppError(404, 'USER_NOT_FOUND', 'x'));
    expect(await errOf(Service.getCareer(999))).toMatchObject({ status: 404 });
  });
});
