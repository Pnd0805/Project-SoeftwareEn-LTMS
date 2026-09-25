import { describe, it, expect } from 'vitest';
import {
    toSubmittedResultDto,
    toVerifiedResultDto,
    toDisputeResultDto,
    toResolveResultDto,
    toVerifiedResult,
    toPlayerMatchStat,
    toTournamentWinnerDto,
} from '../matchResult.mapper.js';
import type { MatchResultRow } from '../../types/db.js';
import type { playerStat } from '../../repositories/matchResult.repo.js';
import type { TeamRef } from '../team.mapper.js';

// ---------- fixtures ----------

const VERIFIED_AT = new Date('2026-05-10T11:00:00.000Z');
const AMENDED_AT = new Date('2026-05-11T09:15:30.250Z');

function makeResultRow(overrides: Partial<MatchResultRow> = {}): MatchResultRow {
    return {
        match_result_id: 500,
        match_id: 1,
        winner_team_id: 11,
        score_data: { team_a: 21, team_b: 15 },
        submitted_by_user_id: 9,
        submitted_role: 'referee',
        match_result_status: 'submitted',
        dispute_reason: null,
        dispute_raised_by: null,
        dispute_raised_at: null,
        dispute_resolved_by: null,
        dispute_resolution: null,
        dispute_resolved_at: null,
        verified_by_user_id: null,
        verified_at: null,
        amended_by_user_id: null,
        amend_reason: null,
        amended_at: null,
        created_at: new Date('2026-05-10T10:30:00.000Z'),
        ...overrides,
    };
}

const LIONS: TeamRef = { id: 11, name: 'Lions', sportTypeId: 3 };
const TIGERS: TeamRef = { id: 12, name: 'Tigers', sportTypeId: 3 };

// ---------- toSubmittedResultDto ----------

describe('toSubmittedResultDto', () => {
    it('maps DB columns to DTO fields', () => {
        expect(toSubmittedResultDto(makeResultRow())).toEqual({
            id: 500,
            matchId: 1,
            status: 'submitted',
            submittedBy: 9,
        });
    });

    it.each(['submitted', 'verified', 'disputed', 'rejected', 'walkover'] as const)(
        "passes status '%s' through unchanged",
        (status) => {
            expect(toSubmittedResultDto(makeResultRow({ match_result_status: status })).status).toBe(status);
        },
    );

    it('returns only the documented keys (no score or dispute data leaks)', () => {
        const dto = toSubmittedResultDto(makeResultRow({ dispute_reason: 'wrong score', dispute_raised_by: 4 }));

        expect(Object.keys(dto).sort()).toEqual(['id', 'matchId', 'status', 'submittedBy']);
    });

    it('does not mutate the input row', () => {
        const row = makeResultRow();
        const snapshot = structuredClone(row);

        toSubmittedResultDto(row);

        expect(row).toEqual(snapshot);
    });
});

// ---------- toVerifiedResultDto ----------

describe('toVerifiedResultDto', () => {
    it('combines the match result and the next match id', () => {
        expect(
            toVerifiedResultDto(
                { match_id: 1, match_result_status: 'verified', winner_team_id: 11 },
                { next_match_id: 5 },
            ),
        ).toEqual({
            matchId: 1,
            status: 'verified',
            winnerTeamId: 11,
            nextMatchId: 5,
        });
    });

    it('keeps nextMatchId null for the final match', () => {
        const dto = toVerifiedResultDto(
            { match_id: 1, match_result_status: 'verified', winner_team_id: 11 },
            { next_match_id: null },
        );

        expect(dto.nextMatchId).toBeNull();
    });

    it('keeps winnerTeamId null when there is no winner', () => {
        const dto = toVerifiedResultDto(
            { match_id: 1, match_result_status: 'verified', winner_team_id: null },
            { next_match_id: 5 },
        );

        expect(dto.winnerTeamId).toBeNull();
    });

    it('works with full rows too and ignores their extra fields', () => {
        const dto = toVerifiedResultDto(makeResultRow({ match_result_status: 'verified' }), { next_match_id: 8 });

        expect(Object.keys(dto).sort()).toEqual(['matchId', 'nextMatchId', 'status', 'winnerTeamId']);
    });
});

// ---------- toDisputeResultDto ----------

describe('toDisputeResultDto', () => {
    it('returns matchId and status only', () => {
        const dto = toDisputeResultDto(
            makeResultRow({
                match_result_status: 'disputed',
                dispute_reason: 'score mismatch',
                dispute_raised_by: 4,
                dispute_raised_at: new Date('2026-05-10T12:00:00.000Z'),
            }),
        );

        expect(dto).toEqual({ matchId: 1, status: 'disputed' });
    });
});

