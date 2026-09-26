import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../repositories/feedback.repo.js', () => ({
  hasPlayedMatch: vi.fn(() => Promise.resolve(false)),
  isTournamentParticipant: vi.fn(),
  isTournamentInsider: vi.fn(),
  findMvpCandidatesOfMatch: vi.fn(() => Promise.resolve([])),
  findMatchPlayerStats: vi.fn(() => Promise.resolve([])),
  isMemberOfMatchTeams: vi.fn(() => Promise.resolve(false)),
  findOwnMatchVote: vi.fn(() => Promise.resolve(null)),
  findOwn: vi.fn(() => Promise.resolve(null)),
  upsertOrganizerFeedback: vi.fn(),
  upsertMvpVote: vi.fn(),
  summarizeOrganizerFeedback: vi.fn(() => Promise.resolve({ average: null, count: 0, r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 })),
  listOrganizerFeedback: vi.fn(() => Promise.resolve([])),
  findById: vi.fn(),
  markReported: vi.fn(),
  softRemove: vi.fn(),
  restore: vi.fn(),
  upsertComment: vi.fn(),
  findOwnComment: vi.fn(() => Promise.resolve(null)),
  listComments: vi.fn(() => Promise.resolve({ rows: [], totalItems: 0 })),
  deleteOwnComment: vi.fn(() => Promise.resolve(true)),
}));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/matchResult.repo.js', () => ({ findVerifiedResultByMatchId: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../notification.service.js', () => ({ notify: vi.fn() }));

import * as Service from '../feedback.service.js';
import * as FeedbackRepo from '../../repositories/feedback.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as MatchResultRepo from '../../repositories/matchResult.repo.js';
import * as NotificationService from '../notification.service.js';
import type { FeedbackRow } from '../../repositories/feedback.repo.js';

const COMPLETED_AT = new Date('2026-09-20T00:00:00Z');
const ORG = 7;

