import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * S02 ยืนยันผล · S03 โต้แย้งผล — ชั้น service
 *
 * ด่าน "ใครยืนยัน/โต้แย้งได้" (BR-12 · BR-13 · BR-14 หน้าต่างเวลา) อยู่ใน middleware และมีเทสแล้ว
 * (requireReferee.test.ts → requireCanVerifyResult / requireCanDisputeResult)
 * ไฟล์นี้คุมสิ่งที่เกิด **หลัง** ผ่านด่าน: ยืนยันแล้วต้องไหลต่อ · โต้แย้งแล้วต้องตรวจข้อเสนอและหลักฐาน
 * ส่วนการอัปเดตสาย/ตารางคะแนน/สถิติแบบอะตอมมิก อยู่ใน repo → matchResult.verifyAtomic.test.ts
 */

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
  verifyMatchResult: vi.fn(() => Promise.resolve()),
  disputeMatchResult: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(() => Promise.resolve({ tournament_id: 50, sport_type_id: 1 })),
}));
vi.mock('../walkover.service.js', () => ({ resolveIfOpponentWithdrawn: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../middlewares/requireReferee.js', () => ({ isRefereeOfMatch: vi.fn(), isTeamLeaderOfMatch: vi.fn() }));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(() => Promise.resolve(null)) }));

import * as Service from '../matchResult.service.js';
import * as Repo from '../../repositories/matchResult.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as Walkover from '../walkover.service.js';
import * as NotificationService from '../notification.service.js';
import { WIN_POINTS } from '../../config/scoring.js';
import type { MatchResultRow, MatchRow } from '../../types/db.js';

const match = (o: Partial<MatchRow> = {}) => ({
  match_id: 1, tournament_id: 50, team_a_id: 10, team_b_id: 11,
  next_match_id: 9, loser_next_match_id: 12, match_status: 'finished', best_of: null, ...o,
}) as MatchRow;

const result = (o: Partial<MatchResultRow> = {}) => ({
  match_result_id: 100, match_id: 1, winner_team_id: 10, score_data: { '10': 3, '11': 1 },
  match_result_status: 'submitted', submitted_by_user_id: 5, submitted_role: 'referee', verified_at: null, ...o,
}) as MatchResultRow;

beforeEach(() => {
  vi.clearAllMocks();
  // ★ clearAllMocks ไม่ล้างคิว mockResolvedValueOnce — เทสที่ throw ก่อนใช้ครบจะทิ้งค่าค้างให้เทสถัดไป
  vi.mocked(Repo.findmatchResultByMatchId).mockReset();
  vi.mocked(MatchRepo.findById).mockResolvedValue(match());
});

// ───────────────────────────── verifyMatchResult ─────────────────────────────

describe('verifyMatchResult (S02)', () => {
  beforeEach(() => {
    vi.mocked(Repo.findmatchResultByMatchId)
      .mockResolvedValueOnce(result())                                         // ก่อนยืนยัน
      .mockResolvedValueOnce(result({ match_result_status: 'verified' }));     // อ่านกลับหลังยืนยัน
  });

  it('ส่งใบผลใบนั้นให้ repo พร้อมผู้ยืนยันและแต้มชนะ — ไม่ใช่ใบอื่นหรือแต้มตายตัว', async () => {
    await Service.verifyMatchResult(1, 7);
    expect(Repo.verifyMatchResult).toHaveBeenCalledWith(100, 1, 7, WIN_POINTS);
  });

  it('คืนผลที่อ่านกลับหลังยืนยัน (verified) พร้อมแมตช์ถัดไป', async () => {
    await expect(Service.verifyMatchResult(1, 7)).resolves.toEqual({
      matchId: 1, status: 'verified', winnerTeamId: 10, nextMatchId: 9,
    });
  });

  it('เช็ค walkover ทั้งแมตช์ถัดไปของผู้ชนะ และของผู้แพ้ (double elimination)', async () => {
    await Service.verifyMatchResult(1, 7);
    expect(Walkover.resolveIfOpponentWithdrawn).toHaveBeenCalledWith(9);
    expect(Walkover.resolveIfOpponentWithdrawn).toHaveBeenCalledWith(12);
  });

  it('เช็ค walkover หลัง repo ยืนยันเสร็จเท่านั้น — ทีมต้องถูกวางลงแมตช์ถัดไปก่อน', async () => {
    await Service.verifyMatchResult(1, 7);
    const verifiedAt = vi.mocked(Repo.verifyMatchResult).mock.invocationCallOrder[0]!;
    const walkoverAt = vi.mocked(Walkover.resolveIfOpponentWithdrawn).mock.invocationCallOrder[0]!;
    expect(walkoverAt).toBeGreaterThan(verifiedAt);
  });

  it('แจ้งคู่กรณีว่ายืนยันแล้ว ยกเว้นคนที่กดยืนยันเอง', async () => {
    await Service.verifyMatchResult(1, 7);
    expect(NotificationService.notifyMatchResultParties).toHaveBeenCalledWith(
      1, expect.objectContaining({ type: 'result_verified' }), { exceptUserId: 7 });
  });

  it('repo ล้ม (ทรานแซกชันย้อนกลับ) → ไม่เช็ค walkover และไม่แจ้งใคร', async () => {
    vi.mocked(Repo.verifyMatchResult).mockRejectedValueOnce(new Error('deadlock'));
    await expect(Service.verifyMatchResult(1, 7)).rejects.toThrow('deadlock');
    expect(Walkover.resolveIfOpponentWithdrawn).not.toHaveBeenCalled();
    expect(NotificationService.notifyMatchResultParties).not.toHaveBeenCalled();
  });
});

// ───────────────────────────── disputeMatchResult ─────────────────────────────

describe('disputeMatchResult (S03 · BR-14)', () => {
  beforeEach(() => {
    vi.mocked(Repo.findmatchResultByMatchId)
      .mockResolvedValueOnce(result({ match_result_status: 'verified' }))
      .mockResolvedValueOnce(result({ match_result_status: 'disputed' }));
  });

  it('เปิดข้อพิพาทด้วยเหตุผลอย่างเดียวได้ — ข้อเสนอผลใหม่และหลักฐานเป็น null', async () => {
    await expect(Service.disputeMatchResult(1, 7, { reason: 'กรรมการนับแต้มผิด' }))
      .resolves.toEqual({ matchId: 1, status: 'disputed' });
    expect(Repo.disputeMatchResult).toHaveBeenCalledWith(100, 1, 7, {
      reason: 'กรรมการนับแต้มผิด', claimedWinnerTeamId: null, claimedScore: null, evidenceKeys: null,
    });
  });

  it('ส่งผลที่ควรจะเป็นมาด้วย → ส่งต่อให้ repo ตามที่กรอก', async () => {
    await Service.disputeMatchResult(1, 7, { reason: 'x', claimedWinnerTeamId: 11, claimedScoreData: { '10': 1, '11': 3 } });
    expect(Repo.disputeMatchResult).toHaveBeenCalledWith(100, 1, 7, expect.objectContaining({
      claimedWinnerTeamId: 11, claimedScore: { '10': 1, '11': 3 },
    }));
  });

  it.each([
    ['ผู้ชนะที่อ้างแต้มน้อยกว่า', 11, { '10': 3, '11': 1 }],
    ['ผลเสมอ', 11, { '10': 2, '11': 2 }],
    ['ผู้ชนะไม่ใช่ทีมในแมตช์', 99, { '10': 1, '11': 3 }],
    ['key สกอร์ไม่ใช่สองทีมของแมตช์', 11, { a: 1, b: 3 }],
  ])('ข้อเสนอผลไม่สอดคล้องกับคะแนน (%s) → 400 และไม่เปิดข้อพิพาท', async (_label, winner, score) => {
    await expect(Service.disputeMatchResult(1, 7, { reason: 'x', claimedWinnerTeamId: winner, claimedScoreData: score as Record<string, number> }))
      .rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(Repo.disputeMatchResult).not.toHaveBeenCalled();
    expect(NotificationService.notifyMatchResultParties).not.toHaveBeenCalled();
  });

  it('ข้อเสนอผลที่ผิดรูปแบบ BO-N → SCORE_NOT_IN_MATCH_FORMAT', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ best_of: 3 }));
    await expect(Service.disputeMatchResult(1, 7, { reason: 'x', claimedWinnerTeamId: 11, claimedScoreData: { '10': 19, '11': 21 } }))
      .rejects.toMatchObject({ status: 400, code: 'SCORE_NOT_IN_MATCH_FORMAT' });
  });

  it('หลักฐานของแมตช์นี้ → รับ', async () => {
    const keys = ['dispute_evidence/1/a.png', 'dispute_evidence/1/b.mp4'];
    await Service.disputeMatchResult(1, 7, { reason: 'x', evidenceKeys: keys });
    expect(Repo.disputeMatchResult).toHaveBeenCalledWith(100, 1, 7, expect.objectContaining({ evidenceKeys: keys }));
  });

  it.each([
    ['แมตช์อื่น', 'dispute_evidence/2/a.png'],
    ['เลขแมตช์ที่ขึ้นต้นเหมือนกัน (1 vs 12)', 'dispute_evidence/12/a.png'],
    ['โฟลเดอร์อื่น', 'avatar/1.png'],
  ])('หลักฐานไม่ใช่ของแมตช์นี้ (%s) → 400 และไม่เปิดข้อพิพาท', async (_label, key) => {
    await expect(Service.disputeMatchResult(1, 7, { reason: 'x', evidenceKeys: ['dispute_evidence/1/ok.png', key] }))
      .rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(Repo.disputeMatchResult).not.toHaveBeenCalled();
  });

  it('แจ้งคู่กรณีและผู้จัด (คนตัดสิน) ยกเว้นคนที่โต้แย้งเอง', async () => {
    await Service.disputeMatchResult(1, 7, { reason: 'x' });
    expect(NotificationService.notifyMatchResultParties).toHaveBeenCalledWith(
      1, expect.objectContaining({ type: 'result_disputed' }), { exceptUserId: 7, includeOrganizer: true });
  });
});
