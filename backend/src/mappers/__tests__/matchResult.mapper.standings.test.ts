import { describe, it, expect } from 'vitest';
import { rankStandings, type StandingSource } from '../matchResult.mapper.js';

const row = (o: Partial<StandingSource> & { team_id: number }): StandingSource =>
  ({ name: `T${o.team_id}`, sport_type_id: 1, played: 0, won: 0, lost: 0, points: 0, goals_for: 0, goals_against: 0, ...o });

// B3 (21 ก.ย.) — tie-break ก: แต้ม → ผลต่างประตู → ประตูได้ → ชนะ · เสมอทุกเกณฑ์ = อันดับเท่ากัน
describe('rankStandings', () => {
  it('gives equal rank to teams level on every criterion and skips the next rank', () => {
    const rows = [
      row({ team_id: 1, points: 6, won: 2, goals_for: 5, goals_against: 2 }),
      row({ team_id: 2, points: 6, won: 2, goals_for: 5, goals_against: 2 }),
      row({ team_id: 3, points: 6, won: 2, goals_for: 4, goals_against: 2 }),
      row({ team_id: 4, points: 0, won: 0, goals_for: 1, goals_against: 9 }),
    ];
    expect(rankStandings(rows).map(s => [s.team.id, s.rank])).toEqual([[1, 1], [2, 1], [3, 3], [4, 4]]);
  });

  it('exposes points, goals and goal difference', () => {
    const [s] = rankStandings([row({ team_id: 7, played: 3, won: 2, lost: 1, points: 6, goals_for: 7, goals_against: 4 })]);
    expect(s).toMatchObject({ played: 3, wins: 2, losses: 1, points: 6, goalsFor: 7, goalsAgainst: 4, goalDiff: 3, rank: 1 });
  });
});
