import { describe, expect, it } from 'vitest';
import { toCareerTournamentDto } from '../career.mapper.js';

describe('toCareerTournamentDto', () => {
  it('maps a tournament career row and normalizes aggregate numbers', () => {
    const dto = toCareerTournamentDto({
      tournament_id: 12,
      tournament_name: 'KU Cup',
      sport_type_id: 2,
      tournament_status: 'completed',
      team_id: 7,
      team_name: 'Blue',
      played: '5' as any,
      wins: '3' as any,
      losses: '2' as any,
      champion: 1,
    });

    expect(dto).toEqual({
      tournament: { id: 12, name: 'KU Cup', sportTypeId: 2, status: 'completed' },
      team: { id: 7, name: 'Blue' },
      played: 5,
      wins: 3,
      losses: 2,
      champion: true,
    });
  });
});
