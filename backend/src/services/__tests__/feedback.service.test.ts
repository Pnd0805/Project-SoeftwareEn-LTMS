import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../repositories/feedback.repo.js', () => ({
  isTournamentParticipant: vi.fn(),
  isTournamentInsider: vi.fn(),
  findMvpCandidates: vi.fn(() => Promise.resolve([])),
  findOwn: vi.fn(() => Promise.resolve(null)),
  upsertOrganizerFeedback: vi.fn(),
  upsertMvpVote: vi.fn(),
  summarizeOrganizerFeedback: vi.fn(() => Promise.resolve({ average: null, count: 0, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 })),
  listOrganizerFeedback: vi.fn(() => Promise.resolve([])),
  findById: vi.fn(),
  markReported: vi.fn(),
  removeByAdmin: vi.fn(),
}));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(() => Promise.resolve(null)) }));

import * as Service from '../feedback.service.js';
import * as FeedbackRepo from '../../repositories/feedback.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import type { FeedbackRow } from '../../repositories/feedback.repo.js';

const COMPLETED_AT = new Date('2026-09-20T00:00:00Z');
const ORG = 7;

function tournament(overrides: Record<string, unknown> = {}) {
  return { tournament_id: 20, requested_by_user_id: ORG, tournament_status: 'completed', completed_at: COMPLETED_AT, ...overrides } as never;
}
function feedbackRow(overrides: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    tournament_feedback_id: 1, tournament_id: 20, user_id: 5, feedback_type: 'organizer_feedback',
    content: 'ดีมาก', rating: 5, voted_for_user_id: null, match_id: null, is_reported: 0, removed_at: null,
    created_at: new Date('2026-09-21T00:00:00Z'), ...overrides,
  };
}
async function errOf(p: Promise<unknown>) {
  return p.then(() => null, (e: unknown) => e as { status: number; code: string });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-22T00:00:00Z'));   // 2 วันหลังปิดทัวร์ → ยังอยู่ในช่วงโหวต MVP
  vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament());
  // clearAllMocks ไม่ล้าง mockResolvedValue ของเทสต์ก่อน → ตั้งค่าเริ่มต้นใหม่ทุกครั้ง
  vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue(null as never);
  vi.mocked(FeedbackRepo.findOwn).mockResolvedValue(null);
  vi.mocked(FeedbackRepo.findMvpCandidates).mockResolvedValue([]);
  vi.mocked(FeedbackRepo.listOrganizerFeedback).mockResolvedValue([]);
  vi.mocked(FeedbackRepo.summarizeOrganizerFeedback).mockResolvedValue({ average: null, count: 0, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 });
});
afterEach(() => vi.useRealTimers());

