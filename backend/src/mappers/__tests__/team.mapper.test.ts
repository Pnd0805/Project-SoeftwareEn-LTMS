import { describe, it, expect } from 'vitest';
import {
  toTeamRef,
  toCreateTeam,
  toMyTeam,
  toTeamDto,
  toJoinRequestDto,
  toMyJoinRequestDto,
  toTeamMemberDto,
  toCreateTeamInvitation,
  toGetAllInvitation,
  getTeamOfficialRequestDto,
  toOfficialMemberConflictDto,
} from '../team.mapper.js';
import type { TeamMemberWithUserRef, OfficialMemberConflict } from '../team.mapper.js';
import type { UserRefDto } from '../user.mapper.js';
import type { TeamRow, TeamInvitationRow, TeamAdminRequestRow } from '../../types/db.js';
import type { JoinRequestWithUser, JoinRequestWithTeam } from '../../repositories/joinRequest.repo.js';
import type { getInvitation } from '../../repositories/team.repo.js';

// ---------- fixtures ----------

function makeTeamRow(overrides: Partial<TeamRow> = {}): TeamRow {
  return {
    team_id: 10,
    name: 'Dream Team',
    sport_type_id: 1,
    leader_id: 5,
    readiness_status: 'Forming',
    official_status: 'Unofficial',
    visibility: 'private',
    created_at: new Date('2024-01-15T08:30:00.000Z'),
    updated_at: null,
    last_competed_at: null,
    deleted_at: null,
    deleted_reason: null,
    ...overrides,
  };
}

function makeInvitationRow(overrides: Partial<TeamInvitationRow> = {}): TeamInvitationRow {
  return {
    team_invitation_id: 1,
    team_id: 10,
    invited_user_id: 9,
    invited_by_user_id: 5,
    team_invitation_status: 'pending',
    created_at: new Date('2024-02-20T00:00:00.000Z'),
    expires_at: new Date('2024-03-01T00:00:00.000Z'),
    responded_at: null,
    ...overrides,
  };
}

function makeAdminRequestRow(overrides: Partial<TeamAdminRequestRow> = {}): TeamAdminRequestRow {
  return {
    team_admin_request_id: 1,
    team_id: 10,
    request_type: 'official_status',
    requested_by: 5,
    target_user_id: null,
    team_admin_request_status: 'pending',
    requested_at: new Date('2024-04-01T00:00:00.000Z'),
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    supporting_docs: null,
    ...overrides,
  };
}

function makeMemberRow(overrides: Partial<TeamMemberWithUserRef> = {}): TeamMemberWithUserRef {
  return {
    user_id: 5,
    full_name: 'สมชาย ใจดี',
    profile_image_key: 'avatars/5.png',
    joined_at: new Date('2024-02-01T09:00:00.000Z'),
    ...overrides,
  };
}

const LEADER: UserRefDto = { id: 5, fullName: 'Leader Name', avatarUrl: null };

