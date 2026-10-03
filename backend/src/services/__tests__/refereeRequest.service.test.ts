import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/refereeChangeRequest.repo.js', () => ({
  create: vi.fn(),
  findById: vi.fn(),
  existsOpenFor: vi.fn(),
  findListRowById: vi.fn(),
  findByTournament: vi.fn(),
  findPendingForUser: vi.fn(),
  findCreatedByUser: vi.fn(),
  answerSide: vi.fn(),
  close: vi.fn(),
  apply: vi.fn(),
}));

vi.mock('../../repositories/tournamentReferee.repo.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../repositories/matchReferee.repo.js', () => ({
  findByTournamentReferees: vi.fn(),
}));

vi.mock('../../repositories/match.repo.js', () => ({
  findById: vi.fn(),
}));

// referee.service.js is a sibling service refereeRequest.service.ts leans on for two
// pure-ish helpers (assertSchedulable, isActiveReferee). Mocked wholesale so this suite
// only exercises refereeRequest.service.ts's own orchestration/branching.
vi.mock('../referee.service.js', () => ({
  assertSchedulable: vi.fn(),
  isActiveReferee: vi.fn(),
  // createRefRequest หาแถวของตัวเองผ่านตัวนี้แล้ว ไม่ใช่ findLatest + isActiveReferee แยกสองก้อน (แก้ 1 ต.ค. 2569)
  findActiveRefereeRow: vi.fn(),
}));

vi.mock('../../mappers/refereeRequest.mapper.js', () => ({
  toRefereeRequestDto: vi.fn(),
}));

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
}));

import {
  createRefRequest,
  createOrgAddMatch,
  createOrgSwap,
  listMyRequests,
  listTournamentRequests,
  respondToRequest,
  cancelRequest,
} from '../refereeRequest.service.js';
import * as ReqRepo from '../../repositories/refereeChangeRequest.repo.js';
import * as RefRepo from '../../repositories/tournamentReferee.repo.js';
import * as MatchRefRepo from '../../repositories/matchReferee.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import { assertSchedulable, isActiveReferee, findActiveRefereeRow } from '../referee.service.js';
import { toRefereeRequestDto } from '../../mappers/refereeRequest.mapper.js';
import * as NotificationService from '../notification.service.js';

const mockedReqRepo = vi.mocked(ReqRepo);
const mockedRefRepo = vi.mocked(RefRepo);
const mockedMatchRefRepo = vi.mocked(MatchRefRepo);
const mockedMatchRepo = vi.mocked(MatchRepo);
const mockedAssertSchedulable = vi.mocked(assertSchedulable);
const mockedIsActiveReferee = vi.mocked(isActiveReferee);
const mockedFindActiveRefereeRow = vi.mocked(findActiveRefereeRow);
const mockedToDto = vi.mocked(toRefereeRequestDto);
const mockedNotify = vi.mocked(NotificationService.notify);
const mockedNotifyUsers = vi.mocked(NotificationService.notifyUsers);

const HOUR = 3_600_000;
const future = (ms: number) => new Date(Date.now() + ms);
const past = (ms: number) => new Date(Date.now() - ms);

function makeReferee(overrides: Record<string, unknown> = {}) {
  return {
    tournament_referee_id: 1,
    tournament_id: 10,
    user_id: 100,
    removed_at: null,
    ...overrides,
  } as any;
}

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    match_id: 1,
    tournament_id: 10,
    match_status: 'scheduled',
    scheduled_time: future(HOUR),
    scheduled_end_time: future(2 * HOUR),
    ...overrides,
  } as any;
}

function makeRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    request_id: 500,
    tournament_id: 10,
    request_type: 'ref_transfer',
    requested_by: 100,
    referee_a_id: 1,
    referee_b_id: 2,
    match_a_id: 1,
    match_b_id: null,
    a_status: 'accepted',
    b_status: 'pending',
    request_status: 'open',
    created_at: new Date(),
    resolved_at: null,
    ...overrides,
  } as any;
}

