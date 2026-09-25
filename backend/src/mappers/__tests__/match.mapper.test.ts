import { describe, it, expect } from 'vitest';
import {
  toMatchListItemDto,
  toMatchDetailDto,
  toCheckinStatusApi,
  toCheckinListItemDto,
  toLineupPlayerDto,
  toBracketNodeDto,
} from '../match.mapper.js';
import type {
  MatchListRow,
  MatchDetailRow,
  MatchCheckinListRow,
  MatchLineupRow,
} from '../../repositories/match.repo.js';
import type { BracketNodeListRow } from '../../repositories/bracketNode.repo.js';

// ---------- fixtures ----------

const START = new Date('2026-05-10T09:00:00.000Z');
const END = new Date('2026-05-10T10:00:00.000Z');
const CHECKIN_OPEN = new Date('2026-05-10T08:30:00.000Z');
const CHECKED_IN = new Date('2026-05-10T08:45:00.000Z');

// A scheduled match with no result yet — keeps team-mapping tests independent of the
// toMatchResultSummary behavior, which has its own dedicated suite (match.mapper.outcome.test.ts).
function makeListRow(overrides: Partial<MatchListRow> = {}): MatchListRow {
  return {
    match_id: 1,
    round_number: 2,
    scheduled_time: START,
    scheduled_end_time: END,
    venue: 'Hall A',
    match_status: 'scheduled',
    team_a_id: 11,
    team_a_name: 'Lions',
    team_a_sport_type_id: 3,
    team_b_id: 12,
    team_b_name: 'Tigers',
    team_b_sport_type_id: 3,
    next_match_id: 5,
    loser_next_match_id: null,
    result_status: null,
    result_winner_team_id: null,
    result_score: null,
    ...overrides,
  };
}

function makeDetailRow(overrides: Partial<MatchDetailRow> = {}): MatchDetailRow {
  return {
    match_id: 1,
    tournament_id: 100,
    round_number: 2,
    team_a_id: 11,
    team_b_id: 12,
    scheduled_time: START,
    scheduled_end_time: END,
    venue: 'Hall A',
    checkin_open_at: CHECKIN_OPEN,
    match_status: 'checkin_open',
    mode: 'online',
    room_code: 'ZOOM-4821',
    team_a_name: 'Lions',
    team_a_sport_type_id: 3,
    team_b_name: 'Tigers',
    team_b_sport_type_id: 3,
    next_match_id: 5,
    loser_next_match_id: null,
    result_status: null,
    result_winner_team_id: null,
    result_score: null,
    ...overrides,
  };
}

function makeCheckinRow(overrides: Partial<MatchCheckinListRow> = {}): MatchCheckinListRow {
  return {
    match_checkin_id: 77,
    user_id: 9,
    full_name: 'Somchai Jaidee',
    method: 'qr_onsite',
    match_checkin_status: 'success',
    document_type: null,
    document_s3_key: null,
    note: null,
    checked_in_at: CHECKED_IN,
    ...overrides,
  };
}

function makeLineupRow(overrides: Partial<MatchLineupRow> = {}): MatchLineupRow {
  return {
    team_id: 11,
    user_id: 9,
    full_name: 'Somchai Jaidee',
    profile_image_key: 'avatars/9.png',
    match_checkin_status: 'success',
    checked_in_at: CHECKED_IN,
    ...overrides,
  };
}

function makeNodeRow(overrides: Partial<BracketNodeListRow> = {}): BracketNodeListRow {
  return {
    bracket_node_id: 200,
    bracket_type: 'winners',
    round: 1,
    match_number: 1,
    team_a_id: 11,
    team_a_name: 'Lions',
    team_a_sport_type_id: 3,
    team_b_id: 12,
    team_b_name: 'Tigers',
    team_b_sport_type_id: 3,
    match_id: 1,
    match_status: 'scheduled',
    advances_to_node_id: 201,
    ...overrides,
  };
}

// ---------- toMatchListItemDto ----------

