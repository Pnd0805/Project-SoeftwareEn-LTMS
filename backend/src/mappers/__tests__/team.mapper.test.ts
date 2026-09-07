import { describe, it, expect } from 'vitest';
import { toTeamRef, toCreateTeam, toMyTeam, toTeamDto } from '../team.mapper.js';

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