// ---------- toResolveResultDto ----------

describe('toResolveResultDto', () => {
    it.each(['verified', 'rejected'] as const)("maps status '%s' with isAmended defaulted to false", (status) => {
        expect(toResolveResultDto({ match_id: 3, match_result_status: status })).toEqual({
            matchId: 3,
            status,
            isAmended: false,
        });
    });

    it('sets isAmended true when amended is explicitly true', () => {
        const dto = toResolveResultDto({ match_id: 3, match_result_status: 'verified', amended: true });

        expect(dto.isAmended).toBe(true);
    });

    it('sets isAmended false when amended is explicitly false', () => {
        const dto = toResolveResultDto({ match_id: 3, match_result_status: 'verified', amended: false });

        expect(dto.isAmended).toBe(false);
    });

    it('defaults isAmended to false when amended is omitted entirely', () => {
        const dto = toResolveResultDto({ match_id: 3, match_result_status: 'rejected' });

        expect(dto.isAmended).toBe(false);
    });

    it('returns exactly matchId, status and isAmended', () => {
        expect(
            Object.keys(toResolveResultDto({ match_id: 3, match_result_status: 'verified', amended: true })).sort(),
        ).toEqual(['isAmended', 'matchId', 'status']);
    });
});

// ---------- toVerifiedResult ----------

describe('toVerifiedResult', () => {
    it('maps a verified, never-amended result', () => {
        const dto = toVerifiedResult(
            makeResultRow({
                match_result_status: 'verified',
                verified_at: VERIFIED_AT,
            }),
        );

        expect(dto).toEqual({
            matchId: 1,
            winnerTeamId: 11,
            scoreData: { team_a: 21, team_b: 15 },
            isAmended: false,
            amendedAt: null,
            amendReason: null,
            isWalkover: false,
            status: 'verified',
            verifiedAt: '2026-05-10T11:00:00.000Z',
        });
    });

    it('marks isAmended true and formats amendedAt when amended_at is set', () => {
        const dto = toVerifiedResult(
            makeResultRow({
                match_result_status: 'verified',
                verified_at: VERIFIED_AT,
                amended_at: AMENDED_AT,
                amended_by_user_id: 2,
                amend_reason: 'typo in score',
            }),
        );

        expect(dto.isAmended).toBe(true);
        expect(dto.amendedAt).toBe('2026-05-11T09:15:30.250Z');
        expect(dto.amendReason).toBe('typo in score');
    });

    it('sets isAmended false only when amended_at is null (amend_reason alone does not count)', () => {
        const dto = toVerifiedResult(makeResultRow({ amended_at: null, amend_reason: 'leftover reason' }));

        expect(dto.isAmended).toBe(false);
        expect(dto.amendedAt).toBeNull();
    });

    it('keeps verifiedAt null when verified_at is null', () => {
        expect(toVerifiedResult(makeResultRow({ verified_at: null })).verifiedAt).toBeNull();
    });

    it('sets isWalkover true only for the "walkover" status', () => {
        expect(toVerifiedResult(makeResultRow({ match_result_status: 'walkover' })).isWalkover).toBe(true);

        for (const status of ['submitted', 'verified', 'disputed', 'rejected'] as const) {
            expect(toVerifiedResult(makeResultRow({ match_result_status: status })).isWalkover).toBe(false);
        }
    });

    it.each(['submitted', 'verified', 'disputed', 'rejected', 'walkover'] as const)(
        "passes match_result_status '%s' through as status",
        (status) => {
            expect(toVerifiedResult(makeResultRow({ match_result_status: status })).status).toBe(status);
        },
    );

    it('passes scoreData through, including null (walkover has no real score)', () => {
        expect(toVerifiedResult(makeResultRow({ score_data: null })).scoreData).toBeNull();
        expect(toVerifiedResult(makeResultRow({ score_data: { a: 3, b: 0 } })).scoreData).toEqual({ a: 3, b: 0 });
    });

    it('keeps winnerTeamId null when the DB value is null', () => {
        expect(toVerifiedResult(makeResultRow({ winner_team_id: null })).winnerTeamId).toBeNull();
    });

    it('returns only the documented keys, including status alongside isWalkover', () => {
        expect(Object.keys(toVerifiedResult(makeResultRow())).sort()).toEqual(
            [
                'matchId',
                'winnerTeamId',
                'scoreData',
                'isAmended',
                'amendedAt',
                'amendReason',
                'isWalkover',
                'status',
                'verifiedAt',
            ].sort(),
        );
    });

    it('throws a RangeError when verified_at is an invalid Date', () => {
        expect(() => toVerifiedResult(makeResultRow({ verified_at: new Date('nope') }))).toThrow(RangeError);
    });

    it('throws a RangeError when amended_at is an invalid Date', () => {
        expect(() => toVerifiedResult(makeResultRow({ amended_at: new Date('nope') }))).toThrow(RangeError);
    });

    it('does not mutate the input row', () => {
        const row = makeResultRow({ verified_at: VERIFIED_AT, amended_at: AMENDED_AT });
        const snapshot = structuredClone(row);

        toVerifiedResult(row);

        expect(row).toEqual(snapshot);
    });
});

