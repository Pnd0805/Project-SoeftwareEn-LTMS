import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ยืนยันผล = ธุรกรรมอะตอมมิกเดียว (SRS: "ธุรกรรมอะตอมมิกอัปเดต Bracket, Leaderboard, สถิติ")
 *
 * สิ่งที่ต้องจริง:
 *   ① ผู้ชนะถูกวางลงแมตช์ถัดไป · ผู้แพ้ลงสายล่าง (ถ้ามี) — ลงช่องที่ว่างเท่านั้น ไม่ทับทีมที่อยู่แล้ว
 *   ② ตารางคะแนน + สถิติผู้เล่น + Pick'em ทำใน connection เดียวกับการเปลี่ยนสถานะผล
 *   ③ ขั้นไหนล้ม → rollback ทั้งก้อน ไม่มี commit (ไม่มีสายที่เดินไปแล้วแต่ตารางคะแนนไม่ขยับ)
 *
 * ★ อ่าน SQL ที่ส่งเข้า connection ไม่ใช่ผลในฐาน (แบบเดียวกับ matchResult.undoOutcome.test.ts)
 */
const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn((..._args: unknown[]) => Promise.resolve([[], []] as unknown)),
  connQuery: vi.fn((..._args: unknown[]) => Promise.resolve([{ affectedRows: 1 }, []] as unknown)),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  matchFindById: vi.fn(),
  findTournamentById: vi.fn(),
  syncNodeTeamsFromMatchTx: vi.fn(),
  settleTx: vi.fn(),
  evaluatePickemRewardsTx: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  default: {
    query: mocks.poolQuery,
    getConnection: () => Promise.resolve({
      query: mocks.connQuery,
      beginTransaction: mocks.beginTransaction,
      commit: mocks.commit,
      rollback: mocks.rollback,
      release: mocks.release,
    }),
  },
}));
vi.mock('../match.repo.js', () => ({ findById: mocks.matchFindById }));
vi.mock('../tournament.repo.js', () => ({ findTournamentById: mocks.findTournamentById }));
vi.mock('../bracketNode.repo.js', () => ({ syncNodeTeamsFromMatchTx: mocks.syncNodeTeamsFromMatchTx }));
vi.mock('../pickem.repo.js', () => ({ settleTx: mocks.settleTx, unsettleTx: vi.fn() }));
vi.mock('../reward.repo.js', () => ({ evaluatePickemRewardsTx: mocks.evaluatePickemRewardsTx }));

import { verifyMatchResult } from '../matchResult.repo.js';

const resultRow = {
  match_result_id: 100, match_id: 70, winner_team_id: 5, score_data: { '5': 3, '6': 1 }, match_result_status: 'submitted',
};
const match = (o: Record<string, unknown> = {}) => ({
  match_id: 70, tournament_id: 20, team_a_id: 5, team_b_id: 6, next_match_id: 80, loser_next_match_id: 90, ...o,
});

const sqlCalls = () => mocks.connQuery.mock.calls.map(([sql, values]) => ({ sql: String(sql), values: values as unknown[] }));
const callsMatching = (re: RegExp) => sqlCalls().filter(c => re.test(c.sql));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.poolQuery.mockResolvedValue([[resultRow], []]);   // findById(match_result)
  mocks.connQuery.mockResolvedValue([{ affectedRows: 1 }, []]);
  mocks.matchFindById.mockResolvedValue(match());
  mocks.findTournamentById.mockResolvedValue({ tournament_id: 20, sport_type_id: 3 });
});

