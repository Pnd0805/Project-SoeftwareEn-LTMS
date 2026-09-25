import { describe, it, expect } from 'vitest';
import { toTournamentListDto, toTournamentDetailDto } from '../tournament.mapper.js';
import type { TournamentRow } from '../../types/db.js';
import type { UserRefDto } from '../user.mapper.js';

// ---------- fixtures ----------

const REG_START = new Date('2026-04-01T00:00:00.000Z');
const REG_END = new Date('2026-04-30T16:59:59.000Z');
const COMPLETED_AT = new Date('2026-05-20T18:00:00.000Z');

function makeRow(overrides: Partial<TournamentRow> = {}): TournamentRow {
    return {
        tournament_id: 100,
        name: 'Faculty Cup 2026',
        description: 'Annual inter-faculty tournament',
        entry_notes: null,
        sport_type_id: 3,
        bracket_format: 'single_elimination',
        scope_type: 'faculty',
        organizing_faculty_id: 7,
        organizing_department_id: null,
        requested_by_user_id: 21,
        organizer_external_approval_status: 'not_required',
        organizer_external_reviewed_by: null,
        organizer_external_reviewed_at: null,
        organizer_external_rejection_reason: null,
        organizer_external_verification_docs: null,
        tournament_status: 'public',
        registration_open: 1,
        registration_start: REG_START,
        registration_end: REG_END,
        event_start_date: '2026-05-10',
        event_end_date: '2026-05-17',
        max_teams: 16,
        min_teams: 4,
        venue: 'Main Gym',
        dispute_window_hours: 24,
        gender_requirement: 'any',
        min_age: 18,
        max_age: 30,
        rejection_reason: null,
        approved_by: 2,
        approved_at: new Date('2026-03-25T00:00:00.000Z'),
        champion_team_id: null,
        completed_at: null,
        completed_by: null,
        created_at: new Date('2026-03-20T00:00:00.000Z'),
        updated_at: null,
        updated_by: null,
        deleted_at: null,
        deleted_by: null,
        ...overrides,
    };
}

const ORGANIZER: UserRefDto = { id: 21, fullName: 'Organizer One', avatarUrl: 'avatars/21.jpg' };

// ---------- toTournamentListDto ----------

describe('toTournamentListDto', () => {
    it('maps DB columns to DTO fields', () => {
        expect(toTournamentListDto(makeRow())).toEqual({
            id: 100,
            name: 'Faculty Cup 2026',
            sportTypeId: 3,
            eventStartDate: '2026-05-10',
            eventEndDate: '2026-05-17',
            registrationOpen: true,
            venue: 'Main Gym',
            organizingFacultyId: 7,
        });
    });

    it('converts registration_open 1 to true and 0 to false', () => {
        expect(toTournamentListDto(makeRow({ registration_open: 1 })).registrationOpen).toBe(true);
        expect(toTournamentListDto(makeRow({ registration_open: 0 })).registrationOpen).toBe(false);
    });

    it('keeps nullable fields as null', () => {
        const dto = toTournamentListDto(makeRow({ event_end_date: null, venue: null, organizing_faculty_id: null }));

        expect(dto.eventEndDate).toBeNull();
        expect(dto.venue).toBeNull();
        expect(dto.organizingFacultyId).toBeNull();
    });

    it('accepts a Pick of only the columns it needs', () => {
        const dto = toTournamentListDto({
            tournament_id: 5,
            name: 'Mini',
            sport_type_id: 1,
            event_start_date: '2026-06-01',
            event_end_date: null,
            registration_open: 0,
            venue: null,
            organizing_faculty_id: null,
        });

        expect(dto.id).toBe(5);
        expect(dto.registrationOpen).toBe(false);
    });

    it('does not expose entryNotes, championTeamId or completedAt (detail-only fields)', () => {
        const dto = toTournamentListDto(
            makeRow({ entry_notes: 'bring student ID', champion_team_id: 11, completed_at: COMPLETED_AT }),
        );

        expect(Object.keys(dto)).not.toContain('entryNotes');
        expect(Object.keys(dto)).not.toContain('championTeamId');
        expect(Object.keys(dto)).not.toContain('completedAt');
    });

    it('returns only the documented keys', () => {
        expect(Object.keys(toTournamentListDto(makeRow())).sort()).toEqual(
            ['eventEndDate', 'eventStartDate', 'id', 'name', 'organizingFacultyId', 'registrationOpen', 'sportTypeId', 'venue'].sort(),
        );
    });

    it('does not mutate the input row', () => {
        const row = makeRow();
        const snapshot = structuredClone(row);

        toTournamentListDto(row);

        expect(row).toEqual(snapshot);
    });
});

// ---------- toTournamentDetailDto ----------