// ---------- toPlayerMatchStat ----------

describe('toPlayerMatchStat', () => {
    it('combines the user info with the stats list', () => {
        const stats: playerStat[] = [
            { statKey: 'goals', statLabelTh: 'ประตู', value: 2 },
            { statKey: 'assists', statLabelTh: 'แอสซิสต์', value: 1 },
        ];

        expect(toPlayerMatchStat({ userId: 9, fullName: 'Somchai Jaidee' }, stats)).toEqual({
            userId: 9,
            fullName: 'Somchai Jaidee',
            stats,
        });
    });

    it('returns an empty stats array when the player has no stats', () => {
        expect(toPlayerMatchStat({ userId: 9, fullName: 'Somchai Jaidee' }, []).stats).toEqual([]);
    });

    it('keeps null stat values as null', () => {
        const stats: playerStat[] = [{ statKey: 'goals', statLabelTh: 'ประตู', value: null }];

        expect(toPlayerMatchStat({ userId: 9, fullName: 'X' }, stats).stats[0]?.value).toBeNull();
    });

    it('does not copy any extra fields from userInfo', () => {
        const userInfo = { userId: 9, fullName: 'X', email: 'x@example.com' } as { userId: number; fullName: string };

        expect(Object.keys(toPlayerMatchStat(userInfo, [])).sort()).toEqual(['fullName', 'stats', 'userId']);
    });
});

// ---------- toTournamentWinnerDto ----------

describe('toTournamentWinnerDto', () => {
    it('builds the champion, runner-up and summary', () => {
        expect(toTournamentWinnerDto(LIONS, TIGERS, { team_a: 3, team_b: 1 }, '2026-05-10T12:00:00.000Z', false)).toEqual({
            championTeam: LIONS,
            runnerUpTeam: TIGERS,
            summary: {
                finalScore: { team_a: 3, team_b: 1 },
                isWalkover: false,
                completedAt: '2026-05-10T12:00:00.000Z',
            },
        });
    });

    it('defaults isWalkover to false when the argument is omitted', () => {
        const dto = toTournamentWinnerDto(LIONS, TIGERS, null, null);

        expect(dto.summary['isWalkover']).toBe(false);
    });

    it('sets isWalkover true when the final ended by walkover', () => {
        const dto = toTournamentWinnerDto(LIONS, TIGERS, null, '2026-05-10T12:00:00.000Z', true);

        expect(dto.summary['isWalkover']).toBe(true);
    });

    it('allows both teams to be null (double forfeit, no champion)', () => {
        const dto = toTournamentWinnerDto(null, null, null, '2026-05-10T12:00:00.000Z', true);

        expect(dto.championTeam).toBeNull();
        expect(dto.runnerUpTeam).toBeNull();
    });

    it('keeps finalScore and completedAt null when not provided', () => {
        const dto = toTournamentWinnerDto(LIONS, TIGERS, null, null);

        expect(dto.summary['finalScore']).toBeNull();
        expect(dto.summary['completedAt']).toBeNull();
    });

    it('puts exactly finalScore, isWalkover and completedAt in the summary', () => {
        const dto = toTournamentWinnerDto(LIONS, TIGERS, { a: 1 }, '2026-05-10T12:00:00.000Z');

        expect(Object.keys(dto.summary).sort()).toEqual(['completedAt', 'finalScore', 'isWalkover']);
    });

    it('returns only championTeam, runnerUpTeam and summary at the top level', () => {
        const dto = toTournamentWinnerDto(LIONS, TIGERS, null, null);

        expect(Object.keys(dto).sort()).toEqual(['championTeam', 'runnerUpTeam', 'summary']);
    });
});