describe('verifyMatchResult — ธุรกรรมเดียวครบทุกส่วน', () => {
  it('เปลี่ยนผลเป็น verified และแมตช์เป็น completed', async () => {
    await verifyMatchResult(100, 70, 7, 3);
    expect(callsMatching(/UPDATE match_results SET match_result_status/)[0]!.values).toEqual(['verified', 7, 100]);
    expect(callsMatching(/UPDATE matches SET match_status/)[0]!.values).toEqual(['completed', 70]);
  });

  it('① ผู้ชนะไปแมตช์ถัดไป · ผู้แพ้ไปสายล่าง — ลงช่องที่ว่าง (team_a_id IS NULL) เท่านั้น', async () => {
    await verifyMatchResult(100, 70, 7, 3);
    const placeA = callsMatching(/UPDATE matches SET team_a_id = \?/);
    expect(placeA.map(c => c.values)).toEqual([[5, 80, 20], [6, 90, 20]]);
    for (const c of placeA) expect(c.sql).toContain('team_a_id IS NULL');
    expect(mocks.syncNodeTeamsFromMatchTx).toHaveBeenCalledWith(expect.anything(), 80);
    expect(mocks.syncNodeTeamsFromMatchTx).toHaveBeenCalledWith(expect.anything(), 90);
  });

  it('① ช่อง A ของแมตช์ถัดไปมีทีมแล้ว → วางช่อง B แทน ไม่ทับทีมเดิม', async () => {
    mocks.connQuery.mockImplementation(async (sql: unknown) =>
      String(sql).includes('SET team_a_id') ? [{ affectedRows: 0 }, []] : [{ affectedRows: 1 }, []]);
    await verifyMatchResult(100, 70, 7, 3);
    const placeB = callsMatching(/UPDATE matches SET team_b_id = \?/);
    expect(placeB.map(c => c.values)).toEqual([[5, 80, 20], [6, 90, 20]]);
    for (const c of placeB) expect(c.sql).toContain('team_b_id IS NULL');
  });

  it('① นัดชิง (ไม่มีแมตช์ถัดไป) → ไม่วางทีมไหน แต่ตารางคะแนนยังอัปเดต', async () => {
    mocks.matchFindById.mockResolvedValue(match({ next_match_id: null, loser_next_match_id: null }));
    await verifyMatchResult(100, 70, 7, 3);
    expect(callsMatching(/SET team_[ab]_id = \?/)).toHaveLength(0);
    expect(callsMatching(/INSERT INTO tournament_standings/)).toHaveLength(2);
  });

  it('② ตารางคะแนน: ผู้ชนะได้แต้มชนะและประตูได้/เสียถูกฝั่ง · ผู้แพ้ได้ 0 แต้ม', async () => {
    await verifyMatchResult(100, 70, 7, 3);
    const [winnerRow, loserRow] = callsMatching(/INSERT INTO tournament_standings/);
    expect(winnerRow!.values.slice(0, 5)).toEqual([20, 5, 3, 3, 1]);   // ทัวร์ · ทีม · แต้ม · ได้ · เสีย
    expect(loserRow!.values.slice(0, 4)).toEqual([20, 6, 1, 3]);       // ทัวร์ · ทีม · ได้ · เสีย
    expect(loserRow!.sql).toMatch(/VALUES \(\?, \?, 1, 0, 1, 0,/);     // แพ้ 1 · แต้ม 0
  });

  it('② สถิติผู้เล่นทั้งสองทีม · นับเฉพาะคนที่ส่งลงแข่ง (application_players ที่ approved)', async () => {
    await verifyMatchResult(100, 70, 7, 3);
    const stats = callsMatching(/INSERT INTO player_profile_stats/);
    expect(stats).toHaveLength(2);
    for (const s of stats) expect(s.sql).toContain("tournament_application_status = 'approved'");
    expect(stats[0]!.values.slice(0, 5)).toEqual([3, 1, 0, 20, 5]);   // กีฬา · ชนะ · แพ้ · ทัวร์ · ทีมผู้ชนะ
    expect(stats[1]!.values.slice(0, 5)).toEqual([3, 0, 1, 20, 6]);
  });

  it("② Pick'em ให้แต้มด้วยผลจริงในธุรกรรมเดียวกัน", async () => {
    await verifyMatchResult(100, 70, 7, 3);
    expect(mocks.settleTx).toHaveBeenCalledWith(expect.anything(), 70, 5, { '5': 3, '6': 1 }, 3);
    expect(mocks.evaluatePickemRewardsTx).toHaveBeenCalledWith(expect.anything(), 70);
  });

  it('commit ครั้งเดียวหลังทุกขั้น และเขียน audit เมื่อมีคนกดยืนยัน', async () => {
    await verifyMatchResult(100, 70, 7, 3);
    expect(mocks.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(callsMatching(/INSERT INTO audit_logs/)[0]!.values).toEqual([7, 70, JSON.stringify({ winnerId: 5, verifiedBy: 7 })]);
  });

  it('ยืนยันอัตโนมัติ (userId = null) → ไม่เขียน audit (FK ต้องเป็นผู้ใช้จริง) แต่ที่เหลือครบ', async () => {
    await verifyMatchResult(100, 70, null, 3);
    expect(callsMatching(/INSERT INTO audit_logs/)).toHaveLength(0);
    expect(callsMatching(/UPDATE match_results SET match_result_status/)[0]!.values).toEqual(['verified', null, 100]);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
  });
});

describe('verifyMatchResult — ③ ล้มกลางทาง = ย้อนทั้งก้อน', () => {
  it.each([
    ["Pick'em", () => mocks.settleTx.mockRejectedValueOnce(new Error('pickem down'))],
    ['ซิงก์สาย', () => mocks.syncNodeTeamsFromMatchTx.mockRejectedValueOnce(new Error('node sync failed'))],
    ['ตารางคะแนน', () => mocks.connQuery.mockImplementation(async (sql: unknown) => {
      if (String(sql).includes('tournament_standings')) throw new Error('standings deadlock');
      return [{ affectedRows: 1 }, []];
    })],
  ])('%s ล้ม → rollback · ไม่ commit · คืน connection', async (_label, breakIt) => {
    breakIt();
    await expect(verifyMatchResult(100, 70, 7, 3)).rejects.toThrow();
    expect(mocks.rollback).toHaveBeenCalledTimes(1);
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
});