function tournament(overrides: Record<string, unknown> = {}) {
  return { tournament_id: 20, requested_by_user_id: ORG, tournament_status: 'completed', completed_at: COMPLETED_AT,
           event_start_date: '2026-09-01', ...overrides } as never;
}
/** แมตช์ที่จบแล้วเมื่อ 6 ชม. ก่อน NOW ของไฟล์นี้ (22 ก.ย. 00:00Z) → อยู่ในหน้าต่างโหวต 24 ชม. */
function match(overrides: Record<string, unknown> = {}) {
  return { match_id: 7, tournament_id: 20, match_status: 'finished', team_a_id: 1, team_b_id: 2,
           actual_end_time: new Date('2026-09-21T18:00:00Z'), ...overrides } as never;
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
  vi.mocked(FeedbackRepo.findOwn).mockReset().mockResolvedValue(null);   // reset = ล้าง mockResolvedValueOnce ที่ค้างจากเทสต์ที่ throw ก่อนใช้
  vi.mocked(FeedbackRepo.hasPlayedMatch).mockResolvedValue(false);
  vi.mocked(FeedbackRepo.findOwnComment).mockReset().mockResolvedValue(null);
  vi.mocked(FeedbackRepo.listComments).mockResolvedValue({ rows: [], totalItems: 0 });
  vi.mocked(FeedbackRepo.findMvpCandidatesOfMatch).mockResolvedValue([]);
  vi.mocked(FeedbackRepo.findMatchPlayerStats).mockResolvedValue([]);
  vi.mocked(FeedbackRepo.isMemberOfMatchTeams).mockResolvedValue(false);
  vi.mocked(FeedbackRepo.findOwnMatchVote).mockResolvedValue(null);
  vi.mocked(MatchRepo.findById).mockResolvedValue(match());
  vi.mocked(MatchResultRepo.findVerifiedResultByMatchId).mockResolvedValue(null);
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
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'public', completed_at: null }));   // เริ่ม 1 ก.ย. แล้ว
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
    // โหวต MVP ไม่เกี่ยวกับเวลาปิดทัวร์แล้ว (มติ 26 ก.ย. — ย้ายไปผูกกับเวลาจบของแต่ละแมตช์)
  });

  // มติ 22 ก.ย. — เปิดตั้งแต่ทัวร์เริ่ม: ถึงวันเริ่มทัวร์ (เวลาไทย) หรือมีแมตช์ที่แข่งจริงแล้ว
  describe('opens when the tournament starts', () => {
    const upcoming = () => tournament({ tournament_status: 'public', completed_at: null, event_start_date: '2026-10-01' });

    it('409 TOURNAMENT_NOT_STARTED before the start date with no played match — opensAt = start date 00:00 Bangkok', async () => {
      vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(upcoming());
      vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
      const err = await errOf(Service.submitOrganizerFeedback(20, 5, { rating: 5 }));
      expect(err).toMatchObject({ status: 409, code: 'TOURNAMENT_NOT_STARTED' });
      expect((err as unknown as { extra: { opensAt: Date } }).extra.opensAt.toISOString()).toBe('2026-09-30T17:00:00.000Z');
      expect(FeedbackRepo.upsertOrganizerFeedback).not.toHaveBeenCalled();
    });

    it('open from 00:00 Bangkok time on the start date', async () => {
      vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(upcoming());
      vi.setSystemTime(new Date('2026-09-30T16:59:59Z'));
      expect(await Service.feedbackStatus(upcoming())).toBe('not_started');
      vi.setSystemTime(new Date('2026-09-30T17:00:00Z'));
      expect(await Service.feedbackStatus(upcoming())).toBe('open');
    });

    it('open before the start date once a match has really been played (organizer started early)', async () => {
      vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(upcoming());
      vi.mocked(FeedbackRepo.hasPlayedMatch).mockResolvedValue(true);
      vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
      vi.mocked(FeedbackRepo.findOwn).mockResolvedValueOnce(null).mockResolvedValueOnce(feedbackRow());
      await expect(Service.submitOrganizerFeedback(20, 5, { rating: 5 })).resolves.toMatchObject({ isNew: true });
    });

    it('GET shows status not_started, opensAt, and canSubmit false for a participant', async () => {
      vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(upcoming());
      vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
      const result = await Service.getOrganizerFeedback(20, 5);
      expect(result).toMatchObject({ status: 'not_started', canSubmit: false, closesAt: null });
      expect(result.opensAt.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    });

    it('status closed 7 days after completion; open for a completed tournament inside the window', async () => {
      expect(await Service.feedbackStatus(tournament())).toBe('open');
      vi.setSystemTime(new Date('2026-09-27T00:00:01Z'));
      expect(await Service.feedbackStatus(tournament())).toBe('closed');
    });

    it('editing = sending again while open overwrites the rating', async () => {
      vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
      vi.mocked(FeedbackRepo.findOwn).mockResolvedValueOnce(feedbackRow({ rating: 1 })).mockResolvedValueOnce(feedbackRow({ rating: 4 }));
      await expect(Service.submitOrganizerFeedback(20, 5, { rating: 4, content: 'แก้ใหม่' })).resolves.toMatchObject({ rating: 4, isNew: false });
      expect(FeedbackRepo.upsertOrganizerFeedback).toHaveBeenCalledWith(20, 5, 4, 'แก้ใหม่');
    });
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

// มติ 26 ก.ย. — MVP ย้ายมาเป็นรายแมตช์ · เปิดตอนแมตช์จบ ปิด +24 ชม. · ห้ามโชว์คะแนนระหว่างเปิดโหวต
describe('castMvpVote (รายแมตช์)', () => {
  const ENDED = new Date('2026-09-21T18:00:00Z');                    // แมตช์จบ · NOW ของไฟล์นี้คือ 22 ก.ย. 00:00Z (6 ชม. ต่อมา)
  const candidates = [{ user_id: 101, full_name: 'ก', profile_image_key: null, team_id: 1, votes: 3 }];

  beforeEach(() => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match());
    vi.mocked(MatchResultRepo.findVerifiedResultByMatchId).mockResolvedValue(null);
    vi.mocked(FeedbackRepo.isMemberOfMatchTeams).mockResolvedValue(false);
    vi.mocked(FeedbackRepo.findMvpCandidatesOfMatch).mockResolvedValue(candidates);
    vi.mocked(FeedbackRepo.findOwnMatchVote).mockReset().mockResolvedValue(null);
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'public', completed_at: null }));
  });

  // มติ 26 ก.ย. — กฎเดียวกับความเห็นต่อทัวร์/Pick'em: ทัวร์ที่ไม่ได้เปิดเผยแพร่ เขียนอะไรไม่ได้
  it.each(['private', 'pending_approval', 'rejected', 'auto_deleted'])('409 TOURNAMENT_NOT_PUBLIC when the tournament is %s', async (status) => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: status }));
    expect(await errOf(Service.castMvpVote(7, 50, 101))).toMatchObject({ status: 409, code: 'TOURNAMENT_NOT_PUBLIC' });
    expect(FeedbackRepo.upsertMvpVote).not.toHaveBeenCalled();
  });

  it('409 TOURNAMENT_NOT_PUBLIC when the tournament was deleted', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(null);
    expect(await errOf(Service.castMvpVote(7, 50, 101))).toMatchObject({ status: 409, code: 'TOURNAMENT_NOT_PUBLIC' });
  });

  it('a completed tournament can still be voted on (within 24 h of the match)', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament());   // completed
    await expect(Service.castMvpVote(7, 50, 101)).resolves.toMatchObject({ isNew: true });
  });

  it('an outsider votes for someone who checked in → isNew · saved with the match id', async () => {
    await expect(Service.castMvpVote(7, 50, 101)).resolves.toMatchObject({ isNew: true, matchId: 7, votedForUserId: 101, changed: false });
    expect(FeedbackRepo.upsertMvpVote).toHaveBeenCalledWith(20, 7, 50, 101);
  });

  it('voting again for someone else replaces the vote (isNew false, changed true)', async () => {
    vi.mocked(FeedbackRepo.findOwnMatchVote).mockResolvedValue(feedbackRow({ feedback_type: 'mvp_vote', voted_for_user_id: 202 }));
    await expect(Service.castMvpVote(7, 50, 101)).resolves.toMatchObject({ isNew: false, changed: true });
  });

  it('403 for a member of either team — even one who did not play', async () => {
    vi.mocked(FeedbackRepo.isMemberOfMatchTeams).mockResolvedValue(true);
    expect(await errOf(Service.castMvpVote(7, 9, 101))).toMatchObject({ status: 403, code: 'MVP_VOTER_NOT_ELIGIBLE' });
    expect(FeedbackRepo.upsertMvpVote).not.toHaveBeenCalled();
  });

  it('409 MVP_VOTING_NOT_OPEN before the match is finished', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ actual_end_time: null, match_status: 'in_progress' }));
    expect(await errOf(Service.castMvpVote(7, 50, 101))).toMatchObject({ status: 409, code: 'MVP_VOTING_NOT_OPEN' });
  });

  it('409 MVP_VOTING_CLOSED once 24 hours have passed', async () => {
    vi.setSystemTime(new Date(ENDED.getTime() + 24 * 60 * 60 * 1000 + 1000));
    expect(await errOf(Service.castMvpVote(7, 50, 101))).toMatchObject({ status: 409, code: 'MVP_VOTING_CLOSED' });
  });

  it('409 MVP_NOT_AVAILABLE when the match was a walkover', async () => {
    vi.mocked(MatchResultRepo.findVerifiedResultByMatchId).mockResolvedValue({ match_result_status: 'walkover' } as never);
    expect(await errOf(Service.castMvpVote(7, 50, 101))).toMatchObject({ status: 409, code: 'MVP_NOT_AVAILABLE' });
  });

  it('422 for someone who did not check in', async () => {
    expect(await errOf(Service.castMvpVote(7, 50, 999))).toMatchObject({ status: 422, code: 'MVP_CANDIDATE_NOT_ELIGIBLE' });
  });

  it('404 for an unknown match', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(null);
    expect(await errOf(Service.castMvpVote(999, 50, 101))).toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
  });

  it('a result amended later does not touch the votes already cast', async () => {
    vi.mocked(MatchResultRepo.findVerifiedResultByMatchId).mockResolvedValue({ match_result_status: 'verified' } as never);
    await expect(Service.castMvpVote(7, 50, 101)).resolves.toMatchObject({ votedForUserId: 101 });
  });
});