describe('toMatchListItemDto', () => {
  it('maps DB columns to DTO fields', () => {
    const dto = toMatchListItemDto(makeListRow());

    expect(dto.id).toBe(1);
    expect(dto.round).toBe(2);
    expect(dto.teamA).toEqual({ id: 11, name: 'Lions', sportTypeId: 3 });
    expect(dto.teamB).toEqual({ id: 12, name: 'Tigers', sportTypeId: 3 });
    expect(dto.scheduledTime).toBe(START);
    expect(dto.scheduledEndTime).toBe(END);
    expect(dto.venue).toBe('Hall A');
    expect(dto.status).toBe('scheduled');
  });

  it('sets teamA/teamB to null independently when their id is null', () => {
    const noA = toMatchListItemDto(
      makeListRow({ team_a_id: null, team_a_name: null, team_a_sport_type_id: null }),
    );
    const noB = toMatchListItemDto(
      makeListRow({ team_b_id: null, team_b_name: null, team_b_sport_type_id: null }),
    );

    expect(noA.teamA).toBeNull();
    expect(noA.teamB).not.toBeNull();
    expect(noB.teamB).toBeNull();
    expect(noB.teamA).not.toBeNull();
  });

  it('passes scheduledTime/scheduledEndTime through as the same Date objects', () => {
    const dto = toMatchListItemDto(makeListRow());

    expect(dto.scheduledTime).toBeInstanceOf(Date);
    expect(dto.scheduledTime).toBe(START);
  });

  it('spreads in the result summary fields (nextMatchId, resultStatus, score, outcome)', () => {
    const dto = toMatchListItemDto(
      makeListRow({
        match_status: 'completed',
        result_status: 'verified',
        result_winner_team_id: 11,
        result_score: { '11': 2, '12': 1 },
      }),
    );

    expect(dto.nextMatchId).toBe(5);
    expect(dto.loserNextMatchId).toBeNull();
    expect(dto.resultStatus).toBe('verified');
    expect(dto.score).toEqual({ '11': 2, '12': 1 });
    expect(dto.outcome).toEqual({ kind: 'played', winnerTeamId: 11, loserTeamId: 12 });
  });

  it('keeps outcome null and score null for a match with no result yet', () => {
    const dto = toMatchListItemDto(makeListRow());

    expect(dto.outcome).toBeNull();
    expect(dto.score).toBeNull();
    expect(dto.resultStatus).toBeNull();
  });

  it('returns exactly the documented keys (list + result summary)', () => {
    expect(Object.keys(toMatchListItemDto(makeListRow())).sort()).toEqual(
      [
        'id',
        'round',
        'teamA',
        'teamB',
        'scheduledTime',
        'scheduledEndTime',
        'venue',
        'status',
        'nextMatchId',
        'loserNextMatchId',
        'resultStatus',
        'score',
        'outcome',
      ].sort(),
    );
  });

  it('does not mutate the input row', () => {
    const row = makeListRow();
    const snapshot = structuredClone(row);

    toMatchListItemDto(row);

    expect(row).toEqual(snapshot);
  });
});

// ---------- toMatchDetailDto ----------

