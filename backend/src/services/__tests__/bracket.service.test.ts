import { describe, it, expect, vi } from 'vitest';

// ส่วนที่ทดสอบเป็น pure function ล้วน — mock DB/repo ไว้ไม่ให้ import แล้วต่อ MySQL จริง
vi.mock('../../config/db.js', () => ({ default: {} }));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/tournament.repo.js', () => ({}));
vi.mock('../../repositories/match.repo.js', () => ({}));
vi.mock('../../repositories/bracketNode.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));

import {
  placeTeamsInSlots,
  planSingleElimination,
  planDoubleElimination,
  nextPowerOfTwo,
  type PlannedMatchNode,
} from '../bracket.service.js';

function pairsOf(slots: (number | null)[]) {
  const pairs: [number | null, number | null][] = [];
  for (let i = 0; i < slots.length; i += 2) pairs.push([slots[i]!, slots[i + 1]!]);
  return pairs;
}

describe('placeTeamsInSlots', () => {
  it('manual: top seeds get the byes, the rest are paired in order', () => {
    expect(placeTeamsInSlots([1, 2, 3, 4, 5], 8, 'manual')).toEqual([1, null, 2, null, 3, null, 4, 5]);
  });

  it('no byes when the team count is already a power of two', () => {
    expect(placeTeamsInSlots([1, 2, 3, 4], 4, 'manual')).toEqual([1, 2, 3, 4]);
  });

  it('random: every team appears once, byes never face each other', () => {
    for (let run = 0; run < 50; run++) {
      const teams = [11, 12, 13, 14, 15, 16];
      const slots = placeTeamsInSlots(teams, 8, 'random');

      expect(slots).toHaveLength(8);
      expect(slots.filter(s => s === null)).toHaveLength(2);
      expect(slots.filter((s): s is number => s !== null).sort()).toEqual(teams);
      for (const [a, b] of pairsOf(slots)) {
        expect(a === null && b === null).toBe(false);
      }
    }
  });

  it('double elimination with 2 teams fills a 4-slot bracket with one bye each', () => {
    expect(placeTeamsInSlots([1, 2], 4, 'manual')).toEqual([1, null, 2, null]);
  });
});

describe('planSingleElimination', () => {
  it('3 teams: seed 1 gets a bye and meets the winner of 2 vs 3 in the final', () => {
    const plan = planSingleElimination([1, null, 2, 3]);

    expect(plan.filter(m => !m.isBye)).toHaveLength(2);
    const final = plan.find(m => m.round === 2)!;
    expect(final.teamAId).toBe(1);
    expect(final.teamBId).toBeNull();
    expect(final.isBye).toBe(false);
  });
});

// ตรวจกราฟ double elimination ให้ถูกทุกขนาด
function assertValidDoubleElimination(plan: PlannedMatchNode[], teamCount: number) {
  // ไม่มีการ reset → จำนวนแมตช์ = 2n - 2 เสมอ (ทุกทีมยกเว้นแชมป์แพ้ 2 ครั้ง ลบนัดชิงที่แพ้แค่ครั้งเดียว)
  expect(plan).toHaveLength(2 * teamCount - 2);

  const seenKeys = new Set<string>();
  const teamsPlaced: number[] = [];
  for (const m of plan) {
    for (const source of [m.teamA, m.teamB]) {
      expect(source.kind).not.toBe('bye');
      if (source.kind === 'team') teamsPlaced.push(source.teamId);
      // ต้องชี้ไปแมตช์จริงที่อยู่ก่อนหน้าเท่านั้น (แมตช์ bye ถูกตัดทิ้งไปแล้ว)
      if (source.kind === 'winner' || source.kind === 'loser') expect(seenKeys.has(source.matchKey)).toBe(true);
    }
    seenKeys.add(m.key);
  }
  expect(teamsPlaced.sort((a, b) => a - b)).toEqual(Array.from({ length: teamCount }, (_, i) => i + 1));
  expect(plan[plan.length - 1]!.bracketType).toBe('grand_final');
}

describe('planDoubleElimination', () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 12, 16])('builds a valid bracket for %i teams', (n) => {
    const teams = Array.from({ length: n }, (_, i) => i + 1);
    const slots = placeTeamsInSlots(teams, Math.max(4, nextPowerOfTwo(n)), 'random');
    assertValidDoubleElimination(planDoubleElimination(slots), n);
  });

  it('2 teams: first match, then the loser meets the winner again in the grand final', () => {
    const plan = planDoubleElimination([1, null, 2, null]);

    expect(plan).toHaveLength(2);
    const [first, final] = plan;
    expect(first!.teamA).toEqual({ kind: 'team', teamId: 1 });
    expect(first!.teamB).toEqual({ kind: 'team', teamId: 2 });
    expect(final!.teamA).toEqual({ kind: 'winner', matchKey: first!.key });
    expect(final!.teamB).toEqual({ kind: 'loser', matchKey: first!.key });
  });
});