/** Wires MatchRefRepo.findByTournamentReferees so acceptedMatchesOf(id) returns the given accepted match ids. */
function mockAccepted(map: Record<number, number[]>) {
  mockedMatchRefRepo.findByTournamentReferees.mockImplementation(async (ids: number[]) => {
    const id = ids[0]!;
    return (map[id] ?? []).map((matchId) => ({
      tournament_referee_id: id,
      match_id: matchId,
      assignment_status: 'accepted',
    })) as any;
  });
}

/** Wires MatchRepo.findById to answer from a fixed set of matches, keyed by match_id. */
function mockMatches(...matches: ReturnType<typeof makeMatch>[]) {
  mockedMatchRepo.findById.mockImplementation(async (id: number) => matches.find((m) => m.match_id === id) ?? null);
}

/** Wires RefRepo.findById to answer from a fixed set of referees, keyed by tournament_referee_id. */
function mockReferees(...referees: ReturnType<typeof makeReferee>[]) {
  mockedRefRepo.findById.mockImplementation(async (id: number) =>
    referees.find((r) => r.tournament_referee_id === id) ?? null,
  );
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) — clearAllMocks only wipes call history and
  // leaves queued mockResolvedValueOnce() values in place, which leaked between
  // tests whenever a prior test threw before consuming a queued value.
  vi.resetAllMocks();
  // Sane happy-path defaults; individual tests override to force a branch.
  mockedIsActiveReferee.mockReturnValue(true);
  mockedAssertSchedulable.mockImplementation(() => {});
  mockedReqRepo.existsOpenFor.mockResolvedValue(false);
  mockedReqRepo.create.mockResolvedValue(500);
  mockedReqRepo.findListRowById.mockResolvedValue({ request_id: 500 } as any);
  mockedToDto.mockReturnValue({ id: 500 } as any);
});

// ───────────────────────────── createRefRequest (FR01) ─────────────────────────────