describe('getMvpVotes (รายแมตช์)', () => {
  const candidates = [
    { user_id: 101, full_name: 'ก', profile_image_key: null, team_id: 1, votes: 3 },
    { user_id: 102, full_name: 'ข', profile_image_key: null, team_id: 2, votes: 3 },
    { user_id: 103, full_name: 'ค', profile_image_key: null, team_id: 2, votes: 1 },
  ];

  beforeEach(() => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match());
    vi.mocked(MatchResultRepo.findVerifiedResultByMatchId).mockResolvedValue(null);
    vi.mocked(FeedbackRepo.isMemberOfMatchTeams).mockResolvedValue(false);
    vi.mocked(FeedbackRepo.findMvpCandidatesOfMatch).mockResolvedValue(candidates);
    vi.mocked(FeedbackRepo.findMatchPlayerStats).mockResolvedValue([
      { user_id: 101, stat_key: 'goals', stat_label_th: 'ประตู', value: 2 },
      { user_id: 102, stat_key: 'goals', stat_label_th: 'ประตู', value: 1 },
    ]);
    vi.mocked(FeedbackRepo.findOwnMatchVote).mockReset().mockResolvedValue(null);
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'public', completed_at: null }));
  });

  it('an unpublished tournament: results still readable but canVote is false', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'private' }));
    const result = await Service.getMvpVotes(7, 50);
    expect(result.canVote).toBe(false);
    expect(result.candidates).toHaveLength(3);
  });

  it('★ ข้อ 10 — while voting is open no vote count leaves the service at all', async () => {
    const result = await Service.getMvpVotes(7, 50);
    expect(result.window.isOpen).toBe(true);
    expect(result).not.toHaveProperty('totalVotes');                       // ไม่ใช่ 0 — ต้องไม่มีคีย์เลย
    expect(result.candidates.every(c => !('votes' in c))).toBe(true);
    expect(result.winners).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('votes');
  });

  it('shows the stats of each candidate so voters can judge', async () => {
    const { candidates: dto } = await Service.getMvpVotes(7);
    expect(dto[0]).toMatchObject({ userId: 101, teamId: 1, stats: [{ statKey: 'goals', statLabelTh: 'ประตู', value: 2 }] });
    expect(dto[2]!.stats).toEqual([]);                                     // คนที่ไม่มีสถิติได้ array ว่าง
  });

  it('after it closes: counts appear, ties share the win, sorted by votes', async () => {
    vi.setSystemTime(new Date('2026-09-23T18:00:01Z'));
    const result = await Service.getMvpVotes(7);
    expect(result.window.isOpen).toBe(false);
    expect(result.totalVotes).toBe(7);
    expect(result.winners).toEqual([101, 102]);
    expect(result.candidates.map(c => c.votes)).toEqual([3, 3, 1]);
  });

  it('nobody voted → winners stays empty after closing', async () => {
    vi.setSystemTime(new Date('2026-09-23T18:00:01Z'));
    vi.mocked(FeedbackRepo.findMvpCandidatesOfMatch).mockResolvedValue(candidates.map(c => ({ ...c, votes: 0 })));
    const result = await Service.getMvpVotes(7);
    expect(result.winners).toEqual([]);
    expect(result.totalVotes).toBe(0);
  });

  it('a walkover match has no vote at all', async () => {
    vi.mocked(MatchResultRepo.findVerifiedResultByMatchId).mockResolvedValue({ match_result_status: 'walkover' } as never);
    const result = await Service.getMvpVotes(7, 50);
    expect(result.candidates).toEqual([]);
    expect(result.canVote).toBe(false);
    expect(FeedbackRepo.findMvpCandidatesOfMatch).not.toHaveBeenCalled();
  });

  it('mine + canVote need a logged-in viewer · a team member sees canVote false', async () => {
    vi.mocked(FeedbackRepo.findOwnMatchVote).mockResolvedValue(feedbackRow({ feedback_type: 'mvp_vote', voted_for_user_id: 102 }));
    expect(await Service.getMvpVotes(7, 50)).toMatchObject({ mine: { votedForUserId: 102 }, canVote: true });
    expect(await Service.getMvpVotes(7)).toMatchObject({ mine: null, canVote: false });
    vi.mocked(FeedbackRepo.isMemberOfMatchTeams).mockResolvedValue(true);
    expect((await Service.getMvpVotes(7, 9)).canVote).toBe(false);
  });

  it('exact boundaries: open at the second the match ends, closed at the 24-hour mark', async () => {
    const ended = new Date('2026-09-21T18:00:00Z');
    vi.setSystemTime(ended);                                                    // วินาทีที่แมตช์จบพอดี
    expect((await Service.getMvpVotes(7)).window.isOpen).toBe(true);
    vi.setSystemTime(new Date(ended.getTime() + 24 * 60 * 60 * 1000 - 1));      // ก่อนครบ 24 ชม. 1 มิลลิวินาที
    expect((await Service.getMvpVotes(7)).window.isOpen).toBe(true);
    vi.setSystemTime(new Date(ended.getTime() + 24 * 60 * 60 * 1000));          // ครบ 24 ชม. พอดี = ปิด
    const closed = await Service.getMvpVotes(7);
    expect(closed.window.isOpen).toBe(false);
    expect(closed).toHaveProperty('totalVotes');
  });

  it('a candidate whose team withdrew later still shows up (teamId null) — the result must not vanish', async () => {
    vi.mocked(FeedbackRepo.findMvpCandidatesOfMatch).mockResolvedValue([
      { user_id: 101, full_name: 'ก', profile_image_key: null, team_id: null, votes: 2 },
    ]);
    vi.setSystemTime(new Date('2026-09-23T18:00:01Z'));
    const result = await Service.getMvpVotes(7);
    expect(result.candidates).toEqual([expect.objectContaining({ userId: 101, teamId: null, votes: 2 })]);
    expect(result.winners).toEqual([101]);
  });

  it('several stats per player keep the order they came in; stats of non-candidates are dropped', async () => {
    vi.mocked(FeedbackRepo.findMvpCandidatesOfMatch).mockResolvedValue([candidates[0]!]);
    vi.mocked(FeedbackRepo.findMatchPlayerStats).mockResolvedValue([
      { user_id: 101, stat_key: 'goals', stat_label_th: 'ประตู', value: 2 },
      { user_id: 101, stat_key: 'assists', stat_label_th: 'แอสซิสต์', value: 1 },
      { user_id: 999, stat_key: 'goals', stat_label_th: 'ประตู', value: 9 },      // คนที่ไม่ได้อยู่ในรายชื่อผู้ถูกโหวต
    ]);
    const { candidates: dto } = await Service.getMvpVotes(7);
    expect(dto).toHaveLength(1);
    expect(dto[0]!.stats.map(s => s.statKey)).toEqual(['goals', 'assists']);
  });

  it('a vote the admin removed: mine is null and the voter cannot vote again', async () => {
    vi.mocked(FeedbackRepo.findOwnMatchVote).mockResolvedValue(feedbackRow({ feedback_type: 'mvp_vote', voted_for_user_id: 101, removed_at: new Date() }));
    expect(await Service.getMvpVotes(7, 50)).toMatchObject({ mine: null, canVote: false });
    expect(await errOf(Service.castMvpVote(7, 50, 101))).toMatchObject({ status: 409, code: 'FEEDBACK_REMOVED' });
  });

  it('the match has not finished yet → empty window, nothing to vote on', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(match({ actual_end_time: null }));
    const result = await Service.getMvpVotes(7, 50);
    expect(result.window).toEqual({ opensAt: null, closesAt: null, isOpen: false });
    expect(result.candidates).toEqual([]);
    expect(result.canVote).toBe(false);
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
    vi.mocked(FeedbackRepo.softRemove).mockResolvedValue(true);
    await expect(Service.removeFeedback(1, 3, 'หยาบคาย')).resolves.toBeUndefined();
    expect(FeedbackRepo.softRemove).toHaveBeenCalledWith(1, 3, 'หยาบคาย');

    vi.mocked(FeedbackRepo.findById).mockResolvedValue(feedbackRow({ removed_at: new Date() }));
    expect(await errOf(Service.removeFeedback(1, 3))).toMatchObject({ status: 409, code: 'FEEDBACK_ALREADY_REMOVED' });
  });
});