describe('submitOrganizerFeedback — มติ C6 ข้อ 1–3', () => {
  it('a participant rates a completed tournament → saved (201 isNew)', async () => {
    vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
    vi.mocked(FeedbackRepo.findOwn).mockResolvedValueOnce(null).mockResolvedValueOnce(feedbackRow());

    const result = await Service.submitOrganizerFeedback(20, 5, { rating: 5, content: 'ดีมาก' });

    expect(FeedbackRepo.upsertOrganizerFeedback).toHaveBeenCalledWith(20, 5, 5, 'ดีมาก');
    expect(result).toMatchObject({ id: 1, rating: 5, isNew: true });
  });

  it('sending again replaces the old one (isNew false)', async () => {
    vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
    vi.mocked(FeedbackRepo.findOwn).mockResolvedValue(feedbackRow({ rating: 2 }));

    const result = await Service.submitOrganizerFeedback(20, 5, { rating: 4 });

    expect(FeedbackRepo.upsertOrganizerFeedback).toHaveBeenCalledWith(20, 5, 4, null);
    expect(result.isNew).toBe(false);
  });

  // มติแก้ 21 ก.ย. — ให้คะแนนได้ตลอด ไม่ต้องรอปิดทัวร์
  it('a participant can rate while the tournament is still running', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'public', completed_at: null }));
    vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
    vi.mocked(FeedbackRepo.findOwn).mockResolvedValueOnce(null).mockResolvedValueOnce(feedbackRow());
    await expect(Service.submitOrganizerFeedback(20, 5, { rating: 5 })).resolves.toMatchObject({ isNew: true });
  });

  it('409 FEEDBACK_CLOSED 7 days after the tournament closed (same time as MVP)', async () => {
    vi.setSystemTime(new Date('2026-09-27T00:00:01Z'));
    vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
    expect(await errOf(Service.submitOrganizerFeedback(20, 5, { rating: 5 }))).toMatchObject({ status: 409, code: 'FEEDBACK_CLOSED' });
    expect(FeedbackRepo.upsertOrganizerFeedback).not.toHaveBeenCalled();
  });

  it('403 ORGANIZER_CANNOT_REVIEW_OWN for the organizer', async () => {
    expect(await errOf(Service.submitOrganizerFeedback(20, ORG, { rating: 5 }))).toMatchObject({ status: 403, code: 'ORGANIZER_CANNOT_REVIEW_OWN' });
  });

  it('403 FEEDBACK_NOT_ALLOWED for someone who took no part', async () => {
    vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(false);
    expect(await errOf(Service.submitOrganizerFeedback(20, 99, { rating: 5 }))).toMatchObject({ status: 403, code: 'FEEDBACK_NOT_ALLOWED' });
    expect(FeedbackRepo.upsertOrganizerFeedback).not.toHaveBeenCalled();
  });

  it('a tournament closed before completed_at existed counts as closed (legacy data)', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ completed_at: null }));
    vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
    expect(await errOf(Service.submitOrganizerFeedback(20, 5, { rating: 5 }))).toMatchObject({ status: 409, code: 'FEEDBACK_CLOSED' });
    expect(await errOf(Service.castMvpVote(20, 50, 101))).toMatchObject({ status: 409, code: 'MVP_VOTING_CLOSED' });
  });

  it('409 FEEDBACK_REMOVED when an admin removed their earlier feedback', async () => {
    vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
    vi.mocked(FeedbackRepo.findOwn).mockResolvedValue(feedbackRow({ removed_at: new Date() }));
    expect(await errOf(Service.submitOrganizerFeedback(20, 5, { rating: 5 }))).toMatchObject({ status: 409, code: 'FEEDBACK_REMOVED' });
  });
});

describe('getOrganizerFeedback — ใครเห็นอะไร', () => {
  const listed = [{ ...feedbackRow(), author_name: 'สมชาย' }];

  it('anyone sees only the summary', async () => {
    vi.mocked(FeedbackRepo.summarizeOrganizerFeedback).mockResolvedValue({ average: 4.25, count: 4, r1: 0, r2: 0, r3: 1, r4: 1, r5: 2 });
    const result = await Service.getOrganizerFeedback(20);
    expect(result.summary).toEqual({ average: 4.3, count: 4, distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 } });
    expect(result.items).toBeNull();
  });

  it('the organizer sees every note but not who wrote it', async () => {
    vi.mocked(FeedbackRepo.listOrganizerFeedback).mockResolvedValue(listed);
    const result = await Service.getOrganizerFeedback(20, ORG);
    expect(result.items![0]).toMatchObject({ content: 'ดีมาก', author: null });
    expect(result.canSubmit).toBe(false);
  });

  it('a university-wide admin also sees the author', async () => {
    vi.mocked(FeedbackRepo.listOrganizerFeedback).mockResolvedValue(listed);
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);
    const result = await Service.getOrganizerFeedback(20, 1);
    expect(result.items![0]!.author).toEqual({ id: 5, fullName: 'สมชาย' });
  });

  it('a participant sees their own feedback and canSubmit', async () => {
    vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
    vi.mocked(FeedbackRepo.findOwn).mockResolvedValue(feedbackRow());
    const result = await Service.getOrganizerFeedback(20, 5);
    expect(result.mine).toMatchObject({ rating: 5, content: 'ดีมาก' });
    expect(result.canSubmit).toBe(true);
    expect(result.items).toBeNull();
  });
});

