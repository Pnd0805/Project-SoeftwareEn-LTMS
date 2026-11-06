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

  // --- added cases ---

  it('unsettled result_status (submitted/disputed/rejected) hides the score even when a winner is already recorded', () => {
    for (const status of ['submitted', 'disputed', 'rejected'] as const) {
      const s = toMatchResultSummary(row({ result_status: status, result_winner_team_id: 10 }));
      expect(s.score).toBeNull();
    }
  });

  it('completed with an unsettled result_status → outcome is void, not played (not yet verified)', () => {
    const s = toMatchResultSummary(row({ result_status: 'disputed', result_winner_team_id: 10 }));
    expect(s.outcome).toEqual({ kind: 'void', winnerTeamId: null, loserTeamId: null });
  });

  it('walkover where team_a is the empty slot (bye for team B)', () => {
    const s = toMatchResultSummary(row({ team_a_id: null, result_status: 'walkover', result_winner_team_id: 11, result_score: null }));
    expect(s.outcome).toEqual({ kind: 'bye', winnerTeamId: 11, loserTeamId: null });
  });

  it('verified with a winner not matching either team_a_id or team_b_id → loser resolves to team_a_id (only branch tested against the winner)', () => {
    // The mapper compares only against team_a_id; any winner other than team_a_id treats team_a_id as "the other side".
    const s = toMatchResultSummary(row({ team_a_id: 10, team_b_id: 11, result_winner_team_id: 99 }));
    expect(s.outcome).toEqual({ kind: 'played', winnerTeamId: 99, loserTeamId: 10 });
  });

  it('always passes nextMatchId and loserNextMatchId through, regardless of match_status', () => {
    const scheduled = toMatchResultSummary(row({ match_status: 'scheduled', next_match_id: 7, loser_next_match_id: 8 }));
    const completed = toMatchResultSummary(row({ match_status: 'completed', next_match_id: 7, loser_next_match_id: 8 }));

    expect(scheduled.nextMatchId).toBe(7);
    expect(scheduled.loserNextMatchId).toBe(8);
    expect(completed.nextMatchId).toBe(7);
    expect(completed.loserNextMatchId).toBe(8);
  });

  it('keeps nextMatchId and loserNextMatchId null for a final-round match', () => {
    const s = toMatchResultSummary(row({ next_match_id: null, loser_next_match_id: null }));
    expect(s.nextMatchId).toBeNull();
    expect(s.loserNextMatchId).toBeNull();
  });

  it.each(['scheduled', 'checkin_open', 'in_progress', 'disputed', 'result_rejected'] as const)(
    "outcome is null for any non-completed match_status ('%s')",
    (status) => {
      const s = toMatchResultSummary(row({ match_status: status }));
      expect(s.outcome).toBeNull();
    },
  );

  it('returns exactly the documented keys', () => {
    expect(Object.keys(toMatchResultSummary(row())).sort()).toEqual([
      'loserNextMatchId',
      'nextMatchId',
      'outcome',
      'resultStatus',
      'score',
    ]);
  });

  it('does not mutate the input row', () => {
    const input = row();
    const snapshot = structuredClone(input);

    toMatchResultSummary(input);

    expect(input).toEqual(snapshot);
  });
});