describe('toMatchDetailDto', () => {
  it('maps DB columns to DTO fields', () => {
    const dto = toMatchDetailDto(makeDetailRow());

    expect(dto.id).toBe(1);
    expect(dto.tournamentId).toBe(100);
    expect(dto.round).toBe(2);
    expect(dto.teamA).toEqual({ id: 11, name: 'Lions', sportTypeId: 3 });
    expect(dto.teamB).toEqual({ id: 12, name: 'Tigers', sportTypeId: 3 });
    expect(dto.checkinOpenAt).toBe(CHECKIN_OPEN);
    expect(dto.status).toBe('checkin_open');
    expect(dto.mode).toBe('online');
  });

  it.each(['onsite', 'online'] as const)("passes mode '%s' through", (mode) => {
    expect(toMatchDetailDto(makeDetailRow({ mode })).mode).toBe(mode);
  });

  it('defaults canSeeRoomCode to false and hides the room code', () => {
    const dto = toMatchDetailDto(makeDetailRow({ room_code: 'ZOOM-4821' }));

    expect(dto.roomCode).toBeNull();
  });

  it('hides the room code when canSeeRoomCode is explicitly false', () => {
    const dto = toMatchDetailDto(makeDetailRow({ room_code: 'ZOOM-4821' }), false);

    expect(dto.roomCode).toBeNull();
  });

  it('reveals the room code when canSeeRoomCode is true', () => {
    const dto = toMatchDetailDto(makeDetailRow({ room_code: 'ZOOM-4821' }), true);

    expect(dto.roomCode).toBe('ZOOM-4821');
  });

  it('keeps roomCode null when canSeeRoomCode is true but the match has none set (onsite match)', () => {
    const dto = toMatchDetailDto(makeDetailRow({ mode: 'onsite', room_code: null }), true);

    expect(dto.roomCode).toBeNull();
  });

  it('spreads in the result summary fields', () => {
    const dto = toMatchDetailDto(
      makeDetailRow({
        match_status: 'completed',
        result_status: 'walkover',
        result_winner_team_id: 11,
        result_score: null,
      }),
    );

    expect(dto.resultStatus).toBe('walkover');
    expect(dto.outcome).toEqual({ kind: 'walkover', winnerTeamId: 11, loserTeamId: 12 });
  });

  it('keeps nullable fields null for an unscheduled match', () => {
    const dto = toMatchDetailDto(
      makeDetailRow({
        round_number: null,
        scheduled_time: null,
        scheduled_end_time: null,
        venue: null,
        checkin_open_at: null,
        team_a_id: null,
        team_a_name: null,
        team_a_sport_type_id: null,
        team_b_id: null,
        team_b_name: null,
        team_b_sport_type_id: null,
      }),
    );

    expect(dto.round).toBeNull();
    expect(dto.scheduledTime).toBeNull();
    expect(dto.scheduledEndTime).toBeNull();
    expect(dto.venue).toBeNull();
    expect(dto.checkinOpenAt).toBeNull();
    expect(dto.teamA).toBeNull();
    expect(dto.teamB).toBeNull();
  });

  it('returns exactly the documented keys (detail + result summary)', () => {
    expect(Object.keys(toMatchDetailDto(makeDetailRow())).sort()).toEqual(
      [
        'id',
        'tournamentId',
        'round',
        'teamA',
        'teamB',
        'scheduledTime',
        'scheduledEndTime',
        'venue',
        'checkinOpenAt',
        'status',
        'mode',
        'roomCode',
        'nextMatchId',
        'loserNextMatchId',
        'resultStatus',
        'score',
        'outcome',
      ].sort(),
    );
  });

  it('does not mutate the input row', () => {
    const row = makeDetailRow();
    const snapshot = structuredClone(row);

    toMatchDetailDto(row, true);

    expect(row).toEqual(snapshot);
  });
});

// ---------- toCheckinStatusApi ----------

describe('toCheckinStatusApi', () => {
  it("maps 'success' to 'checked_in'", () => {
    expect(toCheckinStatusApi('success')).toBe('checked_in');
  });

  it("maps 'exception' (manual override by referee) to 'checked_in'", () => {
    expect(toCheckinStatusApi('exception')).toBe('checked_in');
  });

  it("maps 'pending' to 'pending_verification'", () => {
    expect(toCheckinStatusApi('pending')).toBe('pending_verification');
  });

  it("maps 'rejected' to 'rejected'", () => {
    expect(toCheckinStatusApi('rejected')).toBe('rejected');
  });
});

// ---------- toCheckinListItemDto ----------

