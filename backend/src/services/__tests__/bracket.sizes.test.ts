import { describe, it, expect, vi } from 'vitest';

// pure function ล้วน — mock DB/repo ไว้ไม่ให้ import แล้วต่อ MySQL จริง (แบบเดียวกับ bracket.service.test.ts)
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
  planRoundRobin,
  nextPowerOfTwo,
  type PlannedMatch,
  type PlannedMatchNode,
} from '../bracket.service.js';

/**
 * Unit Test อัลกอริทึมจัดสาย — ชุดข้อมูล 8 · 16 · 32 · 64 ทีม ทุกรูปแบบการแข่งขัน
 * + กรณีจำนวนทีมไม่สอดคล้อง (ไม่ใช่เลขยกกำลัง 2 / จำนวนคี่)
 *
 * ★ เทสแบบ "คุณสมบัติที่ต้องจริงทุกขนาด" ไม่ใช่เทียบผลตายตัว — random seeding ให้ผลต่างกันทุกรอบ
 *   แต่กติกาข้างล่างต้องจริงเสมอ ถ้าข้อไหนพัง = สายที่ได้ใช้แข่งจริงไม่ได้
 */

const STANDARD_SIZES = [8, 16, 32, 64] as const;
const UNEVEN_SIZES = [3, 5, 6, 7, 9, 12, 17, 24, 31, 33, 48, 63] as const;
const ALL_SIZES = [...STANDARD_SIZES, ...UNEVEN_SIZES];
const SEEDINGS = ['manual', 'random'] as const;

const teamsOf = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// ───────────────────────────── placeTeamsInSlots ─────────────────────────────

describe('placeTeamsInSlots — ทุกขนาด', () => {
  for (const seeding of SEEDINGS) {
    it.each(ALL_SIZES)(`${seeding}: %i ทีม → ทุกทีมอยู่ครั้งเดียว · bye ไม่เจอ bye · ขนาดเป็นเลขยกกำลัง 2`, (n) => {
      const size = nextPowerOfTwo(n);
      const slots = placeTeamsInSlots(teamsOf(n), size, seeding);

      expect(slots).toHaveLength(size);
      expect(Math.log2(size) % 1).toBe(0);
      expect(slots.filter(s => s === null)).toHaveLength(size - n);
      expect(slots.filter((s): s is number => s !== null).sort((a, b) => a - b)).toEqual(teamsOf(n));
      for (let i = 0; i < slots.length; i += 2) {
        expect(slots[i] === null && slots[i + 1] === null).toBe(false);
      }
    });
  }

  it.each(STANDARD_SIZES)('%i ทีม (เลขยกกำลัง 2) → ไม่มี bye เลย', (n) => {
    expect(placeTeamsInSlots(teamsOf(n), n, 'manual').every(s => s !== null)).toBe(true);
  });
});

// ───────────────────────────── Single elimination ─────────────────────────────

function assertValidSingleElimination(plan: PlannedMatch[], teamCount: number, bracketSize: number) {
  const totalRounds = Math.log2(bracketSize);

  // โครงสายเต็ม = bracketSize - 1 ช่องแมตช์ (นับ bye ด้วย)
  expect(plan).toHaveLength(bracketSize - 1);
  // ตกรอบทีละทีม ⇒ แมตช์จริง = n - 1 เสมอ ไม่ว่าจะมี bye กี่ช่อง
  expect(plan.filter(m => !m.isBye)).toHaveLength(teamCount - 1);

  // จำนวนแมตช์ต่อรอบลดลงครึ่งหนึ่งทุกรอบ · matchNumber เรียง 1..k
  for (let round = 1; round <= totalRounds; round++) {
    const inRound = plan.filter(m => m.round === round);
    expect(inRound).toHaveLength(bracketSize / 2 ** round);
    expect(inRound.map(m => m.matchNumber)).toEqual(Array.from({ length: inRound.length }, (_, i) => i + 1));
  }

  // นัดชิงมีนัดเดียว และเป็นแมตช์จริง (ไม่มีแชมป์ที่ได้มาจาก bye)
  const final = plan.filter(m => m.round === totalRounds);
  expect(final).toHaveLength(1);
  expect(final[0]!.isBye).toBe(false);

  // รอบแรก: ทุกทีมปรากฏครั้งเดียว
  const firstRoundTeams = plan
    .filter(m => m.round === 1)
    .flatMap(m => [m.teamAId, m.teamBId])
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  expect(firstRoundTeams).toEqual(teamsOf(teamCount));
}

describe('planSingleElimination — ทุกขนาด', () => {
  for (const seeding of SEEDINGS) {
    it.each(ALL_SIZES)(`${seeding}: %i ทีม → สายถูกต้อง`, (n) => {
      const size = nextPowerOfTwo(n);
      assertValidSingleElimination(planSingleElimination(placeTeamsInSlots(teamsOf(n), size, seeding)), n, size);
    });
  }

  it.each([[8, 3], [16, 4], [32, 5], [64, 6]])('%i ทีม → %i รอบ', (n, rounds) => {
    const plan = planSingleElimination(placeTeamsInSlots(teamsOf(n), n, 'manual'));
    expect(Math.max(...plan.map(m => m.round))).toBe(rounds);
  });

  it('ทีมที่ได้ bye ไปโผล่ในรอบ 2 ตรงตำแหน่ง — 5 ทีมในสาย 8 (manual: seed 1-3 ได้ bye)', () => {
    const plan = planSingleElimination(placeTeamsInSlots([1, 2, 3, 4, 5], 8, 'manual'));
    const round2 = plan.filter(m => m.round === 2);
    expect(round2[0]).toMatchObject({ teamAId: 1, teamBId: 2, isBye: false }); // สองทีม bye มาเจอกันเลย
    expect(round2[1]).toMatchObject({ teamAId: 3, teamBId: null, isBye: false }); // รอผู้ชนะ 4 vs 5
  });
});

