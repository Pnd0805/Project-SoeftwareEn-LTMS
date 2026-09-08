import { describe, expect, it } from 'vitest';
import { amendmentRequestSchema, createTournamentSchema, updateTournamentSchema } from '../tournament.schema.js';

const validTournament = {
    name: 'KU Open',
    sportTypeId: 1,
    bracketFormat: 'single_elimination' as const,
    scopeType: 'faculty' as const,
    organizingFacultyId: 1,
    registrationStart: '2026-10-01T00:00:00Z',
    registrationEnd: '2026-10-05T00:00:00Z',
    eventStartDate: '2026-10-10',
    eventEndDate: '2026-10-10',
    maxTeams: 8,
    minTeams: 2,
    venue: 'สนามกีฬา',
    genderRequirement: 'any' as const
};

describe('tournament schemas', () => {
    it('accepts the database bracket enum names', () => {
        const result = createTournamentSchema.safeParse(validTournament);
        expect(result.success).toBe(true);
        expect(updateTournamentSchema.safeParse({ description: 'การแข่งขันประจำปี' }).success).toBe(true);
    });

    it('rejects university scope and missing venue at the request boundary', () => {
        expect(createTournamentSchema.safeParse({ ...validTournament, scopeType: 'university' }).success).toBe(false);
        expect(createTournamentSchema.safeParse({ ...validTournament, venue: '' }).success).toBe(false);
    });

    it('keeps unsupported PATCH fields available to the service allowlist', () => {
        const result = updateTournamentSchema.parse({ eventStartDate: '2026-11-01' });
        expect(result).toMatchObject({ eventStartDate: '2026-11-01' });
        expect(amendmentRequestSchema.safeParse({ requestedChanges: { eventStartDate: '2026-11-01' } }).success).toBe(true);
    });
});
