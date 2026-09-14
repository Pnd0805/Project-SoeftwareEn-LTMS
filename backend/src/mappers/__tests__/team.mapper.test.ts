import { describe, it, expect } from 'vitest';
import {
  toTeamRef,
  toCreateTeam,
  toMyTeam,
  toTeamDto,
  toTeamMemberDto,
  toUpdateMember,
  toCreateTeamInvitation,
  toGetAllInvitation,
  getTeamOfficialRequestDto,
  toOfficialMemberConflictDto,
} from '../team.mapper.js';

const baseTeamRow = {
  team_id: 10,
  name: 'Dream Team',
  sport_type_id: 1,
  leader_id: 5,
  readiness_status: 'Forming' as const,
  official_status: 'Unofficial' as const,
  created_at: new Date('2024-01-15T08:30:00Z'),
  updated_at: null,
  last_competed_at: null,
  deleted_at: null as Date | null,
  deleted_reason: null,
};

describe('toTeamRef', () => {
  it('maps team_id, name, and sport_type_id', () => {
    expect(toTeamRef(baseTeamRow as any)).toEqual({
      id: 10,
      name: 'Dream Team',
      sportTypeId: 1,
    });
  });
});

describe('toCreateTeam', () => {
  it('maps a freshly created team row, including leaderId and readinessStatus verbatim', () => {
    expect(toCreateTeam(baseTeamRow as any)).toEqual({
      id: 10,
      name: 'Dream Team',
      sportTypeId: 1,
      readinessStatus: 'Forming',
      leaderId: 5,
    });
  });
});

describe('toMyTeam', () => {
  it('marks the role as "leader" when the viewing user is the team leader', () => {
    const result = toMyTeam(baseTeamRow as any, 4, 5); // userId 5 === leader_id 5
    expect(result.role).toBe('leader');
  });

  it('marks the role as "member" when the viewing user is not the leader', () => {
    const result = toMyTeam(baseTeamRow as any, 4, 99); // userId 99 !== leader_id 5
    expect(result.role).toBe('member');
  });

  it('reports the real readiness status when the team is not deleted', () => {
    const result = toMyTeam({ ...baseTeamRow, readiness_status: 'Ready' } as any, 4, 5);
    expect(result.readinessStatus).toBe('Ready');
  });

  it('overrides readinessStatus to "Inactive" when the team is soft-deleted', () => {
    const deletedTeam = { ...baseTeamRow, deleted_at: new Date('2024-06-01T00:00:00Z') };
    const result = toMyTeam(deletedTeam as any, 4, 5);
    expect(result.readinessStatus).toBe('Inactive');
  });

  it('passes memberCount through unchanged', () => {
    const result = toMyTeam(baseTeamRow as any, 7, 5);
    expect(result.memberCount).toBe(7);
  });
});

describe('toTeamDto', () => {
  const leaderRef = { id: 5, fullName: 'Leader Name', avatarUrl: null };

  it('maps a full team DTO including leader, memberCount, and ISO createdAt', () => {
    const result = toTeamDto(baseTeamRow as any, 4, leaderRef as any);

    expect(result).toEqual({
      id: 10,
      name: 'Dream Team',
      sportTypeId: 1,
      readinessStatus: 'Forming',
      officialStatus: 'Unofficial',
      leader: leaderRef,
      memberCount: 4,
      createdAt: '2024-01-15T08:30:00.000Z',
    });
  });

  it('overrides readinessStatus to "Inactive" when the team is soft-deleted', () => {
    const deletedTeam = { ...baseTeamRow, deleted_at: new Date('2024-06-01T00:00:00Z') };
    const result = toTeamDto(deletedTeam as any, 4, leaderRef as any);
    expect(result.readinessStatus).toBe('Inactive');
  });

  it('reports the real readiness status when the team is not deleted', () => {
    const readyTeam = { ...baseTeamRow, readiness_status: 'Ready' as const };
    const result = toTeamDto(readyTeam as any, 4, leaderRef as any);
    expect(result.readinessStatus).toBe('Ready');
  });
});

