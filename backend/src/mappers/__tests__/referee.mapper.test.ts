import { describe, it, expect } from 'vitest';
import {
  toRefereeStatus,
  toTournamentRefereeDto,
  toInvitedMatchDto,
  toMyRefereeInvitationDto,
  toMyRefereeMatchDto,
  toMatchRefereeDto,
} from '../referee.mapper.js';
import type { RefereeStatus, RefereeStatusFields } from '../referee.mapper.js';
import type { InvitedMatchRow, MatchRefereeListRow, MyRefereeMatchRow } from '../../repositories/matchReferee.repo.js';

// ---------- fixtures ----------

// Types for these two live in tournamentReferee.repo.ts, which is not part of these tests' inputs,
// so their fixtures hold the fields the mapper reads and are cast. Paste that repo file to replace
// the casts with fully typed fixtures.
type RefereeListRowLike = Parameters<typeof toTournamentRefereeDto>[0];
type MyInvitationRowLike = Parameters<typeof toMyRefereeInvitationDto>[0];

function makeRefereeRow(overrides: Record<string, unknown> = {}): RefereeListRowLike {
  return {
    tournament_referee_id: 1,
    user_id: 5,
    full_name: 'กรรมการ A',
    profile_image_key: 'avatars/5.png',
    invitation_status: 'accepted',
    is_external: 0,
    external_approval_status: 'not_required',
    removed_at: null,
    ...overrides,
  } as RefereeListRowLike;
}

function makeInvitationRow(overrides: Record<string, unknown> = {}): MyInvitationRowLike {
  return {
    tournament_referee_id: 1,
    tournament_id: 3,
    name: 'Summer Cup',
    sport_type_id: 2,
    event_start_date: '2024-06-01',
    is_external: 1,
    created_at: new Date('2024-05-01T10:00:00.000Z'),
    ...overrides,
  } as MyInvitationRowLike;
}

function makeInvitedMatch(overrides: Partial<InvitedMatchRow> = {}): InvitedMatchRow {
  return {
    match_referee_id: 11,
    tournament_referee_id: 1,
    assignment_status: 'pending',
    match_id: 4,
    round_number: 1,
    scheduled_time: new Date('2024-06-01T03:00:00.000Z'),
    scheduled_end_time: new Date('2024-06-01T04:00:00.000Z'),
    venue: 'Hall A',
    mode: 'onsite',
    match_status: 'scheduled',
    ...overrides,
  };
}

function makeStatusFields(overrides: Partial<RefereeStatusFields> = {}): RefereeStatusFields {
  return {
    invitation_status: 'accepted',
    is_external: 0,
    external_approval_status: 'not_required',
    removed_at: null,
    ...overrides,
  };
}

function makeMatchRefereeRow(overrides: Partial<MatchRefereeListRow> = {}): MatchRefereeListRow {
  return {
    match_referee_id: 11,
    tournament_referee_id: 1,
    assignment_status: 'accepted',
    invitation_status: 'accepted',
    is_external: 0,
    external_approval_status: 'not_required',
    removed_at: null,
    user_id: 5,
    full_name: 'กรรมการ A',
    profile_image_key: 'avatars/5.png',
    ...overrides,
  };
}

const MY_MATCH_START = new Date('2024-06-01T03:00:00.000Z');
const MY_MATCH_END = new Date('2024-06-01T04:00:00.000Z');

function makeMyRefereeMatchRow(overrides: Partial<MyRefereeMatchRow> = {}): MyRefereeMatchRow {
  return {
    match_referee_id: 21,
    tournament_referee_id: 1,
    invitation_status: 'accepted',
    is_external: 0,
    external_approval_status: 'not_required',
    removed_at: null,
    match_id: 4,
    round_number: 1,
    scheduled_time: MY_MATCH_START,
    scheduled_end_time: MY_MATCH_END,
    venue: 'Hall A',
    mode: 'onsite',
    match_status: 'scheduled',
    tournament_id: 3,
    tournament_name: 'Summer Cup',
    sport_type_id: 2,
    team_a_id: 11,
    team_a_name: 'Lions',
    team_b_id: 12,
    team_b_name: 'Tigers',
    ...overrides,
  };
}