describe('toTournamentDetailDto', () => {
    it('maps DB columns and the extra arguments to DTO fields', () => {
        expect(toTournamentDetailDto(makeRow(), ORGANIZER, 12)).toEqual({
            id: 100,
            name: 'Faculty Cup 2026',
            description: 'Annual inter-faculty tournament',
            entryNotes: null,
            sportTypeId: 3,
            bracketFormat: 'single_elimination',
            scopeType: 'faculty',
            organizingFacultyId: 7,
            organizingDepartmentId: null,
            status: 'public',
            registrationOpen: true,
            registrationStart: '2026-04-01T00:00:00.000Z',
            registrationEnd: '2026-04-30T16:59:59.000Z',
            eventStartDate: '2026-05-10',
            eventEndDate: '2026-05-17',
            maxTeams: 16,
            minTeams: 4,
            venue: 'Main Gym',
            genderRequirement: 'any',
            minAge: 18,
            maxAge: 30,
            organizer: ORGANIZER,
            approvedTeamCount: 12,
            championTeamId: null,
            completedAt: null,
        });
    });

    describe('entryNotes', () => {
        it('passes a real note through unchanged, including Thai text', () => {
            const dto = toTournamentDetailDto(
                makeRow({ entry_notes: 'กรุณานำบัตรนิสิตมาแสดง' }),
                ORGANIZER,
                0,
            );

            expect(dto.entryNotes).toBe('กรุณานำบัตรนิสิตมาแสดง');
        });

        it('keeps entryNotes null when the tournament has none', () => {
            expect(toTournamentDetailDto(makeRow({ entry_notes: null }), ORGANIZER, 0).entryNotes).toBeNull();
        });
    });

    describe('championTeamId', () => {
        it('is null for a tournament that has not completed', () => {
            const dto = toTournamentDetailDto(
                makeRow({ tournament_status: 'public', champion_team_id: null }),
                ORGANIZER,
                0,
            );

            expect(dto.championTeamId).toBeNull();
        });

        it('passes the champion team id through for a completed tournament', () => {
            const dto = toTournamentDetailDto(
                makeRow({ tournament_status: 'completed', champion_team_id: 11 }),
                ORGANIZER,
                0,
            );

            expect(dto.championTeamId).toBe(11);
        });

        it('stays null for a completed tournament with no champion (e.g. double forfeit final)', () => {
            const dto = toTournamentDetailDto(
                makeRow({ tournament_status: 'completed', champion_team_id: null }),
                ORGANIZER,
                0,
            );

            expect(dto.championTeamId).toBeNull();
        });
    });

    describe('completedAt', () => {
        it('converts a Date to an ISO string', () => {
            const dto = toTournamentDetailDto(makeRow({ completed_at: COMPLETED_AT }), ORGANIZER, 0);

            expect(dto.completedAt).toBe('2026-05-20T18:00:00.000Z');
        });

        it('keeps null as null for a tournament not yet completed', () => {
            expect(toTournamentDetailDto(makeRow({ completed_at: null }), ORGANIZER, 0).completedAt).toBeNull();
        });

        it('keeps millisecond precision', () => {
            const dto = toTournamentDetailDto(
                makeRow({ completed_at: new Date('2026-05-20T18:00:00.123Z') }),
                ORGANIZER,
                0,
            );

            expect(dto.completedAt).toBe('2026-05-20T18:00:00.123Z');
        });

        it('throws a RangeError when completed_at is an invalid Date', () => {
            expect(() => toTournamentDetailDto(makeRow({ completed_at: new Date('nope') }), ORGANIZER, 0)).toThrow(
                RangeError,
            );
        });
    });

    it('renames tournament_status to status', () => {
        expect(toTournamentDetailDto(makeRow({ tournament_status: 'pending_approval' }), ORGANIZER, 0).status).toBe(
            'pending_approval',
        );
    });

    it.each(['pending_approval', 'rejected', 'private', 'public', 'completed', 'auto_deleted'] as const)(
        "passes tournament_status '%s' through",
        (status) => {
            expect(toTournamentDetailDto(makeRow({ tournament_status: status }), ORGANIZER, 0).status).toBe(status);
        },
    );

    it.each(['single_elimination', 'double_elimination', 'round_robin', null] as const)(
        'passes bracket_format %s through',
        (format) => {
            expect(toTournamentDetailDto(makeRow({ bracket_format: format }), ORGANIZER, 0).bracketFormat).toBe(format);
        },
    );

    it.each(['department', 'faculty', 'university'] as const)("passes scope_type '%s' through", (scope) => {
        expect(toTournamentDetailDto(makeRow({ scope_type: scope }), ORGANIZER, 0).scopeType).toBe(scope);
    });

    it.each(['any', 'male', 'female'] as const)("passes gender_requirement '%s' through", (gender) => {
        expect(toTournamentDetailDto(makeRow({ gender_requirement: gender }), ORGANIZER, 0).genderRequirement).toBe(
            gender,
        );
    });

    it('converts registration_open to a boolean', () => {
        expect(toTournamentDetailDto(makeRow({ registration_open: 1 }), ORGANIZER, 0).registrationOpen).toBe(true);
        expect(toTournamentDetailDto(makeRow({ registration_open: 0 }), ORGANIZER, 0).registrationOpen).toBe(false);
    });

    describe('registration dates (toIso)', () => {
        it('converts Date values to ISO strings', () => {
            const dto = toTournamentDetailDto(makeRow(), ORGANIZER, 0);

            expect(dto.registrationStart).toBe('2026-04-01T00:00:00.000Z');
            expect(dto.registrationEnd).toBe('2026-04-30T16:59:59.000Z');
        });

        it('keeps null as null', () => {
            const dto = toTournamentDetailDto(
                makeRow({ registration_start: null, registration_end: null }),
                ORGANIZER,
                0,
            );

            expect(dto.registrationStart).toBeNull();
            expect(dto.registrationEnd).toBeNull();
        });

        it('handles one date set and the other null', () => {
            const dto = toTournamentDetailDto(makeRow({ registration_end: null }), ORGANIZER, 0);

            expect(dto.registrationStart).toBe('2026-04-01T00:00:00.000Z');
            expect(dto.registrationEnd).toBeNull();
        });

        it('throws a RangeError when registration_start is an invalid Date', () => {
            expect(() =>
                toTournamentDetailDto(makeRow({ registration_start: new Date('nope') }), ORGANIZER, 0),
            ).toThrow(RangeError);
        });

        it('throws a RangeError when registration_end is an invalid Date', () => {
            expect(() =>
                toTournamentDetailDto(makeRow({ registration_end: new Date('nope') }), ORGANIZER, 0),
            ).toThrow(RangeError);
        });
    });

    it('keeps event dates as the same date strings', () => {
        const dto = toTournamentDetailDto(makeRow({ event_start_date: '2026-12-31', event_end_date: null }), ORGANIZER, 0);

        expect(dto.eventStartDate).toBe('2026-12-31');
        expect(dto.eventEndDate).toBeNull();
    });

    it('keeps nullable fields as null', () => {
        const dto = toTournamentDetailDto(
            makeRow({
                description: null,
                bracket_format: null,
                organizing_faculty_id: null,
                organizing_department_id: null,
                venue: null,
                min_age: null,
                max_age: null,
            }),
            ORGANIZER,
            0,
        );

        expect(dto.description).toBeNull();
        expect(dto.bracketFormat).toBeNull();
        expect(dto.organizingFacultyId).toBeNull();
        expect(dto.organizingDepartmentId).toBeNull();
        expect(dto.venue).toBeNull();
        expect(dto.minAge).toBeNull();
        expect(dto.maxAge).toBeNull();
    });

    it('keeps age bounds of 0 rather than treating them as missing', () => {
        const dto = toTournamentDetailDto(makeRow({ min_age: 0, max_age: 0 }), ORGANIZER, 0);

        expect(dto.minAge).toBe(0);
        expect(dto.maxAge).toBe(0);
    });

    it('uses the organizer argument as given', () => {
        const other: UserRefDto = { id: 99, fullName: 'Someone Else', avatarUrl: null };

        expect(toTournamentDetailDto(makeRow(), other, 0).organizer).toBe(other);
    });

    it('uses the approvedTeamCount argument, including 0', () => {
        expect(toTournamentDetailDto(makeRow(), ORGANIZER, 0).approvedTeamCount).toBe(0);
        expect(toTournamentDetailDto(makeRow(), ORGANIZER, 16).approvedTeamCount).toBe(16);
    });

    it('does not expose internal or admin-only columns', () => {
        const dto = toTournamentDetailDto(
            makeRow({
                rejection_reason: 'n/a',
                approved_by: 2,
                requested_by_user_id: 21,
                dispute_window_hours: 48,
                organizer_external_verification_docs: ['doc1'],
                deleted_by: 3,
                completed_by: 2,
            }),
            ORGANIZER,
            0,
        );
        const json = JSON.stringify(dto);

        for (const leaked of [
            'rejection_reason',
            'rejectionReason',
            'approved_by',
            'approvedBy',
            'requested_by_user_id',
            'requestedBy',
            'dispute_window_hours',
            'disputeWindowHours',
            'organizer_external',
            'deleted',
            'created_at',
            'createdAt',
            'completed_by',
            'completedBy',
        ]) {
            expect(json).not.toContain(leaked);
        }
    });

    it('returns exactly the documented keys', () => {
        expect(Object.keys(toTournamentDetailDto(makeRow(), ORGANIZER, 0)).sort()).toEqual(
            [
                'approvedTeamCount',
                'bracketFormat',
                'championTeamId',
                'completedAt',
                'description',
                'entryNotes',
                'eventEndDate',
                'eventStartDate',
                'genderRequirement',
                'id',
                'maxAge',
                'maxTeams',
                'minAge',
                'minTeams',
                'name',
                'organizer',
                'organizingDepartmentId',
                'organizingFacultyId',
                'registrationEnd',
                'registrationOpen',
                'registrationStart',
                'scopeType',
                'sportTypeId',
                'status',
                'venue',
            ].sort(),
        );
    });

    it('does not mutate the input row or the organizer', () => {
        const row = makeRow({ champion_team_id: 11, completed_at: COMPLETED_AT });
        const organizer: UserRefDto = { ...ORGANIZER };
        const rowSnapshot = structuredClone(row);
        const organizerSnapshot = structuredClone(organizer);

        toTournamentDetailDto(row, organizer, 3);

        expect(row).toEqual(rowSnapshot);
        expect(organizer).toEqual(organizerSnapshot);
    });
});
