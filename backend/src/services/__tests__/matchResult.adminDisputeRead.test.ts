import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminTakeoverOpensAt, isAdminTakeoverOpen } from '../../utils/disputeTakeover.js';
import { ORG_RESOLVE_HOURS } from '../../config/scoring.js';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(), notifyTeamMembers: vi.fn(),
  notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/matchResult.repo.js', () => ({
  findmatchResultByMatchId: vi.fn(), findDisputeByMatchId: vi.fn(),
  findStandings: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({
  findTournamentById: vi.fn(), findUnfinishedMatchIds: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../../repositories/team.repo.js', () => ({ findTeamIdOfUserInMatch: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn() }));
vi.mock('../walkover.service.js', () => ({}));
vi.mock('../upload.service.js', () => ({ getPresignedDownloadUrl: vi.fn((k: string) => Promise.resolve(`signed://${k}`)) }));
vi.mock('../../middlewares/requireReferee.js', () => ({
  isRefereeOfMatch: vi.fn(() => Promise.resolve(false)),
  isTeamLeaderOfMatch: vi.fn(() => Promise.resolve(false)),
}));
vi.mock('../../utils/checkExist.js', () => ({ checkMatch: vi.fn(), checkTournament: vi.fn(), checkTeam: vi.fn() }));

import * as Service from '../matchResult.service.js';
import * as ResRepo from '../../repositories/matchResult.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import { isRefereeOfMatch, isTeamLeaderOfMatch } from '../../middlewares/requireReferee.js';
import { checkMatch } from '../../utils/checkExist.js';

/**
 * OD-58 (4 ต.ค. 2569) — แอดมินมหาวิทยาลัยที่ถึงคิวรับช่วงตัดสิน ต้องอ่านเรื่องได้
 *
 * 🔴 ก่อนหน้านี้ `requireCanResolveDispute` ให้เขา **กด** S04 ได้หลัง 48 ชม.
 *   แต่ `canSeeUnfinishedResult` ไม่รับแอดมิน ⇒ เขาอ่านสกอร์ที่ถูกค้าน คำค้าน
 *   และหลักฐานไม่ได้เลย = มีอำนาจตัดสินโดยไม่มีข้อมูลที่ต้องใช้ตัดสิน (FE แจ้งมา 1 ต.ค.)
 *
 * ★ เทสชุดนี้ตรึงว่า "อ่านได้" ผูกกับ "กดได้" ด้วยเส้นเวลาเดียวกัน
 *   ถ้าใครแก้เส้นหนึ่งโดยไม่แก้อีกเส้น จะได้ทางตันแบบเดิมกลับมาโดยไม่มี error ฟ้อง
 */

const MATCH = 7, TOURNAMENT = 50, ORG = 9001, ADMIN = 9500, OUTSIDER = 9900;
const HOUR = 3600 * 1000;

const match = () => ({ match_id: MATCH, tournament_id: TOURNAMENT, team_a_id: 11, team_b_id: 12,
                       next_match_id: null, loser_next_match_id: null }) as never;

/** ผลที่ยัง **ไม่ final** (disputed) — คนนอกต้องได้ 404 */
const disputedResult = (raisedAt: Date | null) => ({
  match_result_id: 1, match_id: MATCH, winner_team_id: 11, score_data: { 11: 3, 12: 1 },
  match_result_status: 'disputed', verified_at: null, amended_at: null, amend_reason: null,
  dispute_reason: 'ส่งผู้เล่นนอกใบสมัครลงแข่ง', dispute_raised_by: 4001, dispute_raised_at: raisedAt,
  dispute_resolution: null, dispute_resolved_by: null, dispute_resolved_at: null,
}) as never;

const raisedHoursAgo = (h: number) => new Date(Date.now() - h * HOUR);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(MatchRepo.findById).mockReset().mockResolvedValue(match());
  vi.mocked(checkMatch).mockReset().mockResolvedValue(match());
  vi.mocked(TournamentRepo.findTournamentById).mockReset()
    .mockResolvedValue({ tournament_id: TOURNAMENT, requested_by_user_id: ORG, dispute_window_hours: 24 } as never);
  vi.mocked(TournamentRepo.findUnfinishedMatchIds).mockReset().mockResolvedValue([]);
  vi.mocked(isRefereeOfMatch).mockReset().mockResolvedValue(false);
  vi.mocked(isTeamLeaderOfMatch).mockReset().mockResolvedValue(false);
  vi.mocked(AdminRepo.findAdminByUserId).mockReset().mockResolvedValue(null as never);
});