const REMOVED = new Date('2024-06-10T00:00:00.000Z');

// ---------- toRefereeStatus ----------

describe('toRefereeStatus', () => {
  const cases: Array<[string, Partial<RefereeStatusFields>, RefereeStatus]> = [
    ['internal, accepted', {}, 'active'],
    ['internal, invitation pending', { invitation_status: 'pending' }, 'pending'],
    ['internal, invitation rejected', { invitation_status: 'rejected' }, 'declined'],
    ['external, accepted, approval pending', { is_external: 1, external_approval_status: 'pending' }, 'pending_admin'],
    ['external, accepted, approval needs_docs', { is_external: 1, external_approval_status: 'needs_docs' }, 'pending_admin'],
    ['external, accepted, approval rejected', { is_external: 1, external_approval_status: 'rejected' }, 'rejected_by_admin'],
    ['external, accepted, approval approved', { is_external: 1, external_approval_status: 'approved' }, 'active'],
    ['external, accepted, approval not_required', { is_external: 1, external_approval_status: 'not_required' }, 'active'],
    [
      'external, invitation pending, approval rejected',
      { invitation_status: 'pending', is_external: 1, external_approval_status: 'rejected' },
      'pending',
    ],
    [
      'external, invitation rejected, approval pending',
      { invitation_status: 'rejected', is_external: 1, external_approval_status: 'pending' },
      'declined',
    ],
    ['internal, accepted, stray approval status rejected', { is_external: 0, external_approval_status: 'rejected' }, 'active'],
    ['internal, accepted, stray approval status pending', { is_external: 0, external_approval_status: 'pending' }, 'active'],
  ];

  it.each(cases)('%s -> %s', (_label, overrides, expected) => {
    expect(toRefereeStatus(makeStatusFields(overrides))).toBe(expected);
  });

  describe('removal takes precedence over everything', () => {
    it.each([
      ['active internal', {}],
      ['pending invitation', { invitation_status: 'pending' as const }],
      ['declined invitation', { invitation_status: 'rejected' as const }],
      ['external awaiting admin', { is_external: 1, external_approval_status: 'pending' as const }],
      ['external rejected by admin', { is_external: 1, external_approval_status: 'rejected' as const }],
    ])("a removed %s referee is 'removed'", (_label, overrides) => {
      expect(toRefereeStatus(makeStatusFields({ ...overrides, removed_at: REMOVED }))).toBe('removed');
    });
  });

  describe('removed_at handling', () => {
    it('treats null as not removed', () => {
      expect(toRefereeStatus(makeStatusFields({ removed_at: null }))).toBe('active');
    });

    it('treats an omitted removed_at as not removed', () => {
      const fields: RefereeStatusFields = {
        invitation_status: 'accepted',
        is_external: 0,
        external_approval_status: 'not_required',
      };

      expect(toRefereeStatus(fields)).toBe('active');
    });
  });

  it('treats only is_external === 1 as external', () => {
    expect(toRefereeStatus(makeStatusFields({ is_external: 0, external_approval_status: 'pending' }))).toBe('active');
    expect(toRefereeStatus(makeStatusFields({ is_external: 1, external_approval_status: 'pending' }))).toBe('pending_admin');
  });

  it('does not mutate its input', () => {
    const fields = makeStatusFields({ is_external: 1, external_approval_status: 'needs_docs' });
    const snapshot = structuredClone(fields);

    toRefereeStatus(fields);

    expect(fields).toEqual(snapshot);
  });
});

// ---------- toTournamentRefereeDto ----------

