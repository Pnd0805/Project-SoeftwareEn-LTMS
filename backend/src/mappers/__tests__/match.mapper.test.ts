import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/imageUrl.js', () => ({
  toPublicImageUrl: (key: string | null) => (key === null ? null : `https://cdn.test/${key}`),
}));

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
    livestream_url: null,
    team_a_id: 11,
    team_a_name: 'Lions',
    team_a_sport_type_id: 3,
    team_a_logo_key: null,          // OD-61
    team_b_id: 12,
    team_b_name: 'Tigers',
    team_b_sport_type_id: 3,
    team_b_logo_key: null,          // OD-61
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
    // 🆕 BO-N (มติ 5 ต.ค.) — null = กีฬาไม่ได้แข่งเป็นรอบ ⇒ mapper จะไปอ่านเส้นของกีฬาสองบรรทัดล่าง
    best_of: null,
    // ★ สองคอลัมน์นี้มาจาก JOIN sport_types ใน findMatchById ไม่ใช่คอลัมน์ของ matches
    //   ค่า (0,1) คือเส้นของฟุตบอลในฐานจริง — ตั้งค่าจริงไว้เพื่อให้เทสจับได้ถ้า mapper
    //   ไปอ่านจากรูปแบบแทนที่จะอ่านจากกีฬาเวลา best_of เป็น null
    sport_pickem_tolerance_exact: 0,
    sport_pickem_tolerance_close: 1,
    team_a_id: 11,
    team_b_id: 12,
    scheduled_time: START,
    scheduled_end_time: END,
    venue: 'Hall A',
    checkin_open_at: CHECKIN_OPEN,
    started_at: null,
    actual_end_time: null,
    match_status: 'checkin_open',
    mode: 'online',
    room_code: 'ZOOM-4821',
    livestream_url: null,
    team_a_name: 'Lions',
    team_a_sport_type_id: 3,
    team_a_logo_key: null,          // OD-61
    team_b_name: 'Tigers',
    team_b_sport_type_id: 3,
    team_b_logo_key: null,          // OD-61
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
    rejection_reason: null,
    checked_in_at: CHECKED_IN,
    ...overrides,
  };
}