describe('toCheckinListItemDto', () => {
  it('maps DB columns to DTO fields', () => {
    expect(toCheckinListItemDto(makeCheckinRow())).toEqual({
      id: 77,
      userId: 9,
      fullName: 'Somchai Jaidee',
      method: 'qr_onsite',
      status: 'checked_in',
      documentType: null,
      documentUrl: null,
      note: null,
      checkedInAt: CHECKED_IN,
    });
  });

  it('defaults documentUrl to null when no URL is passed', () => {
    expect(toCheckinListItemDto(makeCheckinRow()).documentUrl).toBeNull();
  });

  it('uses the presigned URL passed in as the second argument', () => {
    const url = 'https://bucket.s3.example.com/doc.jpg?X-Amz-Signature=abc';
    const row = makeCheckinRow({
      method: 'photo_online',
      match_checkin_status: 'pending',
      document_type: 'student_id',
      document_s3_key: 'checkins/1/9.jpg',
    });

    const dto = toCheckinListItemDto(row, url);

    expect(dto.documentUrl).toBe(url);
    expect(dto.documentType).toBe('student_id');
  });

  it('passes note through unchanged for a manual exception check-in', () => {
    const row = makeCheckinRow({
      method: 'manual_by_referee',
      match_checkin_status: 'exception',
      note: 'ID card left at the dorm, referee vouched in person',
    });

    expect(toCheckinListItemDto(row).note).toBe(
      'ID card left at the dorm, referee vouched in person',
    );
  });

  it('keeps note null when no note was given', () => {
    expect(toCheckinListItemDto(makeCheckinRow({ note: null })).note).toBeNull();
  });

  it('never exposes document_s3_key in the DTO (PDPA)', () => {
    const row = makeCheckinRow({
      method: 'photo_online',
      document_type: 'national_id',
      document_s3_key: 'checkins/1/9.jpg',
    });

    const dto = toCheckinListItemDto(row, null);

    expect(dto).not.toHaveProperty('document_s3_key');
    expect(dto).not.toHaveProperty('documentS3Key');
    expect(JSON.stringify(dto)).not.toContain('checkins/1/9.jpg');
  });

  it('translates the DB status to the API status', () => {
    const cases: Array<[MatchCheckinListRow['match_checkin_status'], string]> = [
      ['success', 'checked_in'],
      ['exception', 'checked_in'],
      ['pending', 'pending_verification'],
      ['rejected', 'rejected'],
    ];

    for (const [dbStatus, apiStatus] of cases) {
      expect(toCheckinListItemDto(makeCheckinRow({ match_checkin_status: dbStatus })).status).toBe(
        apiStatus,
      );
    }
  });

  it.each(['qr_onsite', 'photo_online', 'manual_by_referee'] as const)(
    "passes method '%s' through unchanged",
    (method) => {
      expect(toCheckinListItemDto(makeCheckinRow({ method })).method).toBe(method);
    },
  );

  it('passes checked_in_at through as the same Date object', () => {
    expect(toCheckinListItemDto(makeCheckinRow()).checkedInAt).toBe(CHECKED_IN);
  });

  it('returns only the documented keys', () => {
    expect(Object.keys(toCheckinListItemDto(makeCheckinRow())).sort()).toEqual(
      [
        'id',
        'userId',
        'fullName',
        'method',
        'status',
        'documentType',
        'documentUrl',
        'note',
        'checkedInAt',
      ].sort(),
    );
  });

  it('does not mutate the input row', () => {
    const row = makeCheckinRow({ document_s3_key: 'k', document_type: 'student_id', note: 'ok' });
    const snapshot = structuredClone(row);

    toCheckinListItemDto(row, 'https://example.com/x');

    expect(row).toEqual(snapshot);
  });
});

// ---------- toLineupPlayerDto ----------