describe('toTournamentRefereeDto', () => {
  it('maps a referee row into a nested user ref plus status/external fields', () => {
    const row = makeRefereeRow({ is_external: 1, external_approval_status: 'approved' });

    expect(toTournamentRefereeDto(row)).toEqual({
      id: 1,
      user: { id: 5, fullName: 'กรรมการ A', avatarUrl: 'avatars/5.png' },
      invitationStatus: 'accepted',
      isExternal: true,
      externalApprovalStatus: 'approved',
      status: 'active',
    });
  });

  it('maps is_external 1 to true and 0 to false', () => {
    expect(toTournamentRefereeDto(makeRefereeRow({ is_external: 1 })).isExternal).toBe(true);
    expect(toTournamentRefereeDto(makeRefereeRow({ is_external: 0 })).isExternal).toBe(false);
  });

  it('maps a null avatar through the nested user ref as null', () => {
    expect(toTournamentRefereeDto(makeRefereeRow({ profile_image_key: null })).user.avatarUrl).toBeNull();
  });

  it.each(['pending', 'accepted', 'rejected'] as const)("passes invitation_status '%s' through as invitationStatus", (status) => {
    expect(toTournamentRefereeDto(makeRefereeRow({ invitation_status: status })).invitationStatus).toBe(status);
  });

  it.each(['not_required', 'pending', 'needs_docs', 'approved', 'rejected'] as const)(
    "passes external_approval_status '%s' through as externalApprovalStatus",
    (status) => {
      expect(toTournamentRefereeDto(makeRefereeRow({ external_approval_status: status })).externalApprovalStatus).toBe(status);
    },
  );

  it('derives status with toRefereeStatus, so an external referee awaiting docs is pending_admin', () => {
    const dto = toTournamentRefereeDto(makeRefereeRow({ is_external: 1, external_approval_status: 'needs_docs' }));

    expect(dto.status).toBe('pending_admin');
    expect(dto.externalApprovalStatus).toBe('needs_docs');
  });

  it("reports status 'removed' when removed_at is set, while invitationStatus stays as stored", () => {
    const dto = toTournamentRefereeDto(makeRefereeRow({ removed_at: REMOVED }));

    expect(dto.status).toBe('removed');
    expect(dto.invitationStatus).toBe('accepted');
  });

  it('returns exactly the documented keys', () => {
    expect(Object.keys(toTournamentRefereeDto(makeRefereeRow())).sort()).toEqual([
      'externalApprovalStatus',
      'id',
      'invitationStatus',
      'isExternal',
      'status',
      'user',
    ]);
  });

  it('does not leak verification documents, rejection reasons or removal details', () => {
    const row = makeRefereeRow({
      external_verification_docs: ['s3/private-doc.pdf'],
      external_rejection_reason: 'forged document',
      removed_by: 2,
      approved_by: 3,
    });
    const json = JSON.stringify(toTournamentRefereeDto(row));

    expect(json).not.toContain('private-doc.pdf');
    expect(json).not.toContain('forged document');
    expect(json).not.toContain('removed_by');
    expect(json).not.toContain('approved_by');
  });

  it('does not mutate the input row', () => {
    const row = makeRefereeRow({ removed_at: REMOVED });
    const snapshot = structuredClone(row);

    toTournamentRefereeDto(row);

    expect(row).toEqual(snapshot);
  });
});

// ---------- toInvitedMatchDto ----------

