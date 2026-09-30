import { describe, expect, it } from 'vitest';
import { toMatchHistoryDto } from '../matchHistory.mapper.js';

describe('matchHistory.mapper', () => {
    it('maps a verified match with opponent, result, timestamps and player stats', () => {
        const dto = toMatchHistoryDto({
            match_id: 10,
            round_number: 2,
            scheduled_time: new Date('2026-09-20T08:00:00Z'),
            started_at: new Date('2026-09-20T08:05:00Z'),
            actual_end_time: new Date('2026-09-20T09:00:00Z'),
            venue: 'Gym A',
            mode: 'onsite',
            tournament_id: 3,
            tournament_name: 'KU Cup',
            sport_type_id: 1,
            my_team_id: 5,
            my_team_name: 'Blue',
            opponent_team_id: 6,
            opponent_team_name: 'Red',
            winner_team_id: 5,
            score_data: { teamA: 2, teamB: 1 },
            verified_at: new Date('2026-09-20T09:10:00Z'),
        }, [{ match_id: 10, stat_key: 'goals', stat_label_th: 'เธเธฃเธฐเธ•เธน', value_int: 2 }]);

        expect(dto).toMatchObject({
            matchId: 10,
            team: { id: 5, name: 'Blue' },
            opponent: { id: 6, name: 'Red' },
            result: 'win',
            playedAt: '2026-09-20T09:00:00.000Z',
            playerStats: [{ statKey: 'goals', statLabelTh: 'เธเธฃเธฐเธ•เธน', value: 2 }],
        });
    });
});
