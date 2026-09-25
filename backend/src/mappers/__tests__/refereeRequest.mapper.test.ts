import { describe, it, expect } from 'vitest';
import { toRefereeRequestDto } from '../refereeRequest.mapper.js';
import type { RefereeRequestListRow } from '../../repositories/refereeChangeRequest.repo.js';

// ---------- fixtures ----------

const MA_START = new Date('2026-06-01T09:00:00.000Z');
const MA_END = new Date('2026-06-01T10:00:00.000Z');
const MB_START = new Date('2026-06-02T13:00:00.000Z');
const MB_END = new Date('2026-06-02T14:00:00.000Z');
const CREATED = new Date('2026-05-20T08:00:00.000Z');
const RESOLVED = new Date('2026-05-21T09:30:00.000Z');

// A swap request: both referees and both matches present.
function makeRow(overrides: Partial<RefereeRequestListRow> = {}): RefereeRequestListRow {
    return {
        // referee_change_requests columns
        request_id: 900,
        tournament_id: 100,
        request_type: 'ref_swap',
        requested_by: 21,
        referee_a_id: 31,
        referee_b_id: 32,
        match_a_id: 1,
        match_b_id: 2,
        a_status: 'accepted',
        b_status: 'pending',
        request_status: 'open',
        created_at: CREATED,
        resolved_at: null,
        // joined columns
        a_user_id: 41,
        a_full_name: 'Anong Referee',
        a_profile_image_key: 'avatars/41.jpg',
        b_user_id: 42,
        b_full_name: 'Boonmee Referee',
        b_profile_image_key: 'avatars/42.jpg',
        ma_round_number: 1,
        ma_scheduled_time: MA_START,
        ma_scheduled_end_time: MA_END,
        mb_round_number: 2,
        mb_scheduled_time: MB_START,
        mb_scheduled_end_time: MB_END,
        ...overrides,
    };
}

// An org_add_match request: only referee A and match A exist.
function makeSingleSideRow(overrides: Partial<RefereeRequestListRow> = {}): RefereeRequestListRow {
    return makeRow({
        request_type: 'org_add_match',
        referee_b_id: null,
        match_b_id: null,
        a_status: 'pending',
        b_status: 'not_required',
        b_user_id: null,
        b_full_name: null,
        b_profile_image_key: null,
        mb_round_number: null,
        mb_scheduled_time: null,
        mb_scheduled_end_time: null,
        ...overrides,
    });
}

// ---------- tests ----------