describe('createRefRequest', () => {
  const input = { myMatchId: 1, toTournamentRefereeId: 2 };

  it('throws MATCH_NOT_FOUND when myMatchId does not exist', async () => {
    mockedMatchRepo.findById.mockResolvedValue(null);

    await expect(createRefRequest(100, input)).rejects.toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
    expect(mockedFindActiveRefereeRow).not.toHaveBeenCalled();
  });

  // ไม่มีแถวเลย · ถูกถอดไปแล้ว · ยังไม่ active — ทั้งสามรวมอยู่ใน findActiveRefereeRow ที่คืน null
  it('throws NOT_TOURNAMENT_REFEREE when the caller has no usable referee row', async () => {
    mockMatches(makeMatch());
    mockedFindActiveRefereeRow.mockResolvedValue(null);

    await expect(createRefRequest(100, input)).rejects.toMatchObject({ status: 403, code: 'NOT_TOURNAMENT_REFEREE' });
  });

  it('throws REFEREE_NOT_FOUND when the target referee is in a different tournament', async () => {
    mockMatches(makeMatch());
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1 }));
    mockReferees(makeReferee({ tournament_referee_id: 2, tournament_id: 999 }));

    await expect(createRefRequest(100, input)).rejects.toMatchObject({ status: 404, code: 'REFEREE_NOT_FOUND' });
  });

  it('throws REFEREE_NOT_ACTIVE when the target referee has not accepted / is not yet admin-approved', async () => {
    mockMatches(makeMatch());
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1 }));
    mockReferees(makeReferee({ tournament_referee_id: 2 }));
    // เดิมต้องตอบ true ให้แถวของตัวเองก่อน แล้ว false ให้เป้าหมาย — ตอนนี้แถวของตัวเอง
    // ไปอยู่ใน findActiveRefereeRow แล้ว isActiveReferee จึงถูกเรียกเฉพาะกับเป้าหมาย
    mockedIsActiveReferee.mockReturnValueOnce(false);

    await expect(createRefRequest(100, input)).rejects.toMatchObject({ status: 409, code: 'REFEREE_NOT_ACTIVE' });
  });

  it('throws SAME_REFEREE when transferring/swapping with yourself', async () => {
    mockMatches(makeMatch());
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1 }));
    mockReferees(makeReferee({ tournament_referee_id: 1 }));

    await expect(createRefRequest(100, { ...input, toTournamentRefereeId: 1 })).rejects.toMatchObject({
      status: 400,
      code: 'SAME_REFEREE',
    });
  });

  it('throws REFEREE_NOT_ASSIGNED when the caller is not currently assigned to their own match', async () => {
    mockMatches(makeMatch());
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1 }));
    mockReferees(makeReferee({ tournament_referee_id: 2 }));
    mockAccepted({ 1: [] }); // caller has nothing accepted

    await expect(createRefRequest(100, input)).rejects.toMatchObject({ status: 409, code: 'REFEREE_NOT_ASSIGNED' });
  });

  it.each([
    ['match_status is not scheduled', makeMatch({ match_status: 'in_progress' })],
    ['scheduled_time is missing', makeMatch({ scheduled_time: null })],
    ['scheduled_end_time is missing', makeMatch({ scheduled_end_time: null })],
    ['the match already started', makeMatch({ scheduled_time: past(HOUR) })],
  ])('throws MATCH_NOT_CHANGEABLE when %s', async (_label, myMatch) => {
    mockMatches(myMatch);
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1 }));
    mockReferees(makeReferee({ tournament_referee_id: 2 }));
    mockAccepted({ 1: [1] });

    await expect(createRefRequest(100, input)).rejects.toMatchObject({ status: 409, code: 'MATCH_NOT_CHANGEABLE' });
  });

  it('throws SAME_MATCH when swapping a match with itself', async () => {
    mockMatches(makeMatch());
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1 }));
    mockReferees(makeReferee({ tournament_referee_id: 2 }));
    mockAccepted({ 1: [1] });

    await expect(createRefRequest(100, { ...input, theirMatchId: 1 })).rejects.toMatchObject({
      status: 400,
      code: 'SAME_MATCH',
    });
  });

  it('throws MATCH_NOT_FOUND when theirMatchId is not in the same tournament', async () => {
    mockMatches(makeMatch({ match_id: 1 }), makeMatch({ match_id: 2, tournament_id: 999 }));
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1 }));
    mockReferees(makeReferee({ tournament_referee_id: 2 }));
    mockAccepted({ 1: [1] });

    await expect(createRefRequest(100, { ...input, theirMatchId: 2 })).rejects.toMatchObject({
      status: 404,
      code: 'MATCH_NOT_FOUND',
    });
  });

  it('throws REFEREE_NOT_ASSIGNED when the other referee is not assigned to theirMatchId', async () => {
    mockMatches(makeMatch({ match_id: 1 }), makeMatch({ match_id: 2 }));
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1 }));
    mockReferees(makeReferee({ tournament_referee_id: 2 }));
    mockAccepted({ 1: [1], 2: [] }); // b has nothing accepted

    await expect(createRefRequest(100, { ...input, theirMatchId: 2 })).rejects.toMatchObject({
      status: 409,
      code: 'REFEREE_NOT_ASSIGNED',
    });
  });

  it('throws REQUEST_ALREADY_OPEN when a duplicate open request already exists', async () => {
    mockMatches(makeMatch());
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1 }));
    mockReferees(makeReferee({ tournament_referee_id: 2 }));
    mockAccepted({ 1: [1] });
    mockedReqRepo.existsOpenFor.mockResolvedValue(true);

    await expect(createRefRequest(100, input)).rejects.toMatchObject({ status: 409, code: 'REQUEST_ALREADY_OPEN' });
    expect(mockedReqRepo.create).not.toHaveBeenCalled();
  });

  it('propagates a schedule-conflict AppError from assertSchedulable', async () => {
    mockMatches(makeMatch());
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1 }));
    mockReferees(makeReferee({ tournament_referee_id: 2 }));
    mockAccepted({ 1: [1], 2: [] });
    mockedAssertSchedulable.mockImplementationOnce(() => {
      throw Object.assign(new Error('conflict'), { status: 409, code: 'REFEREE_TIME_CONFLICT' });
    });

    await expect(createRefRequest(100, input)).rejects.toMatchObject({ status: 409, code: 'REFEREE_TIME_CONFLICT' });
    expect(mockedReqRepo.create).not.toHaveBeenCalled();
  });

  it('creates a ref_transfer request (no theirMatchId) and notifies the target referee', async () => {
    mockMatches(makeMatch({ match_id: 1 }));
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1, user_id: 100 }));
    mockReferees(makeReferee({ tournament_referee_id: 2, user_id: 200 }));
    mockAccepted({ 1: [1] });

    const result = await createRefRequest(100, input);

    expect(mockedReqRepo.create).toHaveBeenCalledWith({
      tournamentId: 10,
      type: 'ref_transfer',
      requestedBy: 100,
      refereeAId: 1,
      refereeBId: 2,
      matchAId: 1,
      matchBId: null,
      aStatus: 'accepted',
      bStatus: 'pending',
    });
    expect(mockedNotify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 200, type: 'referee_change_request', relatedEntityId: 1 }),
    );
    expect(result).toEqual({ id: 500 });
  });

  it('creates a ref_swap request (with theirMatchId) and checks conflicts for both sides', async () => {
    mockMatches(makeMatch({ match_id: 1 }), makeMatch({ match_id: 2 }));
    mockedFindActiveRefereeRow.mockResolvedValue(makeReferee({ tournament_referee_id: 1, user_id: 100 }));
    mockReferees(makeReferee({ tournament_referee_id: 2, user_id: 200 }));
    mockAccepted({ 1: [1], 2: [2] });

    await createRefRequest(100, { ...input, theirMatchId: 2 });

    expect(mockedReqRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ref_swap', matchAId: 1, matchBId: 2 }),
    );
    // conflict check runs for both referees when swapping (unlike org_add_match's single check)
    expect(mockedAssertSchedulable).toHaveBeenCalledTimes(2);
  });
});

