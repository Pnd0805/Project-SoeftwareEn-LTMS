import { describe, it, expect } from 'vitest';
import { toSportStatDto, toUserStatsDto, hiddenUserStatsDto } from '../stat.mapper.js';

describe('toSportStatDto', () => {
  it('maps a single sport-stat row to its DTO shape', () => {
    const row = {
      sport_type_id: 1,
      sport_name: 'Football',
      matches_played: 10,
      wins: 6,
      losses: 4,
    };
    expect(toSportStatDto(row as any)).toEqual({
      sportTypeId: 1,
      sportName: 'Football',
      matchesPlayed: 10,
      wins: 6,
      losses: 4,
    });
  });
});

describe('toUserStatsDto', () => {
  it('returns zeroed-out overall stats and an empty bySport list for a user with no stats', () => {
    const result = toUserStatsDto(1, []);

    expect(result).toEqual({
      userId: 1,
      statsHidden: false,
      overall: { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, championCount: 0 },
      bySport: [],
      mvpVotes: 0,
      mvpTimes: 0,
      followerCount: 0,
    });
  });

  it('sums matches/wins/losses/championships across multiple sports', () => {
    const rows = [
      { sport_type_id: 1, sport_name: 'Football', matches_played: 10, wins: 6, losses: 4, championships: 1 },
      { sport_type_id: 2, sport_name: 'Basketball', matches_played: 5, wins: 2, losses: 3, championships: 0 },
    ];

    const result = toUserStatsDto(1, rows as any);

    expect(result.overall).toEqual({
      matchesPlayed: 15,
      wins: 8,
      losses: 7,
      winRate: 8 / 15,
      championCount: 1,
    });
    expect(result.bySport).toHaveLength(2);
    expect(result.bySport[0]).toEqual({
      sportTypeId: 1,
      sportName: 'Football',
      matchesPlayed: 10,
      wins: 6,
      losses: 4,
    });
  });

  it('computes winRate as wins / matchesPlayed for a single sport', () => {
    const rows = [
      { sport_type_id: 1, sport_name: 'Football', matches_played: 10, wins: 3, losses: 7, championships: 0 },
    ];

    const result = toUserStatsDto(1, rows as any);

    expect(result.overall.winRate).toBeCloseTo(0.3);
  });

  it('avoids a divide-by-zero and reports winRate 0 when matchesPlayed is 0 across all rows', () => {
    const rows = [
      { sport_type_id: 1, sport_name: 'Football', matches_played: 0, wins: 0, losses: 0, championships: 0 },
    ];

    const result = toUserStatsDto(1, rows as any);

    expect(result.overall.winRate).toBe(0);
  });

  it('keeps userId as passed in, independent of the row data', () => {
    const result = toUserStatsDto(42, []);
    expect(result.userId).toBe(42);
  });

  it('maps C8 engagement totals onto the stats response', () => {
    const result = toUserStatsDto(1, [], { mvp_votes: 6, mvp_times: 2, follower_count: 9 });
    expect(result).toMatchObject({ mvpVotes: 6, mvpTimes: 2, followerCount: 9 });

    /**
     * ★ OD-60 — ส่งทั้งคู่ และต้องแยกจากกันจริง
     *   mvpVotes โตตามจำนวนคนดู · mvpTimes นับความเด่นในแมตช์
     *   ถ้าวันหนึ่งมีคน map ให้ชี้ค่าเดียวกัน หน้าจอจะโกหกเงียบ ๆ
     */
    expect(result.mvpTimes).not.toBe(result.mvpVotes);
    // ★ 4 ต.ค. — แต้ม Pick'em ถูกเอาออกจากโปรไฟล์สาธารณะ ดูได้ที่ตารางอันดับในทัวร์ (E28) กับ /me/pickem (E27)
    expect(result).not.toHaveProperty('pickemPoints');
  });

  /**
   * OD-46 — สถิติที่ถูกซ่อนต้องเป็น null ทั้งชุด **ไม่ใช่ 0**
   * 0 อ่านได้ว่า "ลงแข่งแล้วไม่เคยชนะ" ซึ่งเป็นคำตอบที่ผิด และหน้าจอแยกจากของจริงไม่ออก
   */
  it('OD-46 — สถิติที่ถูกซ่อนคืน null ทั้งชุด ไม่ใช่ 0', () => {
    expect(hiddenUserStatsDto(9001)).toEqual({
      userId: 9001,
      statsHidden: true,
      overall: null,
      bySport: null,
      mvpVotes: null,
      mvpTimes: null,
      followerCount: null,
    });
  });
});
