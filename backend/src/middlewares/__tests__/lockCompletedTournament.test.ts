import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/match.repo.js', () => ({ findById: vi.fn() }));

import { lockCompletedTournament } from '../lockCompletedTournament.js';
import { findTournamentById } from '../../repositories/tournament.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';

const req = (method: string, baseUrl: string, id: string, path = '/publish') => ({ method, baseUrl, path, params: { id } }) as unknown as Request;
const res = {} as Response;
const completed = { tournament_id: 50, tournament_status: 'completed', completed_at: new Date(0) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findTournamentById).mockResolvedValue(completed as never);
  vi.mocked(MatchRepo.findById).mockResolvedValue({ match_id: 7, tournament_id: 50 } as never);
});

// B1 2-ค (21 ก.ย.) — ทัวร์ completed ปฏิเสธทุก write ใต้ /tournaments/:id และ /matches/:id
describe('lockCompletedTournament', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s on a completed tournament → 409 TOURNAMENT_COMPLETED', async (method) => {
    const next = vi.fn();
    await lockCompletedTournament(req(method, '/api/v1/tournaments/50', '50'), res, next as NextFunction);
    expect(next.mock.calls[0]![0]).toMatchObject({ status: 409, code: 'TOURNAMENT_COMPLETED', extra: { tournamentId: 50 } });
  });

  it('resolves the tournament through the match for /matches/:id', async () => {
    const next = vi.fn();
    await lockCompletedTournament(req('POST', '/api/v1/matches/7', '7', '/result'), res, next as NextFunction);
    expect(MatchRepo.findById).toHaveBeenCalledWith(7);
    expect(findTournamentById).toHaveBeenCalledWith(50);
    expect(next.mock.calls[0]![0]).toMatchObject({ code: 'TOURNAMENT_COMPLETED' });
  });

  it('hides subresources of a soft-deleted tournament behind 404', async () => {
    vi.mocked(findTournamentById).mockResolvedValueOnce(null);
    const next = vi.fn();
    await lockCompletedTournament(req('GET', '/api/v1/tournaments/50', '50', '/matches'), res, next as NextFunction);
    expect(next.mock.calls[0]![0]).toMatchObject({ status: 404, code: 'TOURNAMENT_NOT_FOUND' });
  });

  it('hides matches whose parent tournament was soft-deleted', async () => {
    vi.mocked(findTournamentById).mockResolvedValueOnce(null);
    const next = vi.fn();
    await lockCompletedTournament(req('GET', '/api/v1/matches/7', '7', '/'), res, next as NextFunction);
    expect(next.mock.calls[0]![0]).toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
  });

  it('lets reads, announcements, other statuses and unknown ids through', async () => {
    for (const r of [
      req('GET', '/api/v1/tournaments/50', '50'),
      req('POST', '/api/v1/tournaments/50', '50', '/announcements'),
      req('POST', '/api/v1/tournaments/50', '50', '/feedback'),     // C6 ให้คะแนนหลังปิดทัวร์
      req('POST', '/api/v1/tournaments/50', '50', '/mvp-votes'),    // C6 โหวต MVP หลังปิดทัวร์
      req('POST', '/api/v1/tournaments/50', '50', '/feedback/'),    // มี / ท้ายก็ต้องผ่าน (Express ไม่ strict)
      req('POST', '/api/v1/tournaments/50', '50', '/comments'),     // C7 คอมเมนต์ทัวร์หลังปิดทัวร์ (มติ 22 ก.ย.)
      req('DELETE', '/api/v1/tournaments/50', '50', '/comments/me'),// เจ้าของลบคอมเมนต์ตัวเองหลังปิดทัวร์
      req('POST', '/api/v1/tournaments/abc', 'abc'),
    ]) {
      const next = vi.fn();
      await lockCompletedTournament(r, res, next as NextFunction);
      expect(next).toHaveBeenCalledWith();
    }
    vi.mocked(findTournamentById).mockResolvedValue({ ...completed, tournament_status: 'public' } as never);
    const next = vi.fn();
    await lockCompletedTournament(req('POST', '/api/v1/tournaments/50', '50'), res, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
    vi.mocked(MatchRepo.findById).mockResolvedValue(null);
    const next2 = vi.fn();
    await lockCompletedTournament(req('POST', '/api/v1/matches/99', '99'), res, next2 as NextFunction);
    expect(next2).toHaveBeenCalledWith();
  });
});
