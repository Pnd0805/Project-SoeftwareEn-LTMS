import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../../repositories/matchResultComplaint.repo.js', () => ({
  findById: vi.fn(),
  findByMatchId: vi.fn(() => Promise.resolve([])),
  findOpenByResultAndFiler: vi.fn(() => Promise.resolve(null)),
  countOpenByTournament: vi.fn(() => Promise.resolve(0)),
  fileComplaint: vi.fn(() => Promise.resolve(1)),
  attachOrganizerStatement: vi.fn(() => Promise.resolve(true)),
  decideComplaint: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../repositories/matchResult.repo.js', () => ({
  findmatchResultByMatchId: vi.fn(),
  amendMatchResult: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../middlewares/requireReferee.js', () => ({
  isDisputeWindow: vi.fn(() => Promise.resolve(false)),
  isRefereeOfMatch: vi.fn(() => Promise.resolve(false)),
  isTeamLeaderOfMatch: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../matchResult.service.js', () => ({
  ensureScoreData: vi.fn(),
  findStartedNextMatchId: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../walkover.service.js', () => ({ resolveIfOpponentWithdrawn: vi.fn(() => Promise.resolve([])) }));
vi.mock('../upload.service.js', () => ({ getPresignedDownloadUrl: vi.fn((k: string) => Promise.resolve(`https://s3/${k}`)) }));

import * as Service from '../matchResultComplaint.service.js';
import * as ComplaintRepo from '../../repositories/matchResultComplaint.repo.js';
import * as ResRepo from '../../repositories/matchResult.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TourRepo from '../../repositories/tournament.repo.js';
import * as Referee from '../../middlewares/requireReferee.js';
import * as MatchResService from '../matchResult.service.js';
import * as Walkover from '../walkover.service.js';
import { ORG_RESOLVE_HOURS, WIN_POINTS } from '../../config/scoring.js';

const FILER = 4001;
const ORG = 9003;
const ADMIN = 7777;
const NOW = new Date('2026-09-27T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000);

const match = (o: Record<string, unknown> = {}) => ({
  match_id: 7, tournament_id: 50, team_a_id: 11, team_b_id: 12,
  match_status: 'completed', mode: 'onsite', next_match_id: null, loser_next_match_id: null, ...o,
}) as never;

const result = (o: Record<string, unknown> = {}) => ({
  match_result_id: 300, match_id: 7, winner_team_id: 11, score_data: { 11: 3, 12: 1 },
  match_result_status: 'verified', verified_at: hoursAgo(72), ...o,
}) as never;

const complaint = (o: Record<string, unknown> = {}) => ({
  match_result_complaint_id: 1, match_id: 7, match_result_id: 300, tournament_id: 50,
  filed_by: FILER, filed_by_name: 'หัวหน้าทีม ก', reason: 'อีกฝ่ายส่งคนนอกใบสมัครลงเล่น',
  claimed_winner_team_id: null, claimed_score: null, evidence: null,
  complaint_status: 'open', organizer_statement: null, organizer_statement_by: null, organizer_statement_at: null,
  statement_by_name: null, remedy: null, decided_by: null, decided_by_name: null, decision_note: null, decided_at: null,
  filer_flagged: false, created_at: hoursAgo(ORG_RESOLVE_HOURS + 1), updated_at: null, ...o,
}) as never;

async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as { status: number; code: string; extra?: Record<string, unknown> });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(MatchRepo.findById).mockReset().mockResolvedValue(match());
  vi.mocked(TourRepo.findTournamentById).mockReset().mockResolvedValue({ tournament_id: 50, tournament_status: 'public', sport_type_id: 3 } as never);
  vi.mocked(ResRepo.findmatchResultByMatchId).mockReset().mockResolvedValue(result());
  vi.mocked(Referee.isDisputeWindow).mockReset().mockResolvedValue(false);
  vi.mocked(Referee.isTeamLeaderOfMatch).mockReset().mockResolvedValue(true);
  vi.mocked(Referee.isRefereeOfMatch).mockReset().mockResolvedValue(false);
  vi.mocked(ComplaintRepo.findOpenByResultAndFiler).mockReset().mockResolvedValue(null);
  vi.mocked(ComplaintRepo.findById).mockReset().mockResolvedValue(complaint());
  vi.mocked(ComplaintRepo.fileComplaint).mockReset().mockResolvedValue(1);
  vi.mocked(ComplaintRepo.attachOrganizerStatement).mockReset().mockResolvedValue(true);
  vi.mocked(ComplaintRepo.decideComplaint).mockReset().mockResolvedValue(true);
  vi.mocked(MatchResService.findStartedNextMatchId).mockReset().mockResolvedValue(null);
});

