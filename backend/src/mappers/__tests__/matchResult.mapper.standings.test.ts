import { describe, it, expect } from 'vitest';
import { toStandingDto, rankStandings, type StandingSource } from '../matchResult.mapper.js';

const row = (o: Partial<StandingSource> & { team_id: number }): StandingSource => ({
  name: `T${o.team_id}`,
  sport_type_id: 1,
  played: 0,
  won: 0,
  lost: 0,
  points: 0,
  goals_for: 0,
  goals_against: 0,
  ...o,
});

// ---------- toStandingDto ----------

describe('toStandingDto', () => {
  it('maps DB columns to DTO fields, including a computed goalDiff', () => {
    const dto = toStandingDto(
      row({ team_id: 7, name: 'Lions', sport_type_id: 3, played: 3, won: 2, lost: 1, points: 6, goals_for: 7, goals_against: 4 }),
      1,
    );

    expect(dto).toEqual({
      team: { id: 7, name: 'Lions', sportTypeId: 3 },
      played: 3,
      wins: 2,
      losses: 1,
      points: 6,
      goalsFor: 7,
      goalsAgainst: 4,
      goalDiff: 3,
      rank: 1,
    });
  });

  it('renames won/lost to wins/losses', () => {
    const dto = toStandingDto(row({ team_id: 1, won: 5, lost: 2 }), 1);

    expect(dto.wins).toBe(5);
    expect(dto.losses).toBe(2);
  });

  it('computes a negative goalDiff when goals against exceed goals for', () => {
    const dto = toStandingDto(row({ team_id: 1, goals_for: 2, goals_against: 9 }), 1);

    expect(dto.goalDiff).toBe(-7);
  });

  it('computes a zero goalDiff when goals are level', () => {
    const dto = toStandingDto(row({ team_id: 1, goals_for: 4, goals_against: 4 }), 1);

    expect(dto.goalDiff).toBe(0);
  });

  it('passes the rank argument through as given', () => {
    expect(toStandingDto(row({ team_id: 1 }), 5).rank).toBe(5);
  });

  it('handles a winless, scoreless team (0-0-0)', () => {
    const dto = toStandingDto(row({ team_id: 1, played: 0, won: 0, lost: 0, points: 0, goals_for: 0, goals_against: 0 }), 1);

    expect(dto.wins).toBe(0);
    expect(dto.losses).toBe(0);
    expect(dto.points).toBe(0);
    expect(dto.goalDiff).toBe(0);
  });

  it('does not copy the row name into anything but team.name, and does not leak sport_type_id at the top level', () => {
    const dto = toStandingDto(row({ team_id: 1, name: 'Lions', sport_type_id: 9 }), 1);

    expect(Object.keys(dto).sort()).toEqual(
      ['team', 'played', 'wins', 'losses', 'points', 'goalsFor', 'goalsAgainst', 'goalDiff', 'rank'].sort(),
    );
    expect(Object.keys(dto.team).sort()).toEqual(['id', 'name', 'sportTypeId']);
  });

  it('does not mutate the input row', () => {
    const input = row({ team_id: 1, points: 6, goals_for: 5, goals_against: 2 });
    const snapshot = structuredClone(input);

    toStandingDto(input, 1);

    expect(input).toEqual(snapshot);
  });
});