function makeLineupRow(overrides: Partial<MatchLineupRow> = {}): MatchLineupRow {
  return {
    team_id: 11,
    application_status: 'approved',   // ทีมที่ยังไม่ถอนตัว — เคสหลัก (U14/RW05)
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
    team_a_logo_key: null,          // OD-61
    team_b_id: 12,
    team_b_name: 'Tigers',
    team_b_sport_type_id: 3,
    team_b_logo_key: null,          // OD-61
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
    expect(dto.teamA).toEqual({ id: 11, name: 'Lions', sportTypeId: 3, logoUrl: null });
    expect(dto.teamB).toEqual({ id: 12, name: 'Tigers', sportTypeId: 3, logoUrl: null });
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
        'livestreamUrl',
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

/**
 * FE-replay-link-write-only — E12 เขียน `matches.livestream_url` ตั้งแต่ schema แรก
 * แต่ไม่มี route ไหนอ่านกลับ ลิงก์จึงหายทุกครั้งที่โหลดหน้าใหม่ · สาธารณะ ต่างจาก roomCode ที่จำกัดผู้ดู
 */
describe('livestreamUrl (M04 + M05)', () => {
  const URL = 'https://www.youtube.com/watch?v=abc123';

  it('the match list carries it', () => {
    expect(toMatchListItemDto(makeListRow({ livestream_url: URL })).livestreamUrl).toBe(URL);
    expect(toMatchListItemDto(makeListRow()).livestreamUrl).toBeNull();
  });

  it('the match detail carries it', () => {
    expect(toMatchDetailDto(makeDetailRow({ livestream_url: URL })).livestreamUrl).toBe(URL);
    expect(toMatchDetailDto(makeDetailRow()).livestreamUrl).toBeNull();
  });

  // ★ ไม่ผูกกับ canSeeRoomCode — ลิงก์ถ่ายทอด/รีเพลย์มีไว้ให้คนดู ต่างจากรหัสห้องที่ปิดไว้
  it('is not gated like the room code: a viewer with no room-code access still gets the link', () => {
    const dto = toMatchDetailDto(makeDetailRow({ livestream_url: URL, room_code: 'ZOOM-1' }), false);
    expect(dto.livestreamUrl).toBe(URL);
    expect(dto.roomCode).toBeNull();
  });
});

describe('toMatchDetailDto', () => {
  it('maps DB columns to DTO fields', () => {
    const dto = toMatchDetailDto(makeDetailRow());

    expect(dto.id).toBe(1);
    expect(dto.tournamentId).toBe(100);
    expect(dto.round).toBe(2);
    expect(dto.teamA).toEqual({ id: 11, name: 'Lions', sportTypeId: 3, logoUrl: null });
    expect(dto.teamB).toEqual({ id: 12, name: 'Tigers', sportTypeId: 3, logoUrl: null });
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
        'startedAt',        // migration 026 — เวลาเริ่มแข่งจริง
        'actualEndTime',    // migration 026 — เวลาจบแข่งจริง (ต่างจาก scheduledEndTime ที่เป็นเวลาตามตาราง)
        'status',
        'mode',
        'roomCode',
        'livestreamUrl',
        'bestOf',           // 🆕 BO-N (มติ 5 ต.ค.) — null = กีฬานี้ไม่ได้แข่งเป็นรอบ
        'possibleScores',   // 🆕 คู่สกอร์ที่เป็นไปได้ ส่งมาให้ FE ทำปุ่มเลือก
        'pickemTolerance',  // 🆕 เส้นของ "แมตช์นี้" — GET /sport-types ตอบได้แค่ต่อกีฬาซึ่งไม่พอ
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
      rejectionReason: null,
      checkedInAt: CHECKED_IN,
    });
  });

  /**
   * FE-checkin-reject-reason-not-listed — M15 บังคับให้กรอกเหตุผลและ M20 คืนให้เจ้าตัวอยู่แล้ว
   * แต่ M13 ไม่เคยคืน กรรมการจึงไม่เห็นเหตุผลของแถวไหนเลย รวมถึงเหตุผลที่ตัวเองเพิ่งพิมพ์
   * (คนละคอลัมน์กับ `note` ที่เป็นเหตุผลการ "อนุโลมให้ผ่าน" — ต้องไม่ปนกัน)
   */
  it('carries the rejection reason, separately from the manual-check-in note', () => {
    const dto = toCheckinListItemDto(makeCheckinRow({
      match_checkin_status: 'rejected',
      rejection_reason: 'รูปบัตรไม่ตรงกับผู้เล่น',
      note: 'กรรมการอนุโลมรอบก่อน',
    }));
    expect(dto.rejectionReason).toBe('รูปบัตรไม่ตรงกับผู้เล่น');
    expect(dto.note).toBe('กรรมการอนุโลมรอบก่อน');
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
        'rejectionReason',
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
      avatarUrl: 'https://cdn.test/avatars/9.png',
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

  it('turns profile_image_key into a displayable URL via toPublicImageUrl (not a raw key)', () => {
    expect(
      toLineupPlayerDto(makeLineupRow({ profile_image_key: 'avatars/raw-key.png' })).avatarUrl,
    ).toBe('https://cdn.test/avatars/raw-key.png');
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
      teamA: { id: 11, name: 'Lions', sportTypeId: 3, logoUrl: null },
      teamB: { id: 12, name: 'Tigers', sportTypeId: 3, logoUrl: null },
      matchId: 1,
      matchStatus: 'scheduled',
      advancesToNodeId: 201,
    });
  });

  it.each(['winners', 'losers', 'grand_final'] as const)("passes bracket_type '%s' through", (bracketType) => {
    expect(toBracketNodeDto(makeNodeRow({ bracket_type: bracketType })).bracketType).toBe(bracketType);
  });

  /**
   * OD-61 ก้าวที่ 2 (4 ต.ค. 2569) — แยกสองความหมายของ null ที่ปนกันง่าย
   *
   * 🔴 ทีมที่ "มีจริงแต่ยังไม่อัปโลโก้" ต้องยังโผล่เป็นทีม ไม่ใช่กลายเป็น null ทั้งก้อน
   *   ถ้าใครเผลอตัดสินด้วย logoKey แทน teamId ช่องสายจะว่างทั้งที่มีทีมอยู่
   *   แล้วหน้าสายการแข่งขันจะโชว์ "ยังไม่มีทีม" ทั้งทัวร์ โดย API ตอบ 200 ปกติ
   */
  it('★ ทีมมีจริงแต่ไม่มีโลโก้ → ยังเป็นทีม (logoUrl null) ไม่ใช่ null ทั้งก้อน', () => {
    const dto = toBracketNodeDto(makeNodeRow({ team_a_logo_key: null }));

    expect(dto.teamA).not.toBeNull();
    expect(dto.teamA!.logoUrl).toBeNull();
    expect(dto.teamA!.id).toBe(11);
  });

  it('★ มีโลโก้ → แปลงเป็น URL สาธารณะ ไม่ใช่ key ดิบ', () => {
    const dto = toBracketNodeDto(makeNodeRow({ team_a_logo_key: 'teams/11/logo.png' }));

    expect(dto.teamA!.logoUrl).toContain('teams/11/logo.png');
    expect(dto.teamA!.logoUrl).not.toBe('teams/11/logo.png');
  });

  it('sets each team to null independently when its id is null', () => {
    const noA = toBracketNodeDto(
      makeNodeRow({ team_a_id: null, team_a_name: null, team_a_sport_type_id: null }),
    );
    const noB = toBracketNodeDto(
      makeNodeRow({ team_b_id: null, team_b_name: null, team_b_sport_type_id: null }),
    );

    expect(noA.teamA).toBeNull();
    expect(noA.teamB).toEqual({ id: 12, name: 'Tigers', sportTypeId: 3, logoUrl: null });
    expect(noB.teamB).toBeNull();
    expect(noB.teamA).toEqual({ id: 11, name: 'Lions', sportTypeId: 3, logoUrl: null });
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