// ───────────────────────────── createOrgAddMatch (FR02) ─────────────────────────────

describe('createOrgAddMatch', () => {
  const input = { tournamentRefereeId: 1, matchId: 1 };

  it('throws REFEREE_ALREADY_ASSIGNED when the referee already has this match', async () => {
    mockReferees(makeReferee({ tournament_referee_id: 1 }));
    mockMatches(makeMatch());
    mockAccepted({ 1: [1] });

    await expect(createOrgAddMatch(10, 999, input)).rejects.toMatchObject({
      status: 409,
      code: 'REFEREE_ALREADY_ASSIGNED',
    });
    expect(mockedReqRepo.create).not.toHaveBeenCalled();
  });

  it('throws REQUEST_ALREADY_OPEN when a duplicate open request exists', async () => {
    mockReferees(makeReferee({ tournament_referee_id: 1 }));
    mockMatches(makeMatch());
    mockAccepted({ 1: [] });
    mockedReqRepo.existsOpenFor.mockResolvedValue(true);

    await expect(createOrgAddMatch(10, 999, input)).rejects.toMatchObject({
      status: 409,
      code: 'REQUEST_ALREADY_OPEN',
    });
  });

  it('creates an org_add_match request and notifies the referee', async () => {
    mockReferees(makeReferee({ tournament_referee_id: 1, user_id: 100 }));
    mockMatches(makeMatch());
    mockAccepted({ 1: [] });

    const result = await createOrgAddMatch(10, 999, input);

    expect(mockedReqRepo.create).toHaveBeenCalledWith({
      tournamentId: 10,
      type: 'org_add_match',
      requestedBy: 999,
      refereeAId: 1,
      refereeBId: null,
      matchAId: 1,
      matchBId: null,
      aStatus: 'pending',
      bStatus: 'not_required',
    });
    expect(mockedNotify).toHaveBeenCalledWith(expect.objectContaining({ userId: 100 }));
    expect(result).toEqual({ id: 500 });
  });
});

// ───────────────────────────── createOrgSwap (FR03) ─────────────────────────────

