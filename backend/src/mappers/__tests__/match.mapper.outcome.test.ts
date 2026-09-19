import { describe, it, expect } from 'vitest';
import { toMatchResultSummary } from '../match.mapper.js';

// B5 + outcome (19 ก.ย.) — สรุปผลบนแถวแมตช์ให้หน้าสายวาดช่องว่างถูก
function row(over: Partial<Parameters<typeof toMatchResultSummary>[0]> = {}) {
  return {
    match_status: 'completed' as const, team_a_id: 10, team_b_id: 11,
    next_match_id: 9, loser_next_match_id: null,
    result_status: 'verified' as const, result_winner_team_id: 10, result_score: { '10': 2, '11': 1 },
    ...over,
  };
}

describe('toMatchResultSummary', () => {
  it('unfinished match: passes bracket links and result status, no outcome, no score until settled', () => {
    const s = toMatchResultSummary(row({ match_status: 'in_progress', result_status: 'submitted' }));
    expect(s).toEqual({ nextMatchId: 9, loserNextMatchId: null, resultStatus: 'submitted', score: null, outcome: null });
  });

  it('verified → played with winner/loser and the score', () => {
    const s = toMatchResultSummary(row());
    expect(s.score).toEqual({ '10': 2, '11': 1 });
    expect(s.outcome).toEqual({ kind: 'played', winnerTeamId: 10, loserTeamId: 11 });
  });

  it('walkover with both teams present (withdrawal / no-show) → walkover', () => {
    const s = toMatchResultSummary(row({ result_status: 'walkover', result_winner_team_id: 11, result_score: { '11': 3, '10': 0 } }));
    expect(s.outcome).toEqual({ kind: 'walkover', winnerTeamId: 11, loserTeamId: 10 });
  });

  it('walkover with the other slot empty (dead slot) → bye, no loser', () => {
    const s = toMatchResultSummary(row({ team_b_id: null, result_status: 'walkover', result_winner_team_id: 10, result_score: null }));
    expect(s.outcome).toEqual({ kind: 'bye', winnerTeamId: 10, loserTeamId: null });
  });

  it('walkover with no winner (double forfeit / both withdrawn) → void', () => {
    const s = toMatchResultSummary(row({ result_status: 'walkover', result_winner_team_id: null, result_score: null }));
    expect(s.outcome).toEqual({ kind: 'void', winnerTeamId: null, loserTeamId: null });
  });

  it('completed with no result at all (dead match) → void', () => {
    const s = toMatchResultSummary(row({ team_a_id: null, team_b_id: null, result_status: null, result_winner_team_id: null, result_score: null }));
    expect(s.resultStatus).toBeNull();
    expect(s.outcome).toEqual({ kind: 'void', winnerTeamId: null, loserTeamId: null });
  });
});