describe('toRefereeRequestDto', () => {
    describe('full swap request', () => {
        it('maps every field to the DTO', () => {
            expect(toRefereeRequestDto(makeRow())).toEqual({
                id: 900,
                tournamentId: 100,
                type: 'ref_swap',
                requestedBy: 21,
                refereeA: {
                    tournamentRefereeId: 31,
                    user: { id: 41, fullName: 'Anong Referee', avatarUrl: 'avatars/41.jpg' },
                    status: 'accepted',
                },
                refereeB: {
                    tournamentRefereeId: 32,
                    user: { id: 42, fullName: 'Boonmee Referee', avatarUrl: 'avatars/42.jpg' },
                    status: 'pending',
                },
                matchA: {
                    id: 1,
                    roundNumber: 1,
                    scheduledTime: '2026-06-01T09:00:00.000Z',
                    scheduledEndTime: '2026-06-01T10:00:00.000Z',
                },
                matchB: {
                    id: 2,
                    roundNumber: 2,
                    scheduledTime: '2026-06-02T13:00:00.000Z',
                    scheduledEndTime: '2026-06-02T14:00:00.000Z',
                },
                status: 'open',
                createdAt: '2026-05-20T08:00:00.000Z',
                resolvedAt: null,
            });
        });

        it('returns only the documented top-level keys', () => {
            expect(Object.keys(toRefereeRequestDto(makeRow())).sort()).toEqual(
                [
                    'createdAt',
                    'id',
                    'matchA',
                    'matchB',
                    'refereeA',
                    'refereeB',
                    'requestedBy',
                    'resolvedAt',
                    'status',
                    'tournamentId',
                    'type',
                ].sort(),
            );
        });

        it('does not leak the joined a_/b_/ma_/mb_ columns or raw request columns', () => {
            const dto = toRefereeRequestDto(makeRow());
            const json = JSON.stringify(dto);

            for (const leaked of [
                'request_id',
                'a_user_id',
                'a_full_name',
                'b_full_name',
                'a_profile_image_key',
                'ma_scheduled_time',
                'mb_round_number',
                'referee_a_id',
                'match_a_id',
            ]) {
                expect(json).not.toContain(leaked);
            }
        });
    });

    describe('refereeA', () => {
        it('nests the user built by toUserRef', () => {
            const dto = toRefereeRequestDto(makeRow());

            expect(dto.refereeA.user).toEqual({ id: 41, fullName: 'Anong Referee', avatarUrl: 'avatars/41.jpg' });
        });

        it('keeps avatarUrl null when the referee has no profile image', () => {
            expect(toRefereeRequestDto(makeRow({ a_profile_image_key: null })).refereeA.user.avatarUrl).toBeNull();
        });

        it.each(['not_required', 'pending', 'accepted', 'declined'] as const)("passes a_status '%s' through", (status) => {
            expect(toRefereeRequestDto(makeRow({ a_status: status })).refereeA.status).toBe(status);
        });
    });

    describe('refereeB', () => {
        it('is null when referee_b_id is null', () => {
            expect(toRefereeRequestDto(makeSingleSideRow()).refereeB).toBeNull();
        });

        it('is null when b_user_id is null even if referee_b_id is set', () => {
            expect(toRefereeRequestDto(makeRow({ b_user_id: null })).refereeB).toBeNull();
        });

        it('is null when referee_b_id is null even if b_user_id is set', () => {
            expect(toRefereeRequestDto(makeRow({ referee_b_id: null })).refereeB).toBeNull();
        });

        it('falls back to an empty fullName when b_full_name is null', () => {
            const dto = toRefereeRequestDto(makeRow({ b_full_name: null }));

            expect(dto.refereeB).not.toBeNull();
            expect(dto.refereeB?.user.fullName).toBe('');
        });

        it('keeps avatarUrl null when b_profile_image_key is null', () => {
            expect(toRefereeRequestDto(makeRow({ b_profile_image_key: null })).refereeB?.user.avatarUrl).toBeNull();
        });

        it.each(['not_required', 'pending', 'accepted', 'declined'] as const)("passes b_status '%s' through", (status) => {
            expect(toRefereeRequestDto(makeRow({ b_status: status })).refereeB?.status).toBe(status);
        });

        it('uses referee_b_id as tournamentRefereeId', () => {
            expect(toRefereeRequestDto(makeRow({ referee_b_id: 77 })).refereeB?.tournamentRefereeId).toBe(77);
        });
    });

    describe('matchA', () => {
        it('formats the schedule as ISO strings', () => {
            const dto = toRefereeRequestDto(makeRow());

            expect(dto.matchA.scheduledTime).toBe('2026-06-01T09:00:00.000Z');
            expect(dto.matchA.scheduledEndTime).toBe('2026-06-01T10:00:00.000Z');
        });

        it('keeps scheduledTime and scheduledEndTime null when the match is unscheduled', () => {
            const dto = toRefereeRequestDto(makeRow({ ma_scheduled_time: null, ma_scheduled_end_time: null }));

            expect(dto.matchA.scheduledTime).toBeNull();
            expect(dto.matchA.scheduledEndTime).toBeNull();
        });

        it('handles a scheduled start with no end time', () => {
            const dto = toRefereeRequestDto(makeRow({ ma_scheduled_end_time: null }));

            expect(dto.matchA.scheduledTime).toBe('2026-06-01T09:00:00.000Z');
            expect(dto.matchA.scheduledEndTime).toBeNull();
        });

        it('keeps roundNumber null when the match has no round', () => {
            expect(toRefereeRequestDto(makeRow({ ma_round_number: null })).matchA.roundNumber).toBeNull();
        });

        it('uses match_a_id as the id', () => {
            expect(toRefereeRequestDto(makeRow({ match_a_id: 55 })).matchA.id).toBe(55);
        });
    });

    describe('matchB', () => {
        it('is null when match_b_id is null', () => {
            expect(toRefereeRequestDto(makeSingleSideRow()).matchB).toBeNull();
        });

        it('is built from the mb_ columns when match_b_id is set', () => {
            const dto = toRefereeRequestDto(makeRow());

            expect(dto.matchB).toEqual({
                id: 2,
                roundNumber: 2,
                scheduledTime: '2026-06-02T13:00:00.000Z',
                scheduledEndTime: '2026-06-02T14:00:00.000Z',
            });
        });

        it('keeps its schedule and round null when they are unset', () => {
            const dto = toRefereeRequestDto(
                makeRow({ mb_round_number: null, mb_scheduled_time: null, mb_scheduled_end_time: null }),
            );

            expect(dto.matchB).toEqual({ id: 2, roundNumber: null, scheduledTime: null, scheduledEndTime: null });
        });

        it('does not mix up match A and match B data', () => {
            const dto = toRefereeRequestDto(makeRow());

            expect(dto.matchA.id).not.toBe(dto.matchB?.id);
            expect(dto.matchA.scheduledTime).not.toBe(dto.matchB?.scheduledTime);
        });
    });

    describe('request type and status', () => {
        it.each(['org_add_match', 'ref_transfer', 'ref_swap', 'org_swap'] as const)("passes request_type '%s' through", (type) => {
            expect(toRefereeRequestDto(makeRow({ request_type: type })).type).toBe(type);
        });

        it.each(['open', 'applied', 'declined', 'cancelled'] as const)("passes request_status '%s' through", (status) => {
            expect(toRefereeRequestDto(makeRow({ request_status: status })).status).toBe(status);
        });
    });

    describe('single-referee request (org_add_match)', () => {
        it('has refereeA and matchA but null refereeB and matchB', () => {
            const dto = toRefereeRequestDto(makeSingleSideRow());

            expect(dto.type).toBe('org_add_match');
            expect(dto.refereeA.tournamentRefereeId).toBe(31);
            expect(dto.matchA.id).toBe(1);
            expect(dto.refereeB).toBeNull();
            expect(dto.matchB).toBeNull();
        });
    });

    describe('timestamps', () => {
        it('formats createdAt as an ISO string', () => {
            expect(toRefereeRequestDto(makeRow()).createdAt).toBe('2026-05-20T08:00:00.000Z');
        });

        it('keeps resolvedAt null for an open request', () => {
            expect(toRefereeRequestDto(makeRow({ resolved_at: null })).resolvedAt).toBeNull();
        });

        it('formats resolvedAt as an ISO string once resolved', () => {
            expect(toRefereeRequestDto(makeRow({ request_status: 'applied', resolved_at: RESOLVED })).resolvedAt).toBe(
                '2026-05-21T09:30:00.000Z',
            );
        });

        it('keeps millisecond precision', () => {
            expect(toRefereeRequestDto(makeRow({ created_at: new Date('2026-05-20T08:00:00.123Z') })).createdAt).toBe(
                '2026-05-20T08:00:00.123Z',
            );
        });
    });

    describe('invalid dates', () => {
        const bad = new Date('not a date');

        it('throws a RangeError when created_at is invalid', () => {
            expect(() => toRefereeRequestDto(makeRow({ created_at: bad }))).toThrow(RangeError);
        });

        it('throws a RangeError when resolved_at is invalid', () => {
            expect(() => toRefereeRequestDto(makeRow({ resolved_at: bad }))).toThrow(RangeError);
        });

        it('throws a RangeError when a match A schedule date is invalid', () => {
            expect(() => toRefereeRequestDto(makeRow({ ma_scheduled_time: bad }))).toThrow(RangeError);
            expect(() => toRefereeRequestDto(makeRow({ ma_scheduled_end_time: bad }))).toThrow(RangeError);
        });

        it('throws a RangeError when a match B schedule date is invalid', () => {
            expect(() => toRefereeRequestDto(makeRow({ mb_scheduled_time: bad }))).toThrow(RangeError);
            expect(() => toRefereeRequestDto(makeRow({ mb_scheduled_end_time: bad }))).toThrow(RangeError);
        });
    });

    it('does not mutate the input row', () => {
        const row = makeRow({ resolved_at: RESOLVED });
        const snapshot = structuredClone(row);

        toRefereeRequestDto(row);

        expect(row).toEqual(snapshot);
    });

    it('works with Array.prototype.map for a list of rows', () => {
        const rows = [makeRow({ request_id: 1 }), makeSingleSideRow({ request_id: 2 })];

        const dtos = rows.map(toRefereeRequestDto);

        expect(dtos.map((d) => d.id)).toEqual([1, 2]);
        expect(dtos[1]?.refereeB).toBeNull();
    });
});