describe('toInvitedMatchDto', () => {
  it('maps DB columns to DTO fields with ISO schedule strings', () => {
    expect(toInvitedMatchDto(makeInvitedMatch())).toEqual({
      id: 4,
      roundNumber: 1,
      scheduledTime: '2024-06-01T03:00:00.000Z',
      scheduledEndTime: '2024-06-01T04:00:00.000Z',
      venue: 'Hall A',
      mode: 'onsite',
      matchStatus: 'scheduled',
      assignmentStatus: 'pending',
    });
  });

  it('keeps schedule, round and venue null when unset', () => {
    const dto = toInvitedMatchDto(
      makeInvitedMatch({ round_number: null, scheduled_time: null, scheduled_end_time: null, venue: null }),
    );

    expect(dto.roundNumber).toBeNull();
    expect(dto.scheduledTime).toBeNull();
    expect(dto.scheduledEndTime).toBeNull();
    expect(dto.venue).toBeNull();
  });

  it('handles a scheduled start with no end time', () => {
    const dto = toInvitedMatchDto(makeInvitedMatch({ scheduled_end_time: null }));

    expect(dto.scheduledTime).toBe('2024-06-01T03:00:00.000Z');
    expect(dto.scheduledEndTime).toBeNull();
  });

  it.each(['onsite', 'online'] as const)("passes mode '%s' through", (mode) => {
    expect(toInvitedMatchDto(makeInvitedMatch({ mode })).mode).toBe(mode);
  });

  it.each(['scheduled', 'checkin_open', 'in_progress', 'completed', 'disputed', 'result_rejected'] as const)(
    "passes match_status '%s' through as matchStatus",
    (status) => {
      expect(toInvitedMatchDto(makeInvitedMatch({ match_status: status })).matchStatus).toBe(status);
    },
  );

  it.each(['pending', 'accepted', 'declined'] as const)("passes assignment_status '%s' through as assignmentStatus", (status) => {
    expect(toInvitedMatchDto(makeInvitedMatch({ assignment_status: status })).assignmentStatus).toBe(status);
  });

  it('uses match_id (not match_referee_id) as id', () => {
    expect(toInvitedMatchDto(makeInvitedMatch({ match_id: 4, match_referee_id: 999 })).id).toBe(4);
  });

  it('returns exactly the documented keys', () => {
    expect(Object.keys(toInvitedMatchDto(makeInvitedMatch())).sort()).toEqual([
      'assignmentStatus',
      'id',
      'matchStatus',
      'mode',
      'roundNumber',
      'scheduledEndTime',
      'scheduledTime',
      'venue',
    ]);
  });

  it('throws a RangeError when a schedule date is invalid', () => {
    expect(() => toInvitedMatchDto(makeInvitedMatch({ scheduled_time: new Date('nope') }))).toThrow(RangeError);
    expect(() => toInvitedMatchDto(makeInvitedMatch({ scheduled_end_time: new Date('nope') }))).toThrow(RangeError);
  });
});

// ---------- toMyRefereeInvitationDto ----------

describe('toMyRefereeInvitationDto', () => {
  it('maps the invitation row into a nested tournament ref with ISO createdAt and mapped matches', () => {
    expect(toMyRefereeInvitationDto(makeInvitationRow(), [makeInvitedMatch()])).toEqual({
      id: 1,
      tournament: { id: 3, name: 'Summer Cup', sportTypeId: 2, eventStartDate: '2024-06-01' },
      isExternal: true,
      matches: [
        {
          id: 4,
          roundNumber: 1,
          scheduledTime: '2024-06-01T03:00:00.000Z',
          scheduledEndTime: '2024-06-01T04:00:00.000Z',
          venue: 'Hall A',
          mode: 'onsite',
          matchStatus: 'scheduled',
          assignmentStatus: 'pending',
        },
      ],
      createdAt: '2024-05-01T10:00:00.000Z',
    });
  });

  it('maps is_external 1 to true and 0 to false', () => {
    expect(toMyRefereeInvitationDto(makeInvitationRow({ is_external: 1 }), []).isExternal).toBe(true);
    expect(toMyRefereeInvitationDto(makeInvitationRow({ is_external: 0 }), []).isExternal).toBe(false);
  });

  it('returns an empty matches array when no matches are offered', () => {
    expect(toMyRefereeInvitationDto(makeInvitationRow(), []).matches).toEqual([]);
  });

  it('maps every offered match and preserves their order', () => {
    const matches = [makeInvitedMatch({ match_id: 30 }), makeInvitedMatch({ match_id: 10 }), makeInvitedMatch({ match_id: 20 })];

    const dto = toMyRefereeInvitationDto(makeInvitationRow(), matches);

    expect(dto.matches.map((m) => m.id)).toEqual([30, 10, 20]);
  });

  it('keeps eventStartDate as the same date string', () => {
    expect(toMyRefereeInvitationDto(makeInvitationRow({ event_start_date: '2026-12-31' }), []).tournament.eventStartDate).toBe(
      '2026-12-31',
    );
  });

  it('formats createdAt as an ISO string with milliseconds', () => {
    const dto = toMyRefereeInvitationDto(makeInvitationRow({ created_at: new Date('2024-05-01T10:00:00.123Z') }), []);

    expect(dto.createdAt).toBe('2024-05-01T10:00:00.123Z');
  });

  it('returns exactly id, tournament, isExternal, matches and createdAt', () => {
    expect(Object.keys(toMyRefereeInvitationDto(makeInvitationRow(), [])).sort()).toEqual([
      'createdAt',
      'id',
      'isExternal',
      'matches',
      'tournament',
    ]);
  });

  it('throws a RangeError when created_at is invalid', () => {
    expect(() => toMyRefereeInvitationDto(makeInvitationRow({ created_at: new Date('nope') }), [])).toThrow(RangeError);
  });

  it('does not mutate the row or the matches array', () => {
    const row = makeInvitationRow();
    const matches = [makeInvitedMatch(), makeInvitedMatch({ match_id: 5 })];
    const rowSnapshot = structuredClone(row);
    const matchesSnapshot = structuredClone(matches);

    toMyRefereeInvitationDto(row, matches);

    expect(row).toEqual(rowSnapshot);
    expect(matches).toEqual(matchesSnapshot);
  });
});