describe('toLineupPlayerDto', () => {
  it('maps user fields and translates a real check-in status', () => {
    expect(toLineupPlayerDto(makeLineupRow())).toEqual({
      userId: 9,
      fullName: 'Somchai Jaidee',
      avatarUrl: 'avatars/9.png',
      checkinStatus: 'checked_in',
      checkedInAt: CHECKED_IN,
    });
  });

  it("keeps checkinStatus null (not 'rejected') when the player has not checked in at all", () => {
    const dto = toLineupPlayerDto(makeLineupRow({ match_checkin_status: null, checked_in_at: null }));

    expect(dto.checkinStatus).toBeNull();
    expect(dto.checkedInAt).toBeNull();
  });

  it('translates every non-null check-in status through toCheckinStatusApi', () => {
    const cases: Array<[MatchLineupRow['match_checkin_status'], string | null]> = [
      ['success', 'checked_in'],
      ['exception', 'checked_in'],
      ['pending', 'pending_verification'],
      ['rejected', 'rejected'],
      [null, null],
    ];

    for (const [dbStatus, apiStatus] of cases) {
      expect(toLineupPlayerDto(makeLineupRow({ match_checkin_status: dbStatus })).checkinStatus).toBe(
        apiStatus,
      );
    }
  });

  it('maps a null avatar through as null', () => {
    expect(toLineupPlayerDto(makeLineupRow({ profile_image_key: null })).avatarUrl).toBeNull();
  });

  it('passes profile_image_key through as avatarUrl without transforming it (a key, not a URL)', () => {
    expect(
      toLineupPlayerDto(makeLineupRow({ profile_image_key: 'avatars/raw-key.png' })).avatarUrl,
    ).toBe('avatars/raw-key.png');
  });

  it('does not expose which team the player belongs to (team_id is dropped)', () => {
    const dto = toLineupPlayerDto(makeLineupRow({ team_id: 11 }));

    expect(dto).not.toHaveProperty('team_id');
    expect(dto).not.toHaveProperty('teamId');
  });

  it('returns exactly the documented keys', () => {
    expect(Object.keys(toLineupPlayerDto(makeLineupRow())).sort()).toEqual(
      ['userId', 'fullName', 'avatarUrl', 'checkinStatus', 'checkedInAt'].sort(),
    );
  });

  it('does not mutate the input row', () => {
    const row = makeLineupRow();
    const snapshot = structuredClone(row);

    toLineupPlayerDto(row);

    expect(row).toEqual(snapshot);
  });
});

// ---------- toBracketNodeDto ----------

describe('toBracketNodeDto', () => {
  it('maps DB columns to DTO fields', () => {
    expect(toBracketNodeDto(makeNodeRow())).toEqual({
      nodeId: 200,
      bracketType: 'winners',
      round: 1,
      matchNumber: 1,
      teamA: { id: 11, name: 'Lions', sportTypeId: 3 },
      teamB: { id: 12, name: 'Tigers', sportTypeId: 3 },
      matchId: 1,
      matchStatus: 'scheduled',
      advancesToNodeId: 201,
    });
  });

  it.each(['winners', 'losers', 'grand_final'] as const)("passes bracket_type '%s' through", (bracketType) => {
    expect(toBracketNodeDto(makeNodeRow({ bracket_type: bracketType })).bracketType).toBe(bracketType);
  });

  it('sets each team to null independently when its id is null', () => {
    const noA = toBracketNodeDto(
      makeNodeRow({ team_a_id: null, team_a_name: null, team_a_sport_type_id: null }),
    );
    const noB = toBracketNodeDto(
      makeNodeRow({ team_b_id: null, team_b_name: null, team_b_sport_type_id: null }),
    );

    expect(noA.teamA).toBeNull();
    expect(noA.teamB).toEqual({ id: 12, name: 'Tigers', sportTypeId: 3 });
    expect(noB.teamB).toBeNull();
    expect(noB.teamA).toEqual({ id: 11, name: 'Lions', sportTypeId: 3 });
  });

  it('represents a bye node (no real match) with null matchId and matchStatus', () => {
    const dto = toBracketNodeDto(
      makeNodeRow({
        team_b_id: null,
        team_b_name: null,
        team_b_sport_type_id: null,
        match_id: null,
        match_status: null,
      }),
    );

    expect(dto.matchId).toBeNull();
    expect(dto.matchStatus).toBeNull();
    expect(dto.teamB).toBeNull();
  });

  it('keeps advancesToNodeId null for the last node in the bracket', () => {
    expect(toBracketNodeDto(makeNodeRow({ advances_to_node_id: null })).advancesToNodeId).toBeNull();
  });

  it('keeps round null when the DB round is null', () => {
    expect(toBracketNodeDto(makeNodeRow({ round: null })).round).toBeNull();
  });

  it('returns only the documented keys', () => {
    expect(Object.keys(toBracketNodeDto(makeNodeRow())).sort()).toEqual(
      [
        'nodeId',
        'bracketType',
        'round',
        'matchNumber',
        'teamA',
        'teamB',
        'matchId',
        'matchStatus',
        'advancesToNodeId',
      ].sort(),
    );
  });

  it('does not mutate the input row', () => {
    const row = makeNodeRow();
    const snapshot = structuredClone(row);

    toBracketNodeDto(row);

    expect(row).toEqual(snapshot);
  });
});
