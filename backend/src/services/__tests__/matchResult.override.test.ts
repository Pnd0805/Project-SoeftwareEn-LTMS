import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/matchResult.repo.js', () => ({
  findmatchResultByMatchId: vi.fn(),
  overrideResultByReferee: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(() => Promise.resolve({ tournament_id: 50, sport_type_id: 1 })),
}));
vi.mock('../walkover.service.js', () => ({ resolveIfOpponentWithdrawn: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../middlewares/requireReferee.js', () => ({ isRefereeOfMatch: vi.fn(), isTeamLeaderOfMatch: vi.fn() }));
vi.mock('../../utils/checkExist.js', () => ({ checkMatch: vi.fn(), checkMatchResult: vi.fn() }));
// 🔴 OD-58 (4 ต.ค.) — canSeeUnfinishedResult() ถาม AdminRepo ด้วยแล้ว (แอดมินที่ถึงคิวตัดสินต้องอ่านได้)
// ถ้าไม่ mock ที่นี่ เทสจะไปต่อฐานจริง แล้ว "ผ่าน" เฉพาะตอนที่เครื่องมี MySQL รันอยู่
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(() => Promise.resolve(null)) }));

import * as Service from '../matchResult.service.js';
import * as Repo from '../../repositories/matchResult.repo.js';
import { checkMatch } from '../../utils/checkExist.js';
import * as NotificationService from '../notification.service.js';
import type { MatchRow } from '../../types/db.js';

const REFEREE = 9002;
const TEAM_A = 10, TEAM_B = 11;

const match = (o: Partial<MatchRow> = {}) => ({
  match_id: 1, tournament_id: 50, team_a_id: TEAM_A, team_b_id: TEAM_B,
  next_match_id: null, loser_next_match_id: null, mode: 'online', match_status: 'finished', ...o,
}) as MatchRow;

/** ผลที่หัวหน้าทีม A ส่งมา — อ้างว่าตัวเองชนะ 3-1 */
const submittedByTeamA = {
  match_result_id: 100, match_id: 1, winner_team_id: TEAM_A,
  score_data: { [String(TEAM_A)]: 3, [String(TEAM_B)]: 1 },
  submitted_by_user_id: 5001, submitted_role: 'team_leader',
  match_result_status: 'submitted', verified_at: null,
} as never;

/** ผลที่กรรมการเขียนทับ — ที่จริงทีม B ชนะ 1-3 */
const overridden = {
  ...(submittedByTeamA as object), winner_team_id: TEAM_B,
  score_data: { [String(TEAM_A)]: 1, [String(TEAM_B)]: 3 },
  submitted_by_user_id: REFEREE, submitted_role: 'referee',
} as never;

const input = {
  winnerTeamId: TEAM_B,
  scoreData: { [String(TEAM_A)]: 1, [String(TEAM_B)]: 3 },
  reason: 'สกอร์จริงคือ 1-3 ผมดูเกมอยู่',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkMatch).mockResolvedValue(match() as never);
  // เรียกครั้งแรก = ของเดิมก่อนทับ · ครั้งที่สอง = ของใหม่ที่จะคืนออกไป
  vi.mocked(Repo.findmatchResultByMatchId)
    .mockResolvedValueOnce(submittedByTeamA)
    .mockResolvedValue(overridden);
});

/**
 * S02b (OD-55 · 4 ต.ค.) — กรรมการเขียนผลทับในโหมด online
 *
 * ★ สิ่งที่ต้องตรึงที่สุดคือ **ผลลงที่ `submitted` ไม่ใช่ `verified`**
 *   ถ้าวันหนึ่งมีคนทำให้มัน verified ทันทีเพื่อ "ให้จบในคลิกเดียว" หลัก
 *   SAME_PERSON_CANNOT_VERIFY จะพังโดยที่ไม่มีเทสไหนแดง เพราะ endpoint ยังตอบ 200 เหมือนเดิม
 */
