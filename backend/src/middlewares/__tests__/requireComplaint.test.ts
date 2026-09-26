import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../repositories/matchResultComplaint.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/matchResult.repo.js', () => ({ findmatchResultByMatchId: vi.fn() }));
vi.mock('../../utils/checkExist.js', () => ({ checkAnnouncement: vi.fn() }));
vi.mock('../requireReferee.js', () => ({
  isRefereeOfMatch: vi.fn(() => Promise.resolve(false)),
  isTeamLeaderOfMatch: vi.fn(() => Promise.resolve(false)),
}));

import { requireComplaintReader, requireComplaintReaderOfMatch, requireOrganizerOfComplaint } from '../requireComplaint.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import { findTournamentById } from '../../repositories/tournament.repo.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as ComplaintRepo from '../../repositories/matchResultComplaint.repo.js';
import * as Referee from '../requireReferee.js';

const ORG = 9003;
const ADMIN = 9001;
const LEADER = 4001;
const OUTSIDER = 5555;

type Err = { status: number; code: string } | undefined;

async function run(mw: (req: Request, res: Response, next: NextFunction) => Promise<void>, userId: number | null, id = '7') {
  const next = vi.fn();
  const req = (userId === null ? { params: { id } } : { user: { user_id: userId }, params: { id } }) as unknown as Request;
  await mw(req, {} as Response, next as NextFunction);
  return next.mock.calls[0]?.[0] as Err;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(MatchRepo.findById).mockReset().mockResolvedValue({ match_id: 7, tournament_id: 50 } as never);
  vi.mocked(findTournamentById).mockReset().mockResolvedValue({ requested_by_user_id: ORG, tournament_status: 'public' } as never);
  vi.mocked(AdminRepo.findAdminByUserId).mockReset().mockResolvedValue(null as never);
  vi.mocked(ComplaintRepo.findById).mockReset().mockResolvedValue({ match_result_complaint_id: 1, match_id: 7, tournament_id: 50 } as never);
  vi.mocked(Referee.isTeamLeaderOfMatch).mockReset().mockResolvedValue(false);
  vi.mocked(Referee.isRefereeOfMatch).mockReset().mockResolvedValue(false);
});

/**
 * OD-26 ข้อ 8 — เรื่องร้องเรียนพกหลักฐานและข้อกล่าวหาถึงตัวบุคคล จึงไม่ใช่ของสาธารณะ
 * อ่านได้เฉพาะคู่กรณี ผู้จัด และแอดมิน · คนนอกต้องไม่รู้แม้แต่ว่ามีเรื่องอยู่
 */
describe('requireComplaintReaderOfMatch', () => {
  it('lets the organizer of the tournament read', async () => {
    expect(await run(requireComplaintReaderOfMatch, ORG)).toBeUndefined();
  });

  it('lets an admin of any scope read', async () => {
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'faculty' } as never);
    expect(await run(requireComplaintReaderOfMatch, ADMIN)).toBeUndefined();
  });

  it('lets a team leader of the match read', async () => {
    vi.mocked(Referee.isTeamLeaderOfMatch).mockResolvedValue(true);
    expect(await run(requireComplaintReaderOfMatch, LEADER)).toBeUndefined();
  });

  it('lets a referee of the match read', async () => {
    vi.mocked(Referee.isRefereeOfMatch).mockResolvedValue(true);
    expect(await run(requireComplaintReaderOfMatch, 6001)).toBeUndefined();
  });

  it('turns everyone else away', async () => {
    expect((await run(requireComplaintReaderOfMatch, OUTSIDER))?.code).toBe('NOT_COMPLAINT_PARTY');
  });

  it('needs a token', async () => {
    expect((await run(requireComplaintReaderOfMatch, null))?.code).toBe('NO_TOKEN');
  });

  it('404s on a match that does not exist', async () => {
    vi.mocked(MatchRepo.findById).mockResolvedValue(null as never);
    expect((await run(requireComplaintReaderOfMatch, ORG))?.code).toBe('MATCH_NOT_FOUND');
  });
});

describe('requireComplaintReader', () => {
  it('resolves the match through the complaint', async () => {
    vi.mocked(Referee.isTeamLeaderOfMatch).mockResolvedValue(true);
    expect(await run(requireComplaintReader, LEADER, '1')).toBeUndefined();
  });

  it('404s on a complaint that does not exist', async () => {
    vi.mocked(ComplaintRepo.findById).mockResolvedValue(null as never);
    expect((await run(requireComplaintReader, ORG, '1'))?.code).toBe('COMPLAINT_NOT_FOUND');
  });

  it('turns an outsider away', async () => {
    expect((await run(requireComplaintReader, OUTSIDER, '1'))?.code).toBe('NOT_COMPLAINT_PARTY');
  });
});

/** ผู้จัดแนบความเห็นได้ แต่ไม่มี route ไหนให้ปัดตก — อำนาจตัดสินอยู่ที่แอดมินเท่านั้น */
describe('requireOrganizerOfComplaint', () => {
  it('lets the organizer of the complaint tournament through', async () => {
    expect(await run(requireOrganizerOfComplaint, ORG, '1')).toBeUndefined();
  });

  it('refuses a team leader, an admin, and a stranger alike', async () => {
    vi.mocked(Referee.isTeamLeaderOfMatch).mockResolvedValue(true);
    expect((await run(requireOrganizerOfComplaint, LEADER, '1'))?.code).toBe('NOT_ORGANIZER');
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);
    expect((await run(requireOrganizerOfComplaint, ADMIN, '1'))?.code).toBe('NOT_ORGANIZER');
    expect((await run(requireOrganizerOfComplaint, OUTSIDER, '1'))?.code).toBe('NOT_ORGANIZER');
  });

  // ทัวร์ที่ยังไม่อนุมัติยังไม่มีผู้จัดที่ทำอะไรได้ (isOrganizerOf)
  it('refuses the requester of a tournament that is still pending approval', async () => {
    vi.mocked(findTournamentById).mockResolvedValue({ requested_by_user_id: ORG, tournament_status: 'pending_approval' } as never);
    expect((await run(requireOrganizerOfComplaint, ORG, '1'))?.code).toBe('NOT_ORGANIZER');
  });

  it('404s on a complaint that does not exist', async () => {
    vi.mocked(ComplaintRepo.findById).mockResolvedValue(null as never);
    expect((await run(requireOrganizerOfComplaint, ORG, '1'))?.code).toBe('COMPLAINT_NOT_FOUND');
  });
});