/**
 * OD-26 ข้อ 8 — เส้นนี้มีไว้สำหรับตอนที่ประตูโต้แย้งปิดแล้วแต่ยังมีคนถือหลักฐาน
 * กฎที่ต้องคุ้มครองไว้: ไม่มีสองประตูซ้อนกัน · ผู้จัดปัดตกไม่ได้ · เงียบแล้วเรื่องต้องเดินต่อ
 */
describe('fileComplaint', () => {
  it('files a complaint once the normal dispute window has closed', async () => {
    const dto = await Service.fileComplaint(7, FILER, { reason: 'อีกฝ่ายส่งคนนอกใบสมัครลงเล่น' });

    expect(ComplaintRepo.fileComplaint).toHaveBeenCalledWith(7, 300, FILER, {
      reason: 'อีกฝ่ายส่งคนนอกใบสมัครลงเล่น', claimedWinnerTeamId: null, claimedScore: null, evidenceKeys: null,
    });
    expect(dto.status).toBe('open');
  });

  // ถ้าเปิดทั้งสองประตูพร้อมกัน เรื่องเดียวกันจะเดินสองสายที่มีผลต่างกัน
  it('sends the filer back to the dispute channel while it is still open', async () => {
    vi.mocked(Referee.isDisputeWindow).mockResolvedValue(true);
    expect((await errOf(Service.fileComplaint(7, FILER, { reason: 'x' })))?.code).toBe('USE_DISPUTE_INSTEAD');
  });

  // ผลบายค้านด้วยกลไกปกติไม่ได้เลย เส้นนี้จึงเป็นทางเดียวที่มี — ต้องไม่ไปติดด่าน USE_DISPUTE_INSTEAD
  it('accepts a complaint against a walkover even though verified_at is null', async () => {
    vi.mocked(Referee.isDisputeWindow).mockResolvedValue(true);
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result({ match_result_status: 'walkover', verified_at: null }));
    await expect(Service.fileComplaint(7, FILER, { reason: 'เรามาแข่งแต่ถูกปรับบาย' })).resolves.toBeTruthy();
  });

  it('refuses a result that is not in force yet', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result({ match_result_status: 'submitted' }));
    const err = await errOf(Service.fileComplaint(7, FILER, { reason: 'x' }));
    expect(err?.code).toBe('RESULT_NOT_FINAL');
    expect(err?.extra).toEqual({ status: 'submitted' });
  });

  it('refuses someone who is neither a team leader nor a referee of the match', async () => {
    vi.mocked(Referee.isTeamLeaderOfMatch).mockResolvedValue(false);
    vi.mocked(Referee.isRefereeOfMatch).mockResolvedValue(false);
    expect((await errOf(Service.fileComplaint(7, FILER, { reason: 'x' })))?.code).toBe('NOT_COMPLAINT_PARTY');
  });

  it('lets a referee of the match file too', async () => {
    vi.mocked(Referee.isTeamLeaderOfMatch).mockResolvedValue(false);
    vi.mocked(Referee.isRefereeOfMatch).mockResolvedValue(true);
    await expect(Service.fileComplaint(7, FILER, { reason: 'ผมนับคะแนนผิดเอง' })).resolves.toBeTruthy();
  });

  it('rejects evidence keys belonging to another match', async () => {
    const err = await errOf(Service.fileComplaint(7, FILER, { reason: 'x', evidenceKeys: ['dispute_evidence/99/clip.mp4'] }));
    expect(err?.status).toBe(400);
  });

  // ยื่นซ้ำ = แก้ของเดิม (UNIQUE) แต่ต้องไม่รีเซ็ตเรื่องที่ตัดสินไปแล้วให้กลับมา open
  it('refuses to re-open a complaint that was already decided', async () => {
    vi.mocked(ComplaintRepo.findOpenByResultAndFiler).mockResolvedValue(complaint({ complaint_status: 'no_merit' }));
    const err = await errOf(Service.fileComplaint(7, FILER, { reason: 'x' }));
    expect(err?.code).toBe('COMPLAINT_ALREADY_DECIDED');
  });
});