describe('overrideMatchResult — ส่งต่อให้ repo ถูกต้อง', () => {
  it('ส่งผู้ชนะใหม่ สกอร์ใหม่ เหตุผล และ id กรรมการ ลงไปครบ', async () => {
    await Service.overrideMatchResult(1, input, REFEREE);

    expect(Repo.overrideResultByReferee).toHaveBeenCalledWith(
      expect.objectContaining({ match_id: 1 }),
      TEAM_B,
      input.scoreData,
      REFEREE,
      input.reason,
      expect.anything(),
    );
  });

  /**
   * ★ ข้อนี้คือเหตุผลที่ service ต้องอ่านผลเดิม "ก่อน" เขียนทับ
   *   match_results มีแถวเดียวต่อแมตช์ (ON DUPLICATE KEY UPDATE) ⇒ ของที่ทีมส่งมาหายถาวร
   *   ถ้าไม่ได้ส่งต่อไปเก็บใน audit_logs ทีมจะไม่มีหลักฐานว่าตัวเองส่งอะไร แล้วเถียงกันไม่จบ
   */
  it('ส่งผลเดิมของทีมไปเก็บเป็นหลักฐานครบทั้ง 4 ช่อง', async () => {
    await Service.overrideMatchResult(1, input, REFEREE);

    const previous = vi.mocked(Repo.overrideResultByReferee).mock.calls[0]![5];
    expect(previous).toEqual({
      winnerTeamId: TEAM_A,
      scoreData: { [String(TEAM_A)]: 3, [String(TEAM_B)]: 1 },
      submittedByUserId: 5001,
      submittedRole: 'team_leader',
    });
  });

  it('อ่านผลเดิมก่อนเรียก repo เขียนทับ ไม่ใช่หลัง', async () => {
    const order: string[] = [];
    // ★ ต้อง mockReset ก่อน — คิวของ mockResolvedValueOnce ใน beforeEach มีสิทธิ์เหนือ
    //   mockImplementation ⇒ ถ้าไม่ล้าง การอ่านครั้งแรกจะไม่ถูกบันทึกลง order
    vi.mocked(Repo.findmatchResultByMatchId).mockReset();
    vi.mocked(Repo.findmatchResultByMatchId).mockImplementation(async () => {
      order.push('read'); return submittedByTeamA;
    });
    vi.mocked(Repo.overrideResultByReferee).mockImplementation(async () => { order.push('write'); });

    await Service.overrideMatchResult(1, input, REFEREE);

    expect(order[0]).toBe('read');
    expect(order.indexOf('write')).toBeGreaterThan(0);
  });
});

describe('overrideMatchResult — กฎผลใช้ชุดเดียวกับ S01', () => {
  it('ผู้ชนะต้องเป็นทีมในแมตช์นี้', async () => {
    await expect(Service.overrideMatchResult(1, { ...input, winnerTeamId: 999 }, REFEREE))
      .rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(Repo.overrideResultByReferee).not.toHaveBeenCalled();
  });

  it('คะแนนของผู้ชนะต้องมากกว่าอีกฝ่าย', async () => {
    await expect(Service.overrideMatchResult(1, {
      ...input, winnerTeamId: TEAM_B, scoreData: { [String(TEAM_A)]: 3, [String(TEAM_B)]: 1 },
    }, REFEREE)).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(Repo.overrideResultByReferee).not.toHaveBeenCalled();
  });

  it('key ของ scoreData ต้องเป็นรหัสทีมทั้งสองของแมตช์นี้', async () => {
    await expect(Service.overrideMatchResult(1, {
      ...input, scoreData: { '77': 1, '88': 3 },
    }, REFEREE)).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(Repo.overrideResultByReferee).not.toHaveBeenCalled();
  });

  it('ไม่เขียนทับและไม่แจ้งเตือนเลยถ้าผลใหม่ไม่ผ่านกฎ', async () => {
    await expect(Service.overrideMatchResult(1, { ...input, winnerTeamId: 999 }, REFEREE)).rejects.toThrow();
    expect(NotificationService.notifyMatchResultParties).not.toHaveBeenCalled();
  });
});

describe('overrideMatchResult — แจ้งเตือน', () => {
  it('แจ้งทั้งสองทีมด้วยชนิด result_overridden และมีเหตุผลอยู่ในข้อความ', async () => {
    await Service.overrideMatchResult(1, input, REFEREE);

    expect(NotificationService.notifyMatchResultParties).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ type: 'result_overridden' }),
    );
    const payload = vi.mocked(NotificationService.notifyMatchResultParties).mock.calls[0]![1];
    // ★ เหตุผลบังคับกรอก (มติข้อ ②) — ถ้าไม่ส่งต่อไปในข้อความ การบังคับกรอกก็ไร้ความหมาย
    expect(payload.message).toContain(input.reason);
  });

  /**
   * ★ ห้ามใส่ exceptUserId — ของเส้นอื่น (S01/S02) ตัดคนที่กดออกจากผู้รับ
   *   แต่ที่นี่คนกดคือกรรมการ ซึ่งไม่ได้อยู่ในผู้รับอยู่แล้ว (ฟังก์ชันส่งให้หัวหน้าสองทีม)
   *   ถ้าเผลอใส่ exceptUserId มา ทีมที่ส่งผลมาเองจะไม่ได้รับแจ้งว่าผลถูกเปลี่ยน
   *   = ถูกเปลี่ยนผลโดยไม่รู้ตัวจนหมดเวลาค้าน ซึ่งเป็นเคสที่ร้ายที่สุดของฟีเจอร์นี้
   */
  it('ไม่ตัดใครออกจากผู้รับแจ้งเตือน', async () => {
    await Service.overrideMatchResult(1, input, REFEREE);
    expect(vi.mocked(NotificationService.notifyMatchResultParties).mock.calls[0]![2]).toBeUndefined();
  });
});