// ---------- toMyRefereeMatchDto ----------

describe('toMyRefereeMatchDto', () => {
  it('maps DB columns to DTO fields, with tournament and both teams nested', () => {
    expect(toMyRefereeMatchDto(makeMyRefereeMatchRow())).toEqual({
      id: 4,
      tournament: { id: 3, name: 'Summer Cup', sportTypeId: 2 },
      round: 1,
      teamA: { id: 11, name: 'Lions' },
      teamB: { id: 12, name: 'Tigers' },
      scheduledTime: MY_MATCH_START,
      scheduledEndTime: MY_MATCH_END,
      venue: 'Hall A',
      mode: 'onsite',
      status: 'scheduled',
    });
  });

  it('passes scheduledTime/scheduledEndTime through as Date objects, unlike toInvitedMatchDto', () => {
    const dto = toMyRefereeMatchDto(makeMyRefereeMatchRow());

    expect(dto.scheduledTime).toBeInstanceOf(Date);
    expect(dto.scheduledTime).toBe(MY_MATCH_START);
    expect(dto.scheduledEndTime).toBe(MY_MATCH_END);
  });

  it('sets teamA/teamB to null independently when their id is null', () => {
    const noA = toMyRefereeMatchDto(makeMyRefereeMatchRow({ team_a_id: null, team_a_name: null }));
    const noB = toMyRefereeMatchDto(makeMyRefereeMatchRow({ team_b_id: null, team_b_name: null }));

    expect(noA.teamA).toBeNull();
    expect(noA.teamB).not.toBeNull();
    expect(noB.teamB).toBeNull();
    expect(noB.teamA).not.toBeNull();
  });

  it('does not include sportTypeId on the team refs (unlike TeamRef elsewhere in the codebase)', () => {
    const dto = toMyRefereeMatchDto(makeMyRefereeMatchRow());

    expect(Object.keys(dto.teamA ?? {}).sort()).toEqual(['id', 'name']);
    expect(Object.keys(dto.teamB ?? {}).sort()).toEqual(['id', 'name']);
  });

  it('keeps round, schedule and venue null for an unscheduled match', () => {
    const dto = toMyRefereeMatchDto(
      makeMyRefereeMatchRow({ round_number: null, scheduled_time: null, scheduled_end_time: null, venue: null }),
    );

    expect(dto.round).toBeNull();
    expect(dto.scheduledTime).toBeNull();
    expect(dto.scheduledEndTime).toBeNull();
    expect(dto.venue).toBeNull();
  });

  it.each(['onsite', 'online'] as const)("passes mode '%s' through", (mode) => {
    expect(toMyRefereeMatchDto(makeMyRefereeMatchRow({ mode })).mode).toBe(mode);
  });

  it.each(['scheduled', 'checkin_open', 'in_progress', 'completed', 'disputed', 'result_rejected'] as const)(
    "passes match_status '%s' through as status",
    (status) => {
      expect(toMyRefereeMatchDto(makeMyRefereeMatchRow({ match_status: status })).status).toBe(status);
    },
  );

  it('uses match_id (not match_referee_id or tournament_referee_id) as id', () => {
    const dto = toMyRefereeMatchDto(makeMyRefereeMatchRow({ match_id: 4, match_referee_id: 999, tournament_referee_id: 888 }));

    expect(dto.id).toBe(4);
  });

  it('nests tournament_id, tournament_name and sport_type_id under tournament', () => {
    const dto = toMyRefereeMatchDto(makeMyRefereeMatchRow({ tournament_id: 7, tournament_name: 'Winter Cup', sport_type_id: 9 }));

    expect(dto.tournament).toEqual({ id: 7, name: 'Winter Cup', sportTypeId: 9 });
  });

  it('does not leak the referee-status fields (invitation_status, is_external, removed_at, ...)', () => {
    const row = makeMyRefereeMatchRow({
      invitation_status: 'accepted',
      is_external: 1,
      external_approval_status: 'approved',
      removed_at: null,
    });
    const json = JSON.stringify(toMyRefereeMatchDto(row));

    for (const leaked of ['invitation_status', 'invitationStatus', 'is_external', 'isExternal', 'external_approval_status', 'removed_at']) {
      expect(json).not.toContain(leaked);
    }
  });

  it('returns exactly the documented keys', () => {
    expect(Object.keys(toMyRefereeMatchDto(makeMyRefereeMatchRow())).sort()).toEqual([
      'id',
      'mode',
      'round',
      'scheduledEndTime',
      'scheduledTime',
      'status',
      'teamA',
      'teamB',
      'tournament',
      'venue',
    ]);
  });

  it('does not mutate the input row', () => {
    const row = makeMyRefereeMatchRow();
    const snapshot = structuredClone(row);

    toMyRefereeMatchDto(row);

    expect(row).toEqual(snapshot);
  });
});

