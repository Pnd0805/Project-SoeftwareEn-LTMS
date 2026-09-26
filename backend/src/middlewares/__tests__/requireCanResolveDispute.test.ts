import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/adminScope.repo.js', () => ({ findAdminByUserId: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../repositories/matchResult.repo.js', () => ({ findmatchResultByMatchId: vi.fn() }));
vi.mock('../../utils/checkExist.js', () => ({ checkAnnouncement: vi.fn() }));

import { requireCanResolveDispute } from '../requireOrganizer.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import { findTournamentById } from '../../repositories/tournament.repo.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import * as ResRepo from '../../repositories/matchResult.repo.js';

const ORG = 9003;
const ADMIN = 9001;
const NOW = new Date('2026-09-28T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000);

async function run(userId: number) {
  const next = vi.fn();
  await requireCanResolveDispute({ user: { user_id: userId }, params: { id: '7' } } as unknown as Request,
                                 {} as Response, next as NextFunction);
  return next.mock.calls[0]?.[0] as { status: number; code: string; extra?: Record<string, unknown> } | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(MatchRepo.findById).mockResolvedValue({ match_id: 7, tournament_id: 50 } as never);
  vi.mocked(findTournamentById).mockResolvedValue({ requested_by_user_id: ORG, tournament_status: 'public' } as never);
  vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue(null as never);
  vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue({ dispute_raised_at: hoursAgo(49) } as never);
});

/**
 * OD-26 ข้อ 10 (มติ 26 ก.ย.) — "เพิ่มคนที่กดได้ ไม่ใช่โอนอำนาจ"
 * ผู้จัดกดได้ตลอด · แอดมินเข้ามาได้ต่อเมื่อผู้จัดเงียบเกิน 48 ชม. (รอบชิง/round robin ไม่มีอะไรบีบผู้จัดเลย)
 */
describe('requireCanResolveDispute', () => {
  it('lets the organizer through at any time, even right after the dispute was raised', async () => {
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue({ dispute_raised_at: hoursAgo(1) } as never);
    expect(await run(ORG)).toBeUndefined();
  });

  it('lets a university admin decide once the organizer has had 48 hours', async () => {
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);
    expect(await run(ADMIN)).toBeUndefined();
  });

  it('holds the admin off while the organizer still has time, and says until when', async () => {
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue({ dispute_raised_at: hoursAgo(10) } as never);

    const err = await run(ADMIN);
    expect(err).toMatchObject({ status: 403, code: 'ORGANIZER_STILL_HAS_TIME' });
    expect(err!.extra!['availableAt']).toBe('2026-09-30T02:00:00.000Z');   // ยื่น 02:00 + 48 ชม.
  });

  it('409 when an admin aims at a match with no dispute at all', async () => {
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue({ scope_type: 'university_wide' } as never);
    vi.mocked(ResRepo.findmatchResultByMatchId).mockResolvedValue({ dispute_raised_at: null } as never);
    expect(await run(ADMIN)).toMatchObject({ status: 409, code: 'NO_ACTIVE_DISPUTE' });
  });

  it.each([['faculty'], [null]])('403 for a faculty-scope admin or a stranger (%s)', async (scope) => {
    vi.mocked(AdminRepo.findAdminByUserId).mockResolvedValue(scope === null ? null as never : { scope_type: scope } as never);
    expect(await run(12345)).toMatchObject({ status: 403, code: 'NOT_ORGANIZER' });
  });
});