describe('S05 getVerifiedResult — ผลที่ยังไม่ final', () => {
  it('★ แอดมินมหาวิทยาลัย + ครบ 48 ชม. → อ่านได้ (เดิม 404)', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(disputedResult(raisedHoursAgo(ORG_RESOLVE_HOURS + 1)));
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);

    const dto = await Service.getVerifiedResult(MATCH, ADMIN);

    expect(dto.status).toBe('disputed');
    // ต้องเห็น "ตัวคำค้าน" ด้วย ไม่ใช่แค่ผ่านด่าน — นั่นคือสิ่งที่เขาต้องใช้ตัดสิน
    expect(dto).toHaveProperty('disputeReason');
    expect(dto).toHaveProperty('disputeRaisedBy');
  });

  it('★ แอดมินมหาวิทยาลัย แต่ยังไม่ครบ 48 ชม. → ยัง 404 (ผู้จัดยังมีเวลาของเขา)', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(disputedResult(raisedHoursAgo(ORG_RESOLVE_HOURS - 1)));
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);

    await expect(Service.getVerifiedResult(MATCH, ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  it('แอดมินคณะ (faculty) → 404 แม้ครบเวลา — ขอบเขตตรงกับด่านกดตัดสิน', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(disputedResult(raisedHoursAgo(ORG_RESOLVE_HOURS + 10)));
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'faculty' } as never);

    await expect(Service.getVerifiedResult(MATCH, ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  it('ไม่มีข้อโต้แย้ง (ผลเป็น submitted เฉย ๆ) → แอดมินก็ยังอ่านไม่ได้', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(disputedResult(null));
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);

    await expect(Service.getVerifiedResult(MATCH, ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  it('คนนอกที่ไม่ใช่แอดมิน → 404 เหมือนเดิม (ไม่ได้เปิดกว้างให้ใครเพิ่ม)', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(disputedResult(raisedHoursAgo(ORG_RESOLVE_HOURS + 10)));

    await expect(Service.getVerifiedResult(MATCH, OUTSIDER)).rejects.toMatchObject({ status: 404 });
    expect(AdminRepo.findAdminByUserId).toHaveBeenCalledWith(OUTSIDER);
  });

  it('ผู้จัดยังอ่านได้ตลอด และไม่ต้องไปถาม AdminRepo เลย', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(disputedResult(raisedHoursAgo(1)));

    await expect(Service.getVerifiedResult(MATCH, ORG)).resolves.toMatchObject({ status: 'disputed' });
    expect(AdminRepo.findAdminByUserId).not.toHaveBeenCalled();
  });
});

describe('S03b getDispute — ตัวคำค้าน + หลักฐาน', () => {
  const disputeRow = (raisedAt: Date) => ({
    match_id: MATCH, match_result_status: 'disputed',
    dispute_reason: 'ส่งผู้เล่นนอกใบสมัคร', dispute_raised_by: 4001, raised_by_name: 'หัวหน้าทีม ก',
    dispute_raised_at: raisedAt, dispute_claimed_winner_team_id: 12, dispute_claimed_score: { 11: 1, 12: 3 },
    dispute_evidence: ['reports/ev1.png'], dispute_resolution: null, dispute_resolved_at: null,
  }) as never;

  it('★ แอดมินที่ถึงคิวแล้ว อ่านคำค้านและได้หลักฐานเป็น presigned URL', async () => {
    const raisedAt = raisedHoursAgo(ORG_RESOLVE_HOURS + 1);
    vi.mocked(ResRepo.findDisputeByMatchId).mockResolvedValue(disputeRow(raisedAt));
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(disputedResult(raisedAt));
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);

    const dto = await Service.getDispute(MATCH, ADMIN);

    expect(dto.claimedWinnerTeamId).toBe(12);
    expect(dto.evidence).toEqual(['signed://reports/ev1.png']);
  });

  it('แอดมินที่ยังไม่ถึงคิว → 403 เหมือนคนนอก', async () => {
    const raisedAt = raisedHoursAgo(1);
    vi.mocked(ResRepo.findDisputeByMatchId).mockResolvedValue(disputeRow(raisedAt));
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(disputedResult(raisedAt));
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);

    await expect(Service.getDispute(MATCH, ADMIN)).rejects.toMatchObject({ status: 403 });
  });
});

/**
 * ★ สูตรเวลาอยู่ที่ utils ที่เดียวเพราะ middleware กับ service ต้องตอบตรงกันเป๊ะ
 *   เทสชุดนี้ตรึงตัวสูตร ไม่ใช่ตรึงพฤติกรรมของ endpoint
 */
describe('utils/disputeTakeover — สูตรเวลาที่ใช้ร่วมกันสองที่', () => {
  it('ไม่มีข้อโต้แย้ง → ไม่มีเวลาเปิด และไม่เปิดตลอด', () => {
    expect(adminTakeoverOpensAt(null)).toBeNull();
    expect(isAdminTakeoverOpen(null)).toBe(false);
  });

  it('เวลาเปิด = เวลาค้าน + ORG_RESOLVE_HOURS เป๊ะ', () => {
    const raisedAt = new Date('2026-10-01T00:00:00Z');
    expect(adminTakeoverOpensAt(raisedAt)!.getTime())
      .toBe(raisedAt.getTime() + ORG_RESOLVE_HOURS * HOUR);
  });

  it('ขอบเปิดนับรวม — ตรงเวลาพอดีถือว่าเปิดแล้ว', () => {
    const raisedAt = new Date('2026-10-01T00:00:00Z');
    const openAt = adminTakeoverOpensAt(raisedAt)!.getTime();
    expect(isAdminTakeoverOpen(raisedAt, openAt - 1)).toBe(false);
    expect(isAdminTakeoverOpen(raisedAt, openAt)).toBe(true);
  });
});