// ───────────────────────────── Round robin ─────────────────────────────

function assertValidRoundRobin(pairs: ReturnType<typeof planRoundRobin>, teamCount: number) {
  // ทุกคู่เจอกันครั้งเดียวพอดี
  expect(pairs).toHaveLength((teamCount * (teamCount - 1)) / 2);
  const seen = new Set<string>();
  for (const p of pairs) {
    expect(p.teamAId).not.toBe(p.teamBId);
    const key = [p.teamAId, p.teamBId].sort((a, b) => a - b).join('-');
    expect(seen.has(key)).toBe(false);
    seen.add(key);
  }

  // จำนวนรอบ: คู่ = n-1 · คี่ = n (เติม bye 1 ช่อง)
  const rounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  expect(Math.max(...pairs.map(p => p.round))).toBe(rounds);

  // ในรอบเดียวกัน ไม่มีทีมไหนแข่งสองนัด
  for (let r = 1; r <= rounds; r++) {
    const playing = pairs.filter(p => p.round === r).flatMap(p => [p.teamAId, p.teamBId]);
    expect(new Set(playing).size).toBe(playing.length);
    // คู่: ทุกทีมได้แข่งทุกรอบ · คี่: พักรอบละ 1 ทีมพอดี
    expect(playing).toHaveLength(teamCount % 2 === 0 ? teamCount : teamCount - 1);
  }

  // ทุกทีมแข่ง n-1 นัด
  for (const t of teamsOf(teamCount)) {
    expect(pairs.filter(p => p.teamAId === t || p.teamBId === t)).toHaveLength(teamCount - 1);
  }
}

describe('planRoundRobin — ทุกขนาด', () => {
  it.each([2, ...ALL_SIZES])('%i ทีม → ตารางพบกันหมดถูกต้อง', (n) => {
    assertValidRoundRobin(planRoundRobin(teamsOf(n)), n);
  });

  it('จำนวนคี่: แต่ละทีมพักรอบเดียวพอดี', () => {
    for (const n of UNEVEN_SIZES.filter(x => x % 2 === 1)) {
      const pairs = planRoundRobin(teamsOf(n));
      for (const t of teamsOf(n)) {
        const roundsPlayed = new Set(pairs.filter(p => p.teamAId === t || p.teamBId === t).map(p => p.round));
        expect(roundsPlayed.size).toBe(n - 1); // n รอบ แข่ง n-1 ⇒ พัก 1
      }
    }
  });

  it('ไม่ใช้ team_id ที่ไม่มีอยู่จริง (ไม่มี null หลุดออกมาเป็นคู่แข่ง)', () => {
    const ids = [101, 205, 333];
    const pairs = planRoundRobin(ids);
    expect(pairs.flatMap(p => [p.teamAId, p.teamBId]).every(t => ids.includes(t))).toBe(true);
  });

  it('1 ทีม → ไม่มีแมตช์ (ด่าน minTeamsToDraw กันไว้ก่อนถึงตรงนี้)', () => {
    expect(planRoundRobin([1])).toEqual([]);
  });
});

// ───────────────────────────── Double elimination ─────────────────────────────

// กติกาเดียวกับ bracket.service.test.ts (ซึ่งครอบ 2-16 ทีม) — ขยายไปถึง 64
function assertValidDoubleElimination(plan: PlannedMatchNode[], teamCount: number) {
  expect(plan).toHaveLength(2 * teamCount - 2);
  const seenKeys = new Set<string>();
  const teamsPlaced: number[] = [];
  for (const m of plan) {
    for (const source of [m.teamA, m.teamB]) {
      expect(source.kind).not.toBe('bye');
      if (source.kind === 'team') teamsPlaced.push(source.teamId);
      if (source.kind === 'winner' || source.kind === 'loser') expect(seenKeys.has(source.matchKey)).toBe(true);
    }
    seenKeys.add(m.key);
  }
  expect(teamsPlaced.sort((a, b) => a - b)).toEqual(teamsOf(teamCount));
  expect(plan[plan.length - 1]!.bracketType).toBe('grand_final');
  expect(plan.filter(m => m.bracketType === 'grand_final')).toHaveLength(1);
}

describe('planDoubleElimination — 32/64 และจำนวนไม่สอดคล้องขนาดใหญ่', () => {
  for (const seeding of SEEDINGS) {
    it.each([...STANDARD_SIZES, 17, 24, 31, 33, 48, 63])(`${seeding}: %i ทีม → สายถูกต้อง`, (n) => {
      const slots = placeTeamsInSlots(teamsOf(n), Math.max(4, nextPowerOfTwo(n)), seeding);
      assertValidDoubleElimination(planDoubleElimination(slots), n);
    });
  }

  it('ผู้แพ้จากสายบนไหลลงสายล่างเท่านั้น (ไม่มี loser ชี้กลับไปสายล่างหรือนัดชิง)', () => {
    const plan = planDoubleElimination(placeTeamsInSlots(teamsOf(64), 64, 'manual'));
    const byKey = new Map(plan.map(m => [m.key, m]));
    for (const m of plan) {
      for (const source of [m.teamA, m.teamB]) {
        if (source.kind === 'loser') expect(byKey.get(source.matchKey)!.bracketType).toBe('winners');
      }
    }
  });
});