describe('attachOrganizerStatement', () => {
  it('stores the statement without touching the complaint status', async () => {
    const dto = await Service.attachOrganizerStatement(1, ORG, { statement: 'กรรมการยืนยันว่ารายชื่อถูกต้อง' });
    expect(ComplaintRepo.attachOrganizerStatement).toHaveBeenCalledWith(1, ORG, 'กรรมการยืนยันว่ารายชื่อถูกต้อง');
    expect(dto.status).toBe('open');
  });

  // ผู้จัดเขียนช้าได้ แต่ต้องเห็นว่าช้า — ความเห็นที่มาช้ายังมีประโยชน์กว่าไม่มีเลย
  it('marks a statement written after the organizer window as late', async () => {
    vi.mocked(ComplaintRepo.findById).mockResolvedValue(complaint({
      organizer_statement: 'ขอโทษที่ตอบช้า', organizer_statement_by: ORG, organizer_statement_at: NOW,
    }));
    const dto = await Service.attachOrganizerStatement(1, ORG, { statement: 'ขอโทษที่ตอบช้า' });
    expect(dto.organizerStatement?.late).toBe(true);
  });

  it('refuses once the complaint has been decided', async () => {
    vi.mocked(ComplaintRepo.findById).mockResolvedValue(complaint({ complaint_status: 'upheld', decided_at: NOW }));
    expect((await errOf(Service.attachOrganizerStatement(1, ORG, { statement: 'x' })))?.code).toBe('COMPLAINT_ALREADY_DECIDED');
  });
});

describe('decideComplaint', () => {
  it('records a no-merit decision and flags only the filer', async () => {
    await Service.decideComplaint(1, ADMIN, { outcome: 'no_merit', remedy: 'record_only', note: 'หลักฐานไม่เกี่ยวกับแมตช์นี้' });
    expect(ComplaintRepo.decideComplaint).toHaveBeenCalledWith(1, 7, ADMIN, {
      outcome: 'no_merit', remedy: 'record_only', note: 'หลักฐานไม่เกี่ยวกับแมตช์นี้',
    });
    expect(ResRepo.amendMatchResult).not.toHaveBeenCalled();
  });

  // หลัก "การนิ่งเฉยต้องไม่มีอำนาจยับยั้ง" ทำงานเฉพาะเมื่อนาฬิกาของผู้จัดหมดจริง
  it('holds the admin back while the organizer still has time', async () => {
    vi.mocked(ComplaintRepo.findById).mockResolvedValue(complaint({ created_at: hoursAgo(1) }));
    const err = await errOf(Service.decideComplaint(1, ADMIN, { outcome: 'upheld', remedy: 'record_only', note: 'x' }));
    expect(err?.code).toBe('ORGANIZER_STILL_HAS_TIME');
    expect(err?.extra?.['availableAt']).toBe(new Date(hoursAgo(1).getTime() + ORG_RESOLVE_HOURS * 3600 * 1000).toISOString());
  });

  // ผู้จัดเงียบสนิทก็ต้องตัดสินได้ ไม่ใช่รอความเห็นที่ไม่มีวันมา
  it('lets the admin decide even when the organizer never wrote anything', async () => {
    await expect(Service.decideComplaint(1, ADMIN, { outcome: 'upheld', remedy: 'record_only', note: 'มีมูล' })).resolves.toBeTruthy();
  });

  it('amends the result through the normal amend path when the admin asks for it', async () => {
    await Service.decideComplaint(1, ADMIN, {
      outcome: 'upheld', remedy: 'amend_result', note: 'ผู้เล่นไม่มีสิทธิ์ลงแข่ง', winnerTeamId: 12, scoreData: { 11: 0, 12: 3 },
    });
    expect(ResRepo.amendMatchResult).toHaveBeenCalledWith(
      300, expect.objectContaining({ match_id: 7 }), 11, 12, { 11: 0, 12: 3 }, 3, WIN_POINTS, ADMIN,
      expect.stringContaining('คำวินิจฉัยเรื่องร้องเรียน #1'), true);
    expect(Walkover.resolveIfOpponentWithdrawn).toHaveBeenCalled();
  });

  it('refuses to amend when the next match has already moved', async () => {
    vi.mocked(MatchResService.findStartedNextMatchId).mockResolvedValue(42);
    const err = await errOf(Service.decideComplaint(1, ADMIN, {
      outcome: 'upheld', remedy: 'amend_result', note: 'x', winnerTeamId: 12, scoreData: { 11: 0, 12: 3 },
    }));
    expect(err?.code).toBe('RESULT_NOT_CHANGEABLE');
    expect(err?.extra).toEqual({ blockedBy: 'NEXT_MATCH_STARTED' });
    expect(ResRepo.amendMatchResult).not.toHaveBeenCalled();
    expect(ComplaintRepo.decideComplaint).not.toHaveBeenCalled();
  });

  // ทัวร์ที่ปิดแล้วมีแชมป์และนับ championships ไปแล้ว การแก้ผลย้อนจะทำให้ตัวเลขนั้นโกหก
  it('refuses to amend a result in a tournament that is already closed', async () => {
    vi.mocked(TourRepo.findTournamentById).mockResolvedValue({ tournament_id: 50, tournament_status: 'completed', sport_type_id: 3 } as never);
    const err = await errOf(Service.decideComplaint(1, ADMIN, {
      outcome: 'upheld', remedy: 'amend_result', note: 'x', winnerTeamId: 12, scoreData: { 11: 0, 12: 3 },
    }));
    expect(err?.code).toBe('RESULT_NOT_CHANGEABLE');
    expect(err?.extra).toEqual({ blockedBy: 'TOURNAMENT_COMPLETED' });
  });

  it('refuses to amend a walkover, which has no real score to correct', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue(result({ match_result_status: 'walkover', verified_at: null }));
    const err = await errOf(Service.decideComplaint(1, ADMIN, {
      outcome: 'upheld', remedy: 'amend_result', note: 'x', winnerTeamId: 12, scoreData: { 11: 0, 12: 3 },
    }));
    expect(err?.extra).toEqual({ blockedBy: 'RESULT_NOT_AMENDABLE' });
  });

  it('refuses a complaint that someone else already decided', async () => {
    vi.mocked(ComplaintRepo.findById).mockResolvedValue(complaint({ complaint_status: 'upheld', decided_at: NOW }));
    expect((await errOf(Service.decideComplaint(1, ADMIN, { outcome: 'upheld', remedy: 'record_only', note: 'x' })))?.code)
      .toBe('COMPLAINT_ALREADY_DECIDED');
  });
});