describe('createOrgSwap', () => {
  const input = { refereeAId: 1, matchAId: 1, refereeBId: 2, matchBId: 2 };

  it('throws SAME_REFEREE when refereeAId === refereeBId', async () => {
    await expect(createOrgSwap(10, 999, { ...input, refereeBId: 1 })).rejects.toMatchObject({
      status: 400,
      code: 'SAME_REFEREE',
    });
    expect(mockedRefRepo.findById).not.toHaveBeenCalled();
  });

  it('throws SAME_MATCH when matchAId === matchBId', async () => {
    await expect(createOrgSwap(10, 999, { ...input, matchBId: 1 })).rejects.toMatchObject({
      status: 400,
      code: 'SAME_MATCH',
    });
  });

  it('throws REFEREE_NOT_ASSIGNED when referee A is not assigned to matchA', async () => {
    mockReferees(makeReferee({ tournament_referee_id: 1 }), makeReferee({ tournament_referee_id: 2 }));
    mockMatches(makeMatch({ match_id: 1 }), makeMatch({ match_id: 2 }));
    mockAccepted({ 1: [], 2: [2] });

    await expect(createOrgSwap(10, 999, input)).rejects.toMatchObject({ status: 409, code: 'REFEREE_NOT_ASSIGNED' });
  });

  it('only checks for a duplicate open request against referee A / matchA (not B)', async () => {
    mockReferees(makeReferee({ tournament_referee_id: 1 }), makeReferee({ tournament_referee_id: 2 }));
    mockMatches(makeMatch({ match_id: 1 }), makeMatch({ match_id: 2 }));
    mockAccepted({ 1: [1], 2: [2] });

    await createOrgSwap(10, 999, input);

    expect(mockedReqRepo.existsOpenFor).toHaveBeenCalledTimes(1);
    expect(mockedReqRepo.existsOpenFor).toHaveBeenCalledWith(1, 1);
  });

  it('creates an org_swap request and notifies both referees via notifyUsers', async () => {
    mockReferees(
      makeReferee({ tournament_referee_id: 1, user_id: 100 }),
      makeReferee({ tournament_referee_id: 2, user_id: 200 }),
    );
    mockMatches(makeMatch({ match_id: 1 }), makeMatch({ match_id: 2 }));
    mockAccepted({ 1: [1], 2: [2] });

    const result = await createOrgSwap(10, 999, input);

    expect(mockedReqRepo.create).toHaveBeenCalledWith({
      tournamentId: 10,
      type: 'org_swap',
      requestedBy: 999,
      refereeAId: 1,
      refereeBId: 2,
      matchAId: 1,
      matchBId: 2,
      aStatus: 'pending',
      bStatus: 'pending',
    });
    expect(mockedNotifyUsers).toHaveBeenCalledWith([100, 200], expect.objectContaining({ type: 'referee_change_request' }));
    expect(result).toEqual({ id: 500 });
  });
});

// ───────────────────────────── listMyRequests / listTournamentRequests ─────────────────────────────

describe('listMyRequests', () => {
  it('maps incoming and outgoing rows independently', async () => {
    const incomingRow = makeRequestRow({ request_id: 1 });
    const outgoingRow = makeRequestRow({ request_id: 2 });
    mockedReqRepo.findPendingForUser.mockResolvedValue([incomingRow]);
    mockedReqRepo.findCreatedByUser.mockResolvedValue([outgoingRow]);
    mockedToDto.mockImplementation((r: any) => ({ id: r.request_id }));

    const result = await listMyRequests(100);

    expect(mockedReqRepo.findPendingForUser).toHaveBeenCalledWith(100);
    expect(mockedReqRepo.findCreatedByUser).toHaveBeenCalledWith(100);
    expect(result).toEqual({ incoming: [{ id: 1 }], outgoing: [{ id: 2 }] });
  });

  it('returns empty arrays when there is nothing pending or created', async () => {
    mockedReqRepo.findPendingForUser.mockResolvedValue([]);
    mockedReqRepo.findCreatedByUser.mockResolvedValue([]);

    const result = await listMyRequests(100);

    expect(result).toEqual({ incoming: [], outgoing: [] });
  });
});