function makeInvitationListRow(overrides: Partial<getInvitation> = {}): getInvitation {
  return {
    team_invitation_id: 1,
    user_id: 9,
    full_name: 'Invited User',
    profile_image_key: 'avatars/9.png',
    team_invitation_status: 'pending',
    created_at: new Date('2024-03-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeJoinRequestUserRow(overrides: Partial<JoinRequestWithUser> = {}): JoinRequestWithUser {
  return {
    team_join_request_id: 30,
    team_id: 10,
    user_id: 9,
    full_name: 'Applicant Name',
    profile_image_key: 'avatars/9.png',
    message: 'อยากเข้าร่วมทีมค่ะ',
    team_join_request_status: 'pending',
    reject_reason: null,
    created_at: new Date('2024-04-05T00:00:00.000Z'),
    responded_at: null,
    responded_by: null,
    ...overrides,
  };
}

function makeJoinRequestTeamRow(overrides: Partial<JoinRequestWithTeam> = {}): JoinRequestWithTeam {
  return {
    team_join_request_id: 30,
    team_id: 10,
    user_id: 9,
    team_name: 'Dream Team',
    sport_type_id: 1,
    message: 'อยากเข้าร่วมทีมค่ะ',
    team_join_request_status: 'pending',
    reject_reason: null,
    created_at: new Date('2024-04-05T00:00:00.000Z'),
    responded_at: null,
    responded_by: null,
    ...overrides,
  };
}

// ---------- toTeamRef ----------

describe('toTeamRef', () => {
  it('maps team_id, name and sport_type_id', () => {
    expect(toTeamRef(makeTeamRow())).toEqual({ id: 10, name: 'Dream Team', sportTypeId: 1 });
  });

  it('returns only id, name and sportTypeId when given a full TeamRow', () => {
    expect(Object.keys(toTeamRef(makeTeamRow())).sort()).toEqual(['id', 'name', 'sportTypeId']);
  });

  it('accepts a Pick of just the three columns', () => {
    expect(toTeamRef({ team_id: 1, name: 'A', sport_type_id: 2 })).toEqual({ id: 1, name: 'A', sportTypeId: 2 });
  });
});

// ---------- toCreateTeam ----------

describe('toCreateTeam', () => {
  it('maps a freshly created team row', () => {
    expect(toCreateTeam(makeTeamRow())).toEqual({
      id: 10,
      name: 'Dream Team',
      sportTypeId: 1,
      readinessStatus: 'Forming',
      leaderId: 5,
    });
  });

  it.each(['Forming', 'Ready'] as const)("passes readiness_status '%s' through", (status) => {
    expect(toCreateTeam(makeTeamRow({ readiness_status: status })).readinessStatus).toBe(status);
  });

  it('returns only the documented keys (no visibility, no officialStatus, no timestamps)', () => {
    expect(Object.keys(toCreateTeam(makeTeamRow())).sort()).toEqual(['id', 'leaderId', 'name', 'readinessStatus', 'sportTypeId']);
  });
});

// ---------- toMyTeam ----------

describe('toMyTeam', () => {
  it("marks the role 'leader' when the viewing user is the team leader", () => {
    expect(toMyTeam(makeTeamRow({ leader_id: 5 }), 4, 5).role).toBe('leader');
  });

  it("marks the role 'member' when the viewing user is not the leader", () => {
    expect(toMyTeam(makeTeamRow({ leader_id: 5 }), 4, 99).role).toBe('member');
  });

  it('keeps memberCount and userId in the right positions (guards against swapped arguments)', () => {
    const dto = toMyTeam(makeTeamRow({ leader_id: 5 }), 8, 5);

    expect(dto.memberCount).toBe(8);
    expect(dto.role).toBe('leader');
  });

  it.each(['Forming', 'Ready'] as const)("reports the real readiness status '%s' when the team is not deleted", (status) => {
    expect(toMyTeam(makeTeamRow({ readiness_status: status }), 4, 5).readinessStatus).toBe(status);
  });

  it.each(['Forming', 'Ready'] as const)("overrides readinessStatus to 'Inactive' when a '%s' team is soft-deleted", (status) => {
    const team = makeTeamRow({ readiness_status: status, deleted_at: new Date('2024-06-01T00:00:00.000Z') });

    expect(toMyTeam(team, 4, 5).readinessStatus).toBe('Inactive');
  });

  it("still reports role 'leader' for a soft-deleted team the user led", () => {
    const team = makeTeamRow({ leader_id: 5, deleted_at: new Date('2024-06-01T00:00:00.000Z') });

    expect(toMyTeam(team, 0, 5).role).toBe('leader');
  });

  it.each(['Unofficial', 'Official'] as const)("passes official_status '%s' through", (status) => {
    expect(toMyTeam(makeTeamRow({ official_status: status }), 4, 5).officialStatus).toBe(status);
  });

  it('passes memberCount through unchanged, including 0', () => {
    expect(toMyTeam(makeTeamRow(), 0, 5).memberCount).toBe(0);
    expect(toMyTeam(makeTeamRow(), 7, 5).memberCount).toBe(7);
  });

  it('does not expose visibility (MyTeam has no such field)', () => {
    expect(toMyTeam(makeTeamRow({ visibility: 'public' }), 4, 5)).not.toHaveProperty('visibility');
  });

  it('returns only the documented keys', () => {
    expect(Object.keys(toMyTeam(makeTeamRow(), 4, 5)).sort()).toEqual(
      ['id', 'memberCount', 'name', 'officialStatus', 'readinessStatus', 'role', 'sportTypeId'].sort(),
    );
  });

  it('does not mutate the input row', () => {
    const row = makeTeamRow();
    const snapshot = structuredClone(row);

    toMyTeam(row, 4, 5);

    expect(row).toEqual(snapshot);
  });
});

// ---------- toTeamDto ----------

describe('toTeamDto', () => {
  it('maps the full team DTO with leader, memberCount, visibility, maxMembers and ISO createdAt', () => {
    expect(toTeamDto(makeTeamRow({ visibility: 'public' }), 4, LEADER, 12)).toEqual({
      id: 10,
      name: 'Dream Team',
      sportTypeId: 1,
      readinessStatus: 'Forming',
      officialStatus: 'Unofficial',
      visibility: 'public',
      leader: LEADER,
      memberCount: 4,
      maxMembers: 12,
      createdAt: '2024-01-15T08:30:00.000Z',
    });
  });

  it.each(['private', 'public'] as const)("passes visibility '%s' through", (visibility) => {
    expect(toTeamDto(makeTeamRow({ visibility }), 4, LEADER).visibility).toBe(visibility);
  });

  it('defaults maxMembers to null when the argument is omitted', () => {
    expect(toTeamDto(makeTeamRow(), 4, LEADER).maxMembers).toBeNull();
  });

  it('passes an explicit maxMembers of null through (sport type with no cap)', () => {
    expect(toTeamDto(makeTeamRow(), 4, LEADER, null).maxMembers).toBeNull();
  });

  it('passes an explicit maxMembers through', () => {
    expect(toTeamDto(makeTeamRow(), 4, LEADER, 20).maxMembers).toBe(20);
  });

  it('passes the leader object through as given', () => {
    expect(toTeamDto(makeTeamRow(), 4, LEADER).leader).toBe(LEADER);
  });

  it.each(['Forming', 'Ready'] as const)("overrides readinessStatus to 'Inactive' when a '%s' team is soft-deleted", (status) => {
    const team = makeTeamRow({ readiness_status: status, deleted_at: new Date('2024-06-01T00:00:00.000Z') });

    expect(toTeamDto(team, 4, LEADER).readinessStatus).toBe('Inactive');
  });

  it.each(['Forming', 'Ready'] as const)("reports the real readiness status '%s' when the team is not deleted", (status) => {
    expect(toTeamDto(makeTeamRow({ readiness_status: status }), 4, LEADER).readinessStatus).toBe(status);
  });

  it.each(['Unofficial', 'Official'] as const)("passes official_status '%s' through", (status) => {
    expect(toTeamDto(makeTeamRow({ official_status: status }), 4, LEADER).officialStatus).toBe(status);
  });

  it('keeps millisecond precision in createdAt', () => {
    const team = makeTeamRow({ created_at: new Date('2024-01-15T08:30:00.123Z') });

    expect(toTeamDto(team, 4, LEADER).createdAt).toBe('2024-01-15T08:30:00.123Z');
  });

  it('accepts a Pick of only the columns it needs', () => {
    const dto = toTeamDto(
      {
        team_id: 1,
        name: 'Mini',
        sport_type_id: 2,
        readiness_status: 'Ready',
        official_status: 'Official',
        visibility: 'private',
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        deleted_at: null,
      },
      2,
      LEADER,
    );

    expect(dto.id).toBe(1);
    expect(dto.readinessStatus).toBe('Ready');
  });

  it('does not expose leader_id, deleted_at, deleted_reason or last_competed_at', () => {
    const team = makeTeamRow({
      deleted_at: new Date('2024-06-01T00:00:00.000Z'),
      deleted_reason: 'inactive_6_months',
      last_competed_at: new Date('2024-05-01T00:00:00.000Z'),
    });

    expect(Object.keys(toTeamDto(team, 4, LEADER)).sort()).toEqual(
      ['createdAt', 'id', 'leader', 'maxMembers', 'memberCount', 'name', 'officialStatus', 'readinessStatus', 'sportTypeId', 'visibility'].sort(),
    );
  });

  it('throws a RangeError when created_at is an invalid Date', () => {
    expect(() => toTeamDto(makeTeamRow({ created_at: new Date('nope') }), 4, LEADER)).toThrow(RangeError);
  });
});

// ---------- toJoinRequestDto ----------

describe('toJoinRequestDto', () => {
  it('maps the request row with a nested applicant user ref', () => {
    expect(toJoinRequestDto(makeJoinRequestUserRow())).toEqual({
      id: 30,
      user: { id: 9, fullName: 'Applicant Name', avatarUrl: 'avatars/9.png' },
      message: 'อยากเข้าร่วมทีมค่ะ',
      status: 'pending',
      createdAt: '2024-04-05T00:00:00.000Z',
    });
  });

  it('keeps message null when the applicant left no message', () => {
    expect(toJoinRequestDto(makeJoinRequestUserRow({ message: null })).message).toBeNull();
  });

  it('maps a null applicant avatar through as null', () => {
    expect(toJoinRequestDto(makeJoinRequestUserRow({ profile_image_key: null })).user.avatarUrl).toBeNull();
  });

  it.each(['pending', 'approved', 'rejected', 'cancelled'] as const)("passes status '%s' through", (status) => {
    expect(toJoinRequestDto(makeJoinRequestUserRow({ team_join_request_status: status })).status).toBe(status);
  });

  it('returns exactly id, user, message, status and createdAt', () => {
    expect(Object.keys(toJoinRequestDto(makeJoinRequestUserRow())).sort()).toEqual(
      ['createdAt', 'id', 'message', 'status', 'user'].sort(),
    );
  });

  it('throws a RangeError when created_at is an invalid Date', () => {
    expect(() => toJoinRequestDto(makeJoinRequestUserRow({ created_at: new Date('nope') }))).toThrow(RangeError);
  });

  it('does not leak team_id, reject_reason or responded_by from the underlying TeamJoinRequestRow', () => {
    const dto = toJoinRequestDto(
      makeJoinRequestUserRow({ reject_reason: 'team is full', responded_by: 2, team_id: 77 }),
    );
    const json = JSON.stringify(dto);

    expect(json).not.toContain('team is full');
    expect(dto).not.toHaveProperty('team_id');
    expect(dto).not.toHaveProperty('teamId');
    expect(dto).not.toHaveProperty('responded_by');
    expect(dto).not.toHaveProperty('respondedBy');
  });
});

// ---------- toMyJoinRequestDto ----------

describe('toMyJoinRequestDto', () => {
  it('maps the request row with a nested team ref', () => {
    expect(toMyJoinRequestDto(makeJoinRequestTeamRow())).toEqual({
      id: 30,
      team: { id: 10, name: 'Dream Team', sportTypeId: 1 },
      message: 'อยากเข้าร่วมทีมค่ะ',
      status: 'pending',
      rejectReason: null,
      createdAt: '2024-04-05T00:00:00.000Z',
      respondedAt: null,
    });
  });

  it('keeps rejectReason null when the request has not been rejected', () => {
    expect(toMyJoinRequestDto(makeJoinRequestTeamRow({ reject_reason: null })).rejectReason).toBeNull();
  });

  it('passes a rejectReason through for a rejected request', () => {
    const dto = toMyJoinRequestDto(
      makeJoinRequestTeamRow({ team_join_request_status: 'rejected', reject_reason: 'team is full' }),
    );

    expect(dto.status).toBe('rejected');
    expect(dto.rejectReason).toBe('team is full');
  });

  it('keeps respondedAt null while the request is still pending', () => {
    expect(toMyJoinRequestDto(makeJoinRequestTeamRow({ responded_at: null })).respondedAt).toBeNull();
  });

  it('formats respondedAt as an ISO string once the request has been answered', () => {
    const dto = toMyJoinRequestDto(
      makeJoinRequestTeamRow({
        team_join_request_status: 'approved',
        responded_at: new Date('2024-04-06T10:00:00.000Z'),
      }),
    );

    expect(dto.respondedAt).toBe('2024-04-06T10:00:00.000Z');
  });

  it.each(['pending', 'approved', 'rejected', 'cancelled'] as const)("passes status '%s' through", (status) => {
    expect(toMyJoinRequestDto(makeJoinRequestTeamRow({ team_join_request_status: status })).status).toBe(status);
  });

  it('returns exactly id, team, message, status, rejectReason, createdAt and respondedAt', () => {
    expect(Object.keys(toMyJoinRequestDto(makeJoinRequestTeamRow())).sort()).toEqual(
      ['createdAt', 'id', 'message', 'rejectReason', 'respondedAt', 'status', 'team'].sort(),
    );
  });

  it('throws a RangeError when created_at is an invalid Date', () => {
    expect(() => toMyJoinRequestDto(makeJoinRequestTeamRow({ created_at: new Date('nope') }))).toThrow(RangeError);
  });

  it('throws a RangeError when responded_at is an invalid Date', () => {
    expect(() => toMyJoinRequestDto(makeJoinRequestTeamRow({ responded_at: new Date('nope') }))).toThrow(RangeError);
  });

  it('does not leak user_id or responded_by from the underlying TeamJoinRequestRow', () => {
    const dto = toMyJoinRequestDto(makeJoinRequestTeamRow({ user_id: 9, responded_by: 2 }));

    expect(dto).not.toHaveProperty('user_id');
    expect(dto).not.toHaveProperty('userId');
    expect(dto).not.toHaveProperty('responded_by');
    expect(dto).not.toHaveProperty('respondedBy');
  });
});

// ---------- toTeamMemberDto ----------

describe('toTeamMemberDto', () => {
  it('maps user fields, with joinedAt as an ISO string', () => {
    expect(toTeamMemberDto(makeMemberRow())).toEqual({
      userId: 5,
      fullName: 'สมชาย ใจดี',
      avatarUrl: 'avatars/5.png',
      joinedAt: '2024-02-01T09:00:00.000Z',
    });
  });

  it('passes profile_image_key through as avatarUrl without transforming it (a key, not a URL)', () => {
    expect(toTeamMemberDto(makeMemberRow({ profile_image_key: 'avatars/raw-key-123.png' })).avatarUrl).toBe(
      'avatars/raw-key-123.png',
    );
  });

  it('maps a null avatar through as null', () => {
    expect(toTeamMemberDto(makeMemberRow({ profile_image_key: null })).avatarUrl).toBeNull();
  });

  it('does not expose a position field (removed from TeamMemberRow)', () => {
    expect(toTeamMemberDto(makeMemberRow())).not.toHaveProperty('position');
  });

  it('returns only the documented keys', () => {
    expect(Object.keys(toTeamMemberDto(makeMemberRow())).sort()).toEqual(['avatarUrl', 'fullName', 'joinedAt', 'userId']);
  });

  it('throws a RangeError when joined_at is an invalid Date', () => {
    expect(() => toTeamMemberDto(makeMemberRow({ joined_at: new Date('nope') }))).toThrow(RangeError);
  });
});

// ---------- toCreateTeamInvitation ----------

describe('toCreateTeamInvitation', () => {
  it('maps the invitation row with status and ISO expiresAt', () => {
    expect(toCreateTeamInvitation(makeInvitationRow())).toEqual({
      id: 1,
      invitedUserId: 9,
      status: 'pending',
      expiresAt: '2024-03-01T00:00:00.000Z',
    });
  });

  it.each(['pending', 'accepted', 'rejected', 'expired'] as const)("passes status '%s' through", (status) => {
    expect(toCreateTeamInvitation(makeInvitationRow({ team_invitation_status: status })).status).toBe(status);
  });

  it('does not expose inviter, team or response details', () => {
    const row = makeInvitationRow({ responded_at: new Date('2024-02-25T00:00:00.000Z') });

    expect(Object.keys(toCreateTeamInvitation(row)).sort()).toEqual(['expiresAt', 'id', 'invitedUserId', 'status']);
  });

  it('throws a RangeError when expires_at is an invalid Date', () => {
    expect(() => toCreateTeamInvitation(makeInvitationRow({ expires_at: new Date('nope') }))).toThrow(RangeError);
  });
});

// ---------- toGetAllInvitation ----------

describe('toGetAllInvitation', () => {
  it('maps the invitation row with a nested invited-user ref', () => {
    expect(toGetAllInvitation(makeInvitationListRow())).toEqual({
      id: 1,
      invitedUser: { id: 9, fullName: 'Invited User', avatarUrl: 'avatars/9.png' },
      status: 'pending',
      createdAt: '2024-03-01T00:00:00.000Z',
    });
  });

  it('maps a null invited-user avatar through as null', () => {
    expect(toGetAllInvitation(makeInvitationListRow({ profile_image_key: null })).invitedUser.avatarUrl).toBeNull();
  });

  it.each(['pending', 'accepted', 'rejected', 'expired'] as const)("passes status '%s' through", (status) => {
    expect(toGetAllInvitation(makeInvitationListRow({ team_invitation_status: status })).status).toBe(status);
  });

  it('returns only id, invitedUser, status and createdAt', () => {
    expect(Object.keys(toGetAllInvitation(makeInvitationListRow())).sort()).toEqual(['createdAt', 'id', 'invitedUser', 'status']);
  });

  it('throws a RangeError when created_at is an invalid Date', () => {
    expect(() => toGetAllInvitation(makeInvitationListRow({ created_at: new Date('nope') }))).toThrow(RangeError);
  });
});

// ---------- getTeamOfficialRequestDto ----------

describe('getTeamOfficialRequestDto', () => {
  it('maps team_admin_request_id and status', () => {
    expect(getTeamOfficialRequestDto(makeAdminRequestRow())).toEqual({ id: 1, status: 'pending' });
  });

  it.each(['pending', 'approved', 'rejected'] as const)("preserves status '%s'", (status) => {
    expect(getTeamOfficialRequestDto(makeAdminRequestRow({ team_admin_request_status: status })).status).toBe(status);
  });

  it('does not leak the rejection reason or supporting documents', () => {
    const row = makeAdminRequestRow({
      team_admin_request_status: 'rejected',
      rejection_reason: 'documents unclear',
      supporting_docs: ['docs/a.pdf'],
      reviewed_by: 2,
      reviewed_at: new Date('2024-04-02T00:00:00.000Z'),
    });
    const dto = getTeamOfficialRequestDto(row);

    expect(Object.keys(dto).sort()).toEqual(['id', 'status']);
    expect(JSON.stringify(dto)).not.toContain('documents unclear');
    expect(JSON.stringify(dto)).not.toContain('docs/a.pdf');
  });
});

// ---------- toOfficialMemberConflictDto ----------

describe('toOfficialMemberConflictDto', () => {
  it('maps user_id, full_name and conflictingTeamName', () => {
    const row: OfficialMemberConflict = { user_id: 5, full_name: 'สมชาย ใจดี', conflictingTeamName: 'Rival Team' };

    expect(toOfficialMemberConflictDto(row)).toEqual({
      userId: 5,
      fullName: 'สมชาย ใจดี',
      conflictingTeamName: 'Rival Team',
    });
  });

  it('returns only userId, fullName and conflictingTeamName', () => {
    const row: OfficialMemberConflict = { user_id: 1, full_name: 'X', conflictingTeamName: 'Y' };

    expect(Object.keys(toOfficialMemberConflictDto(row)).sort()).toEqual(['conflictingTeamName', 'fullName', 'userId']);
  });
});