// B3 (21 ก.ย.) — tie-break ก: แต้ม → ผลต่างประตู → ประตูได้ → ชนะ · เสมอทุกเกณฑ์ = อันดับเท่ากัน
describe('rankStandings', () => {
  it('gives equal rank to teams level on every criterion and skips the next rank', () => {
    const rows = [
      row({ team_id: 1, points: 6, won: 2, goals_for: 5, goals_against: 2 }),
      row({ team_id: 2, points: 6, won: 2, goals_for: 5, goals_against: 2 }),
      row({ team_id: 3, points: 6, won: 2, goals_for: 4, goals_against: 2 }),
      row({ team_id: 4, points: 0, won: 0, goals_for: 1, goals_against: 9 }),
    ];
    expect(rankStandings(rows).map((s) => [s.team.id, s.rank])).toEqual([
      [1, 1],
      [2, 1],
      [3, 3],
      [4, 4],
    ]);
  });

  it('exposes points, goals and goal difference for each standing', () => {
    const [s] = rankStandings([
      row({ team_id: 7, played: 3, won: 2, lost: 1, points: 6, goals_for: 7, goals_against: 4 }),
    ]);
    expect(s).toMatchObject({ played: 3, wins: 2, losses: 1, points: 6, goalsFor: 7, goalsAgainst: 4, goalDiff: 3, rank: 1 });
  });

  it('breaks a points tie by goal difference', () => {
    const rows = [
      row({ team_id: 1, points: 6, goals_for: 8, goals_against: 3 }), // +5
      row({ team_id: 2, points: 6, goals_for: 6, goals_against: 4 }), // +2
    ];
    expect(rankStandings(rows).map((s) => s.team.id)).toEqual([1, 2]);
    expect(rankStandings(rows).map((s) => s.rank)).toEqual([1, 2]);
  });

  it('breaks a points-and-goalDiff tie by goals scored', () => {
    const rows = [
      row({ team_id: 1, points: 6, goals_for: 9, goals_against: 6 }), // +3, 9 scored
      row({ team_id: 2, points: 6, goals_for: 5, goals_against: 2 }), // +3, 5 scored
    ];
    expect(rankStandings(rows).map((s) => s.rank)).toEqual([1, 2]);
  });

  it('breaks a points/goalDiff/goalsFor tie by wins', () => {
    const rows = [
      row({ team_id: 1, points: 5, won: 1, goals_for: 4, goals_against: 4 }),
      row({ team_id: 2, points: 5, won: 0, goals_for: 4, goals_against: 4 }),
    ];
    expect(rankStandings(rows).map((s) => s.rank)).toEqual([1, 2]);
  });

  it('does not use team name to break ties (only for stable ordering)', () => {
    const rows = [
      row({ team_id: 1, name: 'Zebras', points: 6, won: 2, goals_for: 5, goals_against: 2 }),
      row({ team_id: 2, name: 'Antelopes', points: 6, won: 2, goals_for: 5, goals_against: 2 }),
    ];
    // Level on every scored criterion, in any name order, so both get rank 1.
    expect(rankStandings(rows).map((s) => s.rank)).toEqual([1, 1]);
  });

  it('assigns ranks 1..n with no gaps when nobody is tied', () => {
    const rows = [
      row({ team_id: 1, points: 9 }),
      row({ team_id: 2, points: 6 }),
      row({ team_id: 3, points: 3 }),
      row({ team_id: 4, points: 0 }),
    ];
    expect(rankStandings(rows).map((s) => s.rank)).toEqual([1, 2, 3, 4]);
  });

  it('assigns rank 1 to every team when the whole table is tied', () => {
    const rows = [
      row({ team_id: 1, points: 3, won: 1, goals_for: 2, goals_against: 1 }),
      row({ team_id: 2, points: 3, won: 1, goals_for: 2, goals_against: 1 }),
      row({ team_id: 3, points: 3, won: 1, goals_for: 2, goals_against: 1 }),
    ];
    expect(rankStandings(rows).map((s) => s.rank)).toEqual([1, 1, 1]);
  });

  it('handles more than one tied block in the same table (1,1,3,4,4)', () => {
    const rows = [
      row({ team_id: 1, points: 6, won: 2, goals_for: 5, goals_against: 2 }),
      row({ team_id: 2, points: 6, won: 2, goals_for: 5, goals_against: 2 }),
      row({ team_id: 3, points: 4, won: 1, goals_for: 3, goals_against: 3 }),
      row({ team_id: 4, points: 1, won: 0, goals_for: 2, goals_against: 5 }),
      row({ team_id: 5, points: 1, won: 0, goals_for: 2, goals_against: 5 }),
    ];
    expect(rankStandings(rows).map((s) => s.rank)).toEqual([1, 1, 3, 4, 4]);
  });

  it('returns an empty array for an empty table', () => {
    expect(rankStandings([])).toEqual([]);
  });

  it('ranks a single-team table as 1', () => {
    expect(rankStandings([row({ team_id: 1 })])).toEqual([
      expect.objectContaining({ team: { id: 1, name: 'T1', sportTypeId: 1 }, rank: 1 }),
    ]);
  });

  it('trusts the given row order rather than re-sorting (a table given worst-first stays worst-first)', () => {
    // rankStandings only groups consecutive equal rows; it does not sort by the tie-break key itself.
    const rows = [
      row({ team_id: 1, points: 0 }),
      row({ team_id: 2, points: 9 }),
    ];
    expect(rankStandings(rows).map((s) => [s.team.id, s.rank])).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it('does not mutate the input rows', () => {
    const rows = [row({ team_id: 1, points: 6 }), row({ team_id: 2, points: 3 })];
    const snapshot = structuredClone(rows);

    rankStandings(rows);

    expect(rows).toEqual(snapshot);
  });

  it('produces the same DTO shape as toStandingDto for each row', () => {
    const rows = [row({ team_id: 1, points: 3 })];
    const [viaRank] = rankStandings(rows);
    const viaDirect = toStandingDto(rows[0]!, 1);

    expect(viaRank).toEqual(viaDirect);
  });
});