describe('listTournamentRequests', () => {
  it('passes an undefined status through unchanged', async () => {
    mockedReqRepo.findByTournament.mockResolvedValue([]);

    await listTournamentRequests(10);

    expect(mockedReqRepo.findByTournament).toHaveBeenCalledWith(10, undefined);
  });

  it('filters by status and maps the rows', async () => {
    mockedReqRepo.findByTournament.mockResolvedValue([makeRequestRow()]);
    mockedToDto.mockReturnValue({ id: 500 } as any);

    const result = await listTournamentRequests(10, 'open');

    expect(mockedReqRepo.findByTournament).toHaveBeenCalledWith(10, 'open');
    expect(result).toEqual({ items: [{ id: 500 }] });
  });
});

// ───────────────────────────── respondToRequest (FR06/FR07) ─────────────────────────────

describe('respondToRequest', () => {
  it('throws REQUEST_NOT_FOUND when the request does not exist', async () => {
    mockedReqRepo.findById.mockResolvedValue(null);

    await expect(respondToRequest(500, 100, 'accepted')).rejects.toMatchObject({
      status: 404,
      code: 'REQUEST_NOT_FOUND',
    });
  });

  it('throws REQUEST_CLOSED when the request is no longer open', async () => {
    mockedReqRepo.findById.mockResolvedValue(makeRequestRow({ request_status: 'applied' }));

    await expect(respondToRequest(500, 100, 'accepted')).rejects.toMatchObject({
      status: 409,
      code: 'REQUEST_CLOSED',
    });
  });

  it('throws NOT_YOUR_REQUEST when the user is neither side, or is a side that already answered', async () => {
    mockedReqRepo.findById.mockResolvedValue(makeRequestRow({ a_status: 'accepted', b_status: 'pending' }));
    mockReferees(
      makeReferee({ tournament_referee_id: 1, user_id: 100 }), // side a, but already 'accepted' not 'pending'
      makeReferee({ tournament_referee_id: 2, user_id: 200 }),
    );

    await expect(respondToRequest(500, 999, 'accepted')).rejects.toMatchObject({
      status: 403,
      code: 'NOT_YOUR_REQUEST',
    });
  });

  it('throws REQUEST_CLOSED (via answerSide race) when the side was answered concurrently', async () => {
    const req = makeRequestRow({ referee_b_id: 2, b_status: 'pending' });
    mockedReqRepo.findById.mockResolvedValue(req);
    mockReferees(makeReferee({ tournament_referee_id: 1, user_id: 100 }), makeReferee({ tournament_referee_id: 2, user_id: 200 }));
    mockedReqRepo.answerSide.mockResolvedValue(false);

    await expect(respondToRequest(500, 200, 'accepted')).rejects.toMatchObject({ status: 409, code: 'REQUEST_CLOSED' });
  });

  it('on decline: records the answer, closes the request, notifies the requester, and returns the dto', async () => {
    const req = makeRequestRow({ referee_b_id: 2, b_status: 'pending', requested_by: 100, match_a_id: 1 });
    mockedReqRepo.findById.mockResolvedValue(req);
    mockReferees(makeReferee({ tournament_referee_id: 1, user_id: 100 }), makeReferee({ tournament_referee_id: 2, user_id: 200 }));
    mockedReqRepo.answerSide.mockResolvedValue(true);
    mockedReqRepo.close.mockResolvedValue(true);

    const result = await respondToRequest(500, 200, 'declined');

    expect(mockedReqRepo.answerSide).toHaveBeenCalledWith(500, 'b', 'declined');
    expect(mockedReqRepo.close).toHaveBeenCalledWith(500, 'declined');
    expect(mockedNotify).toHaveBeenCalledWith(expect.objectContaining({ userId: 100, relatedEntityId: 1 }));
    expect(mockedReqRepo.apply).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 500 });
  });

  it('on accept when the other side is still pending: does not apply and does not send the "success" notification', async () => {
    const req = makeRequestRow({ referee_b_id: 2, a_status: 'pending', b_status: 'pending' });
    mockedReqRepo.findById
      .mockResolvedValueOnce(req) // loadOpenRequest
      .mockResolvedValueOnce({ ...req, a_status: 'accepted', b_status: 'pending' } as any); // fresh re-fetch
    mockReferees(makeReferee({ tournament_referee_id: 1, user_id: 100 }), makeReferee({ tournament_referee_id: 2, user_id: 200 }));
    mockedReqRepo.answerSide.mockResolvedValue(true);

    await respondToRequest(500, 100, 'accepted');

    expect(mockedReqRepo.apply).not.toHaveBeenCalled();
    expect(mockedNotify).not.toHaveBeenCalled();
  });

  it('on accept when both sides are now done: applies the change and sends the referee_assigned notification', async () => {
    const req = makeRequestRow({
      request_type: 'ref_transfer',
      referee_a_id: 1,
      referee_b_id: 2,
      match_a_id: 1,
      match_b_id: null,
      a_status: 'accepted',
      b_status: 'pending',
      requested_by: 100,
    });
    const freshReq = { ...req, b_status: 'accepted' };
    mockedReqRepo.findById
      .mockResolvedValueOnce(req) // loadOpenRequest
      .mockResolvedValueOnce(freshReq as any); // fresh re-fetch for the all-done check
    mockReferees(makeReferee({ tournament_referee_id: 1, user_id: 100 }), makeReferee({ tournament_referee_id: 2, user_id: 200 }));
    mockedReqRepo.answerSide.mockResolvedValue(true);
    // revalidate() for a ref_transfer needs both referees + matchA loadable and unassigned-conflict-free:
    mockMatches(makeMatch({ match_id: 1 }));
    mockAccepted({ 1: [1], 2: [] });
    mockedReqRepo.apply.mockResolvedValue(true);

    const result = await respondToRequest(500, 200, 'accepted');

    expect(mockedReqRepo.apply).toHaveBeenCalledWith(freshReq);
    expect(mockedReqRepo.close).not.toHaveBeenCalled(); // only called on the cancel path
    expect(mockedNotify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 100, type: 'referee_assigned', relatedEntityId: 1 }),
    );
    expect(result).toEqual({ id: 500 });
  });

  it('includes the second match in the success message for a swap-type request', async () => {
    const req = makeRequestRow({
      request_type: 'ref_swap',
      referee_a_id: 1,
      referee_b_id: 2,
      match_a_id: 1,
      match_b_id: 2,
      a_status: 'accepted',
      b_status: 'pending', // side b (user 200) is the one about to answer
      requested_by: 100,
    });
    const freshReq = { ...req, b_status: 'accepted' };
    mockedReqRepo.findById.mockResolvedValueOnce(req).mockResolvedValueOnce(freshReq);
    mockReferees(makeReferee({ tournament_referee_id: 1, user_id: 100 }), makeReferee({ tournament_referee_id: 2, user_id: 200 }));
    mockedReqRepo.answerSide.mockResolvedValue(true);
    mockMatches(makeMatch({ match_id: 1 }), makeMatch({ match_id: 2 }));
    mockAccepted({ 1: [1], 2: [2] });
    mockedReqRepo.apply.mockResolvedValue(true);

    await respondToRequest(500, 200, 'accepted');

    expect(mockedNotify).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('#1') }),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('#2') }),
    );
  });

  it('cancels the request with REQUEST_NO_LONGER_VALID when revalidation fails (e.g. the referee is no longer active)', async () => {
    const req = makeRequestRow({
      request_type: 'ref_transfer',
      referee_a_id: 1,
      referee_b_id: 2,
      match_a_id: 1,
      a_status: 'accepted',
      b_status: 'pending', // side b (user 200) is the one about to answer
    });
    const freshReq = { ...req, b_status: 'accepted' };
    mockedReqRepo.findById.mockResolvedValueOnce(req).mockResolvedValueOnce(freshReq);
    mockReferees(makeReferee({ tournament_referee_id: 1, user_id: 100 }), makeReferee({ tournament_referee_id: 2, user_id: 200 }));
    mockedReqRepo.answerSide.mockResolvedValue(true);
    mockMatches(makeMatch({ match_id: 1 }));
    // referee A is no longer active by the time everyone has answered
    mockedIsActiveReferee.mockReturnValue(false);
    mockedReqRepo.close.mockResolvedValue(true);

    await expect(respondToRequest(500, 200, 'accepted')).rejects.toMatchObject({
      status: 409,
      code: 'REQUEST_NO_LONGER_VALID',
    });
    expect(mockedReqRepo.close).toHaveBeenCalledWith(500, 'cancelled');
    expect(mockedReqRepo.apply).not.toHaveBeenCalled();
  });

  it('cancels the request with REQUEST_NO_LONGER_VALID when apply() reports the underlying data changed', async () => {
    const req = makeRequestRow({
      request_type: 'org_add_match',
      referee_a_id: 1,
      referee_b_id: null,
      match_a_id: 1,
      a_status: 'pending', // side a (user 100) is the one about to answer
      b_status: 'not_required',
    });
    const freshReq = { ...req, a_status: 'accepted' };
    mockedReqRepo.findById.mockResolvedValueOnce(req).mockResolvedValueOnce(freshReq);
    mockReferees(makeReferee({ tournament_referee_id: 1, user_id: 100 }));
    mockedReqRepo.answerSide.mockResolvedValue(true);
    mockMatches(makeMatch({ match_id: 1 }));
    mockAccepted({ 1: [] });
    mockedReqRepo.apply.mockResolvedValue(false); // DB state moved on since the request was created
    mockedReqRepo.close.mockResolvedValue(true);

    await expect(respondToRequest(500, 100, 'accepted')).rejects.toMatchObject({
      status: 409,
      code: 'REQUEST_NO_LONGER_VALID',
    });
    expect(mockedReqRepo.close).toHaveBeenCalledWith(500, 'cancelled');
  });

  it('lets a non-AppError from apply()/revalidate() propagate untouched, without closing the request', async () => {
    const req = makeRequestRow({
      request_type: 'org_add_match',
      referee_a_id: 1,
      referee_b_id: null,
      match_a_id: 1,
      a_status: 'pending', // side a (user 100) is the one about to answer
      b_status: 'not_required',
    });
    const freshReq = { ...req, a_status: 'accepted' };
    mockedReqRepo.findById.mockResolvedValueOnce(req).mockResolvedValueOnce(freshReq);
    mockReferees(makeReferee({ tournament_referee_id: 1, user_id: 100 }));
    mockedReqRepo.answerSide.mockResolvedValue(true);
    mockMatches(makeMatch({ match_id: 1 }));
    mockAccepted({ 1: [] });
    const dbError = new Error('connection lost');
    mockedReqRepo.apply.mockRejectedValue(dbError);

    await expect(respondToRequest(500, 100, 'accepted')).rejects.toBe(dbError);
    expect(mockedReqRepo.close).not.toHaveBeenCalled();
  });
});