// มติ 22 ก.ย. — คอมเมนต์ย้ายจากรายแมตช์มาเป็นระดับทัวร์ · ทุกคนเห็น · คนละ 1 อัน ส่งซ้ำ = แก้ · แอดมินเท่านั้นลบของคนอื่น
describe('tournament comments (C7)', () => {
  const commentRow = (overrides: Record<string, unknown> = {}) => ({
    ...feedbackRow({ feedback_type: 'comment', content: 'เชียร์', rating: null, user_id: 50 }), author_name: 'สมชาย', author_avatar: null, ...overrides,
  }) as never;
  const publicT = () => tournament({ tournament_status: 'public', completed_at: null });

  it('anyone logged in (even a player or the organizer) posts → isNew, author + isMine', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(publicT());
    vi.mocked(FeedbackRepo.findOwnComment).mockResolvedValueOnce(null).mockResolvedValueOnce(commentRow());
    const out = await Service.postTournamentComment(20, 50, 'เชียร์');
    expect(FeedbackRepo.upsertComment).toHaveBeenCalledWith(20, 50, 'เชียร์', false);
    expect(out).toMatchObject({ isNew: true, content: 'เชียร์', isMine: true, author: { id: 50, fullName: 'สมชาย' }, tournamentId: 20 });
  });

  it('sending again edits the one comment (isNew false)', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(publicT());
    vi.mocked(FeedbackRepo.findOwnComment).mockResolvedValueOnce(commentRow()).mockResolvedValueOnce(commentRow({ content: 'แก้แล้ว' }));
    await expect(Service.postTournamentComment(20, 50, 'แก้แล้ว')).resolves.toMatchObject({ isNew: false, content: 'แก้แล้ว' });
  });

  it('allowed after the tournament is completed', async () => {
    vi.mocked(FeedbackRepo.findOwnComment).mockResolvedValueOnce(null).mockResolvedValueOnce(commentRow());
    await expect(Service.postTournamentComment(20, 50, 'x')).resolves.toMatchObject({ isNew: true });
  });

  it.each(['private', 'pending_approval', 'rejected', 'auto_deleted'])('%s tournament → 409 TOURNAMENT_NOT_PUBLIC', async (status) => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: status }));
    expect(await errOf(Service.postTournamentComment(20, 50, 'x'))).toMatchObject({ status: 409, code: 'TOURNAMENT_NOT_PUBLIC' });
    expect(FeedbackRepo.upsertComment).not.toHaveBeenCalled();
  });

  it('409 COMMENT_REMOVED after an admin removed it', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(publicT());
    vi.mocked(FeedbackRepo.findOwnComment).mockResolvedValue(commentRow({ removed_at: new Date(), removed_by: 9001 }));
    expect(await errOf(Service.postTournamentComment(20, 50, 'x'))).toMatchObject({ status: 409, code: 'COMMENT_REMOVED' });
    expect(FeedbackRepo.upsertComment).not.toHaveBeenCalled();
  });

  // มติ 23 ก.ย. ข้อ 6.6 ทาง ก — ผู้จัดลบไม่ใช่การแบนถาวร ไม่งั้นกดปุ่มเดียวปิดปากคนนั้นในทัวร์นั้นตลอดไป
  it('writing again is allowed after the ORGANIZER removed it — the row is revived', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(publicT());
    vi.mocked(FeedbackRepo.findOwnComment)
      .mockResolvedValueOnce(commentRow({ removed_at: new Date(), removed_by: ORG }))
      .mockResolvedValueOnce(commentRow({ content: 'เขียนใหม่' }));
    await expect(Service.postTournamentComment(20, 50, 'เขียนใหม่')).resolves.toMatchObject({ isNew: false, content: 'เขียนใหม่' });
    expect(FeedbackRepo.upsertComment).toHaveBeenCalledWith(20, 50, 'เขียนใหม่', true);
  });

  // มติ 23 ก.ย. ข้อ 6.4 — ธง report เห็นได้เฉพาะคนที่ลบได้ ไม่งั้นกลายเป็นตราประจานที่ใครก็ตั้งให้คนอื่นได้
  it('hides isReported from an ordinary viewer and shows it to the organizer', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(publicT());
    vi.mocked(FeedbackRepo.listComments).mockResolvedValue({ rows: [commentRow({ is_reported: 1 })], totalItems: 1 });
    const seen = await Service.listTournamentComments(20, 50, 1, 20, 0);
    expect(seen.items[0]).not.toHaveProperty('isReported');
    expect(seen.canModerate).toBe(false);
    const org = await Service.listTournamentComments(20, ORG, 1, 20, 0);
    expect(org.items[0]).toMatchObject({ isReported: true });
    expect(org.canModerate).toBe(true);
  });

  it('?reported=true is the moderation queue — organizer only, filtered in the query', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(publicT());
    await Service.listTournamentComments(20, ORG, 1, 20, 0, true);
    expect(FeedbackRepo.listComments).toHaveBeenCalledWith(20, 0, 20, true);
    expect(await errOf(Service.listTournamentComments(20, 50, 1, 20, 0, true))).toMatchObject({ status: 403, code: 'NOT_ORGANIZER' });
    expect(await errOf(Service.listTournamentComments(20, undefined, 1, 20, 0, true))).toMatchObject({ status: 403, code: 'NOT_ORGANIZER' });
  });

  it('canComment stays true for a comment the organizer removed, false for one an admin removed', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(publicT());
    vi.mocked(FeedbackRepo.findOwnComment).mockResolvedValue(commentRow({ removed_at: new Date(), removed_by: ORG }));
    await expect(Service.listTournamentComments(20, 50, 1, 20, 0)).resolves.toMatchObject({ mine: null, canComment: true });
    vi.mocked(FeedbackRepo.findOwnComment).mockResolvedValue(commentRow({ removed_at: new Date(), removed_by: 9001 }));
    await expect(Service.listTournamentComments(20, 50, 1, 20, 0)).resolves.toMatchObject({ mine: null, canComment: false });
  });

  it('list: public · mine + canComment for a logged-in viewer · isMine per item', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(publicT());
    vi.mocked(FeedbackRepo.listComments).mockResolvedValue({ rows: [commentRow(), commentRow({ tournament_feedback_id: 2, user_id: 60 })], totalItems: 2 });
    vi.mocked(FeedbackRepo.findOwnComment).mockResolvedValue(commentRow());
    const out = await Service.listTournamentComments(20, 50, 1, 20, 0);
    expect(out.items.map(i => i.isMine)).toEqual([true, false]);
    expect(out).toMatchObject({ canComment: true, mine: { id: 1 }, pagination: { totalItems: 2 } });
    const anon = await Service.listTournamentComments(20, undefined, 1, 20, 0);
    expect(anon).toMatchObject({ mine: null, canComment: false });
  });

  it('list of a private tournament: 404 for outsiders · organizer and university admin can read', async () => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'private' }));
    expect(await errOf(Service.listTournamentComments(20, 50, 1, 20, 0))).toMatchObject({ status: 404 });
    expect(await errOf(Service.listTournamentComments(20, undefined, 1, 20, 0))).toMatchObject({ status: 404 });
    await expect(Service.listTournamentComments(20, ORG, 1, 20, 0)).resolves.toMatchObject({ canComment: false });
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);
    await expect(Service.listTournamentComments(20, 1, 1, 20, 0)).resolves.toBeDefined();
  });

  it('owner deletes their own (then can post again) · none → 404 · admin-removed → 409', async () => {
    vi.mocked(FeedbackRepo.findOwnComment).mockResolvedValueOnce(commentRow());
    await Service.deleteOwnTournamentComment(20, 50);
    expect(FeedbackRepo.deleteOwnComment).toHaveBeenCalledWith(20, 50);
    expect(await errOf(Service.deleteOwnTournamentComment(20, 50))).toMatchObject({ status: 404, code: 'COMMENT_NOT_FOUND' });
    vi.mocked(FeedbackRepo.findOwnComment).mockResolvedValueOnce(commentRow({ removed_at: new Date() }));
    expect(await errOf(Service.deleteOwnTournamentComment(20, 50))).toMatchObject({ status: 409, code: 'COMMENT_REMOVED' });
  });

  it('report: anyone but the author · 400 CANNOT_REPORT_OWN_COMMENT for your own', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(feedbackRow({ feedback_type: 'comment', user_id: 50 }));
    await expect(Service.reportFeedback(1, 60)).resolves.toEqual({ id: 1, isReported: true });
    expect(await errOf(Service.reportFeedback(1, 50))).toMatchObject({ status: 400, code: 'CANNOT_REPORT_OWN_COMMENT' });
  });
});