describe('castMvpVote — มติ C6 ข้อ 2 และ 4', () => {
  const candidates = [{ user_id: 101, full_name: 'ก', profile_image_key: null, team_id: 1, team_name: 'A', votes: 3 }];

  it('an outsider votes for a registered player', async () => {
    vi.mocked(FeedbackRepo.isTournamentInsider).mockResolvedValue(false);
    vi.mocked(FeedbackRepo.findMvpCandidates).mockResolvedValue(candidates);

    await expect(Service.castMvpVote(20, 50, 101)).resolves.toMatchObject({ votedForUserId: 101, changed: false });
    expect(FeedbackRepo.upsertMvpVote).toHaveBeenCalledWith(20, 50, 101);
  });

  it('403 MVP_VOTER_NOT_ELIGIBLE for players / team members / referees', async () => {
    vi.mocked(FeedbackRepo.isTournamentInsider).mockResolvedValue(true);
    expect(await errOf(Service.castMvpVote(20, 101, 101))).toMatchObject({ status: 403, code: 'MVP_VOTER_NOT_ELIGIBLE' });
  });

  it('403 MVP_VOTER_NOT_ELIGIBLE for the organizer', async () => {
    vi.mocked(FeedbackRepo.isTournamentInsider).mockResolvedValue(false);
    expect(await errOf(Service.castMvpVote(20, ORG, 101))).toMatchObject({ status: 403, code: 'MVP_VOTER_NOT_ELIGIBLE' });
  });

  it('422 MVP_CANDIDATE_NOT_ELIGIBLE for someone who did not play', async () => {
    vi.mocked(FeedbackRepo.isTournamentInsider).mockResolvedValue(false);
    vi.mocked(FeedbackRepo.findMvpCandidates).mockResolvedValue(candidates);
    expect(await errOf(Service.castMvpVote(20, 50, 999))).toMatchObject({ status: 422, code: 'MVP_CANDIDATE_NOT_ELIGIBLE' });
  });

  it('409 MVP_VOTING_CLOSED after 7 days', async () => {
    vi.setSystemTime(new Date('2026-09-27T00:00:01Z'));
    expect(await errOf(Service.castMvpVote(20, 50, 101))).toMatchObject({ status: 409, code: 'MVP_VOTING_CLOSED' });
  });

  it('changing the vote inside the window is allowed (replace)', async () => {
    vi.mocked(FeedbackRepo.isTournamentInsider).mockResolvedValue(false);
    vi.mocked(FeedbackRepo.findMvpCandidates).mockResolvedValue(candidates);
    vi.mocked(FeedbackRepo.findOwn).mockResolvedValue(feedbackRow({ feedback_type: 'mvp_vote', voted_for_user_id: 202 }));
    await expect(Service.castMvpVote(20, 50, 101)).resolves.toMatchObject({ changed: true });
  });
});

describe('getMvpVotes', () => {
  const candidates = [
    { user_id: 101, full_name: 'ก', profile_image_key: null, team_id: 1, team_name: 'A', votes: 3 },
    { user_id: 102, full_name: 'ข', profile_image_key: null, team_id: 2, team_name: 'B', votes: 3 },
    { user_id: 103, full_name: 'ค', profile_image_key: null, team_id: 2, team_name: 'B', votes: 1 },
  ];

  it('shows the window and no winner while voting is open', async () => {
    vi.mocked(FeedbackRepo.findMvpCandidates).mockResolvedValue(candidates);
    const result = await Service.getMvpVotes(20);
    expect(result.window.isOpen).toBe(true);
    expect(result.totalVotes).toBe(7);
    expect(result.winners).toEqual([]);
  });

  it('announces the winners (ties allowed) once voting closes', async () => {
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
    vi.mocked(FeedbackRepo.findMvpCandidates).mockResolvedValue(candidates);
    const result = await Service.getMvpVotes(20);
    expect(result.window.isOpen).toBe(false);
    expect(result.winners).toEqual([101, 102]);
  });
});

describe('report / remove', () => {
  it('the organizer reports a note on their tournament', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(feedbackRow());
    await expect(Service.reportFeedback(1, ORG)).resolves.toEqual({ id: 1, isReported: true });
    expect(FeedbackRepo.markReported).toHaveBeenCalledWith(1);
  });

  it('someone who cannot see the note gets 404', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(feedbackRow());
    expect(await errOf(Service.reportFeedback(1, 99))).toMatchObject({ status: 404, code: 'FEEDBACK_NOT_FOUND' });
  });

  it('an MVP vote cannot be reported', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(feedbackRow({ feedback_type: 'mvp_vote' }));
    expect(await errOf(Service.reportFeedback(1, ORG))).toMatchObject({ status: 400, code: 'FEEDBACK_NOT_REPORTABLE' });
  });

  it('admin removes once; a second time is 409', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(feedbackRow());
    vi.mocked(FeedbackRepo.removeByAdmin).mockResolvedValue(true);
    await expect(Service.removeFeedback(1, 3, 'หยาบคาย')).resolves.toBeUndefined();
    expect(FeedbackRepo.removeByAdmin).toHaveBeenCalledWith(1, 3, 'หยาบคาย');

    vi.mocked(FeedbackRepo.findById).mockResolvedValue(feedbackRow({ removed_at: new Date() }));
    expect(await errOf(Service.removeFeedback(1, 3))).toMatchObject({ status: 409, code: 'FEEDBACK_ALREADY_REMOVED' });
  });
});