// ---------- toMatchRefereeDto ----------

describe('toMatchRefereeDto', () => {
  it('maps the tournament referee id and a nested referee user ref', () => {
    expect(toMatchRefereeDto(makeMatchRefereeRow())).toEqual({
      tournamentRefereeId: 1,
      referee: { id: 5, fullName: 'กรรมการ A', avatarUrl: 'avatars/5.png' },
    });
  });

  it('maps a null avatar through as null', () => {
    expect(toMatchRefereeDto(makeMatchRefereeRow({ profile_image_key: null })).referee.avatarUrl).toBeNull();
  });

  it('uses tournament_referee_id (not match_referee_id) as tournamentRefereeId', () => {
    expect(toMatchRefereeDto(makeMatchRefereeRow({ tournament_referee_id: 1, match_referee_id: 999 })).tournamentRefereeId).toBe(1);
  });

  it('returns only tournamentRefereeId and referee, with no assignment or approval details', () => {
    const dto = toMatchRefereeDto(
      makeMatchRefereeRow({ assignment_status: 'declined', is_external: 1, external_approval_status: 'pending', removed_at: REMOVED }),
    );

    expect(Object.keys(dto).sort()).toEqual(['referee', 'tournamentRefereeId']);
    expect(Object.keys(dto.referee).sort()).toEqual(['avatarUrl', 'fullName', 'id']);
  });

  it('does not mutate the input row', () => {
    const row = makeMatchRefereeRow();
    const snapshot = structuredClone(row);

    toMatchRefereeDto(row);

    expect(row).toEqual(snapshot);
  });
});