// มติ 23 ก.ย. ข้อ 5-ก — แก้ข้อความแล้วธง report ต้องไม่หาย (SQL ไม่มี is_reported = FALSE แล้ว)
describe('editing keeps the report flag', () => {
  it('re-sending a review does not clear is_reported', async () => {
    vi.mocked(FeedbackRepo.isTournamentParticipant).mockResolvedValue(true);
    vi.mocked(FeedbackRepo.findOwn).mockResolvedValueOnce(feedbackRow({ is_reported: 1 })).mockResolvedValueOnce(feedbackRow({ is_reported: 1, content: 'แก้แล้ว' }));
    await Service.submitOrganizerFeedback(20, 5, { rating: 5, content: 'แก้แล้ว' });
    // service ไม่ได้สั่งล้างธงที่ไหน — repo ก็ไม่ล้าง (ดู upsertOrganizerFeedback)
    expect(FeedbackRepo.upsertOrganizerFeedback).toHaveBeenCalledWith(20, 5, 5, 'แก้แล้ว');
    expect(FeedbackRepo.markReported).not.toHaveBeenCalled();
  });
});

// มติ 23 ก.ย. ข้อ 6 — ผู้จัดลบความเห็นต่อทัวร์ในทัวร์ตัวเองได้ (เฉพาะ comment) · ข้อ 6.4 report แล้วแจ้งผู้จัด
describe('organizer moderation of tournament comments', () => {
  const commentRow = (overrides: Record<string, unknown> = {}) =>
    feedbackRow({ feedback_type: 'comment', content: 'ไม่สุภาพ', rating: null, user_id: 50, ...overrides });

  beforeEach(() => {
    vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament({ tournament_status: 'public', completed_at: null, name: 'Cup' }));
    vi.mocked(FeedbackRepo.softRemove).mockResolvedValue(true);
    vi.mocked(FeedbackRepo.restore).mockResolvedValue(true);
  });

  it('removes with an audit action of its own and tells the author with the reason', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(commentRow());

    await expect(Service.removeCommentByOrganizer(20, 1, ORG, 'คำหยาบ')).resolves.toBeUndefined();

    expect(FeedbackRepo.softRemove).toHaveBeenCalledWith(1, ORG, 'คำหยาบ',
      { actionType: 'comment_removed_by_organizer', details: { tournamentId: 20, authorUserId: 50 } });
    expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: 50, type: 'comment_removed', relatedEntityType: 'tournament', relatedEntityId: 20,
      message: expect.stringContaining('คำหยาบ'),
    }));
  });

  it('403 for a review or an MVP vote — the organizer cannot delete their own report card', async () => {
    for (const type of ['organizer_feedback', 'mvp_vote'] as const) {
      vi.mocked(FeedbackRepo.findById).mockResolvedValue(commentRow({ feedback_type: type }));
      expect(await errOf(Service.removeCommentByOrganizer(20, 1, ORG, 'x')))
        .toMatchObject({ status: 403, code: 'FEEDBACK_NOT_REMOVABLE_BY_ORGANIZER' });
    }
    expect(FeedbackRepo.softRemove).not.toHaveBeenCalled();
  });

  it('404 when the comment belongs to another tournament or does not exist', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(commentRow({ tournament_id: 99 }));
    expect(await errOf(Service.removeCommentByOrganizer(20, 1, ORG, 'x'))).toMatchObject({ status: 404, code: 'FEEDBACK_NOT_FOUND' });
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(null);
    expect(await errOf(Service.removeCommentByOrganizer(20, 1, ORG, 'x'))).toMatchObject({ status: 404, code: 'FEEDBACK_NOT_FOUND' });
  });

  it('409 when it was already removed · no notification', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(commentRow({ removed_at: new Date() }));
    expect(await errOf(Service.removeCommentByOrganizer(20, 1, ORG, 'x'))).toMatchObject({ status: 409, code: 'FEEDBACK_ALREADY_REMOVED' });
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('the organizer deleting their own comment is not notified', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(commentRow({ user_id: ORG }));
    await Service.removeCommentByOrganizer(20, 1, ORG, 'เปลี่ยนใจ');
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });

  it('admin restore brings it back (409 if it is not removed)', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(commentRow({ removed_at: new Date() }));
    await expect(Service.restoreFeedback(1, 3)).resolves.toEqual({ id: 1, restored: true });
    expect(FeedbackRepo.restore).toHaveBeenCalledWith(1, 3);

    vi.mocked(FeedbackRepo.findById).mockResolvedValue(commentRow());
    expect(await errOf(Service.restoreFeedback(1, 3))).toMatchObject({ status: 409, code: 'FEEDBACK_NOT_REMOVED' });
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(null);
    expect(await errOf(Service.restoreFeedback(1, 3))).toMatchObject({ status: 404, code: 'FEEDBACK_NOT_FOUND' });
  });

  it('reporting a comment also pings the organizer — once, and never the organizer themselves', async () => {
    vi.mocked(FeedbackRepo.findById).mockResolvedValue(commentRow());
    await Service.reportFeedback(1, 60);
    expect(FeedbackRepo.markReported).toHaveBeenCalledWith(1);
    expect(NotificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: ORG, type: 'comment_reported', relatedEntityType: 'tournament', relatedEntityId: 20,
    }));

    vi.mocked(NotificationService.notify).mockClear();
    await Service.reportFeedback(1, ORG);                                     // ผู้จัดกดเอง → ไม่แจ้งตัวเอง
    expect(NotificationService.notify).not.toHaveBeenCalled();

    vi.mocked(FeedbackRepo.findById).mockResolvedValue(commentRow({ is_reported: 1 }));
    await Service.reportFeedback(1, 61);                                      // คนที่ 2 กดซ้ำ → ไม่แจ้งซ้ำ
    expect(NotificationService.notify).not.toHaveBeenCalled();
  });
});