describe('listComplaintsOfMatch', () => {
  it('tells the decider up front whether the result can still be changed', async () => {
    vi.mocked(ComplaintRepo.findByMatchId).mockResolvedValue([complaint(), complaint({ match_result_complaint_id: 2, filed_by: 4002 })] as never);
    const out = await Service.listComplaintsOfMatch(7);
    expect(out.canAmendResult).toBe(true);
    expect(out.amendBlockedBy).toBeNull();
    expect(out.complaints).toHaveLength(2);
  });

  it('turns evidence keys into presigned URLs and never leaks the raw key', async () => {
    vi.mocked(ComplaintRepo.findByMatchId).mockResolvedValue([complaint({ evidence: ['dispute_evidence/7/clip.mp4'] })] as never);
    const out = await Service.listComplaintsOfMatch(7);
    expect(out.complaints[0]!.evidence).toEqual(['https://s3/dispute_evidence/7/clip.mp4']);
  });

  // stage คิดจากเวลาอย่างเดียว จึงไม่มีสถานะในตารางให้ใครลืมอัปเดต
  it('reports which side the complaint is sitting with', async () => {
    vi.mocked(ComplaintRepo.findByMatchId).mockResolvedValue([
      complaint({ match_result_complaint_id: 1, created_at: hoursAgo(1) }),
      complaint({ match_result_complaint_id: 2, filed_by: 4002, created_at: hoursAgo(ORG_RESOLVE_HOURS + 5) }),
      complaint({ match_result_complaint_id: 3, filed_by: 4003, complaint_status: 'upheld', decided_at: NOW }),
    ] as never);
    const out = await Service.listComplaintsOfMatch(7);
    expect(out.complaints.map(c => c.stage)).toEqual(['organizer', 'admin', 'decided']);
  });
});