describe('toTeamMemberDto', () => {
  it('maps user fields and position, converting joined_at to an ISO string', () => {
    const row = {
      user_id: 5,
      full_name: 'สมชาย ใจดี',
      profile_image_key: 'avatar.png',
      position: 'starter' as const,
      joined_at: new Date('2024-02-01T09:00:00Z'),
    };

    expect(toTeamMemberDto(row as any)).toEqual({
      userId: 5,
      fullName: 'สมชาย ใจดี',
      avatarUrl: 'avatar.png',
      position: 'starter',
      joinedAt: '2024-02-01T09:00:00.000Z',
    });
  });

  it('maps a null avatar through as null', () => {
    const row = {
      user_id: 5,
      full_name: 'สมชาย ใจดี',
      profile_image_key: null,
      position: 'substitute' as const,
      joined_at: new Date('2024-02-01T09:00:00Z'),
    };

    expect(toTeamMemberDto(row as any).avatarUrl).toBeNull();
  });
});

describe('toUpdateMember', () => {
  it('maps user_id and position into a shorthand DTO', () => {
    const row = { user_id: 7, position: 'starter' as const };
    expect(toUpdateMember(row)).toEqual({ userId: 7, position: 'starter' });
  });

  it('preserves the "substitute" position value', () => {
    const row = { user_id: 7, position: 'substitute' as const };
    expect(toUpdateMember(row).position).toBe('substitute');
  });
});

describe('toCreateTeamInvitation', () => {
  it('maps the invitation row including status and ISO expiresAt', () => {
    const row = {
      team_invitation_id: 1,
      invited_user_id: 9,
      team_invitation_status: 'pending' as const,
      expires_at: new Date('2024-03-01T00:00:00Z'),
    };

    expect(toCreateTeamInvitation(row as any)).toEqual({
      id: 1,
      invitedUserId: 9,
      status: 'pending',
      expiresAt: '2024-03-01T00:00:00.000Z',
    });
  });

  it('preserves a non-pending status value (e.g. "accepted")', () => {
    const row = {
      team_invitation_id: 1,
      invited_user_id: 9,
      team_invitation_status: 'accepted' as const,
      expires_at: new Date('2024-03-01T00:00:00Z'),
    };

    expect(toCreateTeamInvitation(row as any).status).toBe('accepted');
  });
});

describe('toGetAllInvitation', () => {
  it('maps the invitation row plus a nested invited-user ref', () => {
    const row = {
      team_invitation_id: 1,
      user_id: 9,
      full_name: 'Invited User',
      profile_image_key: 'avatar.png',
      team_invitation_status: 'pending' as const,
      created_at: new Date('2024-03-01T00:00:00Z'),
    };

    expect(toGetAllInvitation(row as any)).toEqual({
      id: 1,
      invitedUser: { id: 9, fullName: 'Invited User', avatarUrl: 'avatar.png' },
      status: 'pending',
      createdAt: '2024-03-01T00:00:00.000Z',
    });
  });

  it('maps a null invited-user avatar through as null', () => {
    const row = {
      team_invitation_id: 1,
      user_id: 9,
      full_name: 'Invited User',
      profile_image_key: null,
      team_invitation_status: 'pending' as const,
      created_at: new Date('2024-03-01T00:00:00Z'),
    };

    expect(toGetAllInvitation(row as any).invitedUser.avatarUrl).toBeNull();
  });
});

describe('getTeamOfficialRequestDto', () => {
  it('maps team_admin_request_id and status', () => {
    const row = { team_admin_request_id: 1, team_admin_request_status: 'pending' as const };
    expect(getTeamOfficialRequestDto(row as any)).toEqual({ id: 1, status: 'pending' });
  });

  it.each(['pending', 'approved', 'rejected'])('preserves the "%s" status value', (status) => {
    const row = { team_admin_request_id: 1, team_admin_request_status: status as any };
    expect(getTeamOfficialRequestDto(row as any).status).toBe(status);
  });
});

describe('toOfficialMemberConflictDto', () => {
  it('maps user_id, full_name, and the pre-joined conflictingTeamName through unchanged', () => {
    const row = {
      user_id: 5,
      full_name: 'สมชาย ใจดี',
      conflictingTeamName: 'Rival Team',
    };

    expect(toOfficialMemberConflictDto(row as any)).toEqual({
      userId: 5,
      fullName: 'สมชาย ใจดี',
      conflictingTeamName: 'Rival Team',
    });
  });
});