// ───────────────────────────── cancelRequest (FR08) ─────────────────────────────

describe('cancelRequest', () => {
  it('throws REQUEST_NOT_FOUND when the request does not exist', async () => {
    mockedReqRepo.findById.mockResolvedValue(null);

    await expect(cancelRequest(500, 100)).rejects.toMatchObject({ status: 404, code: 'REQUEST_NOT_FOUND' });
  });

  it('throws REQUEST_CLOSED when the request is not open', async () => {
    mockedReqRepo.findById.mockResolvedValue(makeRequestRow({ request_status: 'cancelled' }));

    await expect(cancelRequest(500, 100)).rejects.toMatchObject({ status: 409, code: 'REQUEST_CLOSED' });
  });

  it('throws NOT_YOUR_REQUEST when the caller did not create the request', async () => {
    mockedReqRepo.findById.mockResolvedValue(makeRequestRow({ requested_by: 100 }));

    await expect(cancelRequest(500, 999)).rejects.toMatchObject({ status: 403, code: 'NOT_YOUR_REQUEST' });
    expect(mockedReqRepo.close).not.toHaveBeenCalled();
  });

  it('closes the request as cancelled and returns nothing when the caller owns it', async () => {
    mockedReqRepo.findById.mockResolvedValue(makeRequestRow({ requested_by: 100 }));
    mockedReqRepo.close.mockResolvedValue(true);

    const result = await cancelRequest(500, 100);

    expect(mockedReqRepo.close).toHaveBeenCalledWith(500, 'cancelled');
    expect(result).toBeUndefined();
  });
});
