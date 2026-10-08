import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(),
  notifyUsers: vi.fn(),
  notifyMatchAudience: vi.fn(),
  notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(),
  notifyTournamentReferees: vi.fn(),
  notifyMatchResultParties: vi.fn(),
}));

vi.mock('../../repositories/tournament.repo.js', () => ({
  publishTournament: vi.fn(),
  // 🆕 BE-15 (7 ต.ค. 2569) — เทส updateTournament ต้อง mock สองตัวนี้ ไม่งั้นไปเรียกฐานจริง
  updateTournamentGeneral: vi.fn(),
  findTournamentById: vi.fn(),
  // getDetail เรียกสามตัวนี้ต่อหลังอัปเดตสำเร็จ
  findTournamentOrganizer: vi.fn(() => Promise.resolve({ user_id: 7, full_name: 'ผู้จัด', profile_image_key: null })),
  countApprovedTeams: vi.fn(() => Promise.resolve(0)),
}));
// getDetail นับเรื่องร้องเรียนที่ยังเปิดอยู่ด้วย
vi.mock('../../repositories/matchResultComplaint.repo.js', () => ({ countOpenByTournament: vi.fn(() => Promise.resolve(0)) }));

vi.mock('../../repositories/adminScope.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/department.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({}));
vi.mock('../../repositories/sportType.repo.js', () => ({
  findSportTypeById: vi.fn(async () => ({ sport_type_id: 1, default_mode: 'onsite' })),
}));
// กฎกรรมการต่อแมตช์ (BR-11) อยู่ใน referee.service — mock ให้ on-site = 2, online = 1
vi.mock('../referee.service.js', () => ({
  refereesNeededPerMatch: vi.fn(async () => (mode: 'onsite' | 'online') => (mode === 'onsite' ? 2 : 1)),
}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../mappers/tournament.mapper.js', () => ({
  toTournamentDetailDto: vi.fn(),
  toTournamentListDto: vi.fn(),
}));
vi.mock('../../mappers/user.mapper.js', () => ({ toUserRef: vi.fn() }));

import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as TournamentService from '../tournament.service.js';
import * as NotificationService from '../notification.service.js';

const mockedTournamentRepo = vi.mocked(TournamentRepo);

const privateTournament = {
  tournament_id: 10,
  tournament_status: 'private',
} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('publishTournament', () => {
  it('requires a referee pool of refereesNeededPerMatch(default_mode) and reports it in REFEREES_INCOMPLETE', async () => {
    mockedTournamentRepo.publishTournament.mockResolvedValue({
      status: 'referees_incomplete',
      refereesAccepted: 1,
    } as any);

    await expect(TournamentService.publishTournament(privateTournament, 99)).rejects.toMatchObject({
      status: 409,
      code: 'REFEREES_INCOMPLETE',
      extra: { refereesAccepted: 1, refereesRequired: 2 },   // on-site + stat → 2
    });
    expect(mockedTournamentRepo.publishTournament).toHaveBeenCalledWith(privateTournament.tournament_id, 99, 2);
  });

  it('publishes when the repo accepts the pool', async () => {
    mockedTournamentRepo.publishTournament.mockResolvedValue({ status: 'ok' } as any);

    await expect(TournamentService.publishTournament(privateTournament, 99)).resolves.toEqual({
      id: privateTournament.tournament_id,
      status: 'public',
    });
    // C1-ข — กรรมการที่ตอบรับแล้วรู้ว่าทัวร์เปิดเผยแพร่
    expect(NotificationService.notifyTournamentReferees).toHaveBeenCalledWith(
      privateTournament.tournament_id, expect.objectContaining({ type: 'tournament_published' }));
  });
});

/**
 * 🆕 BE-15 (แก้ 7 ต.ค. 2569) — แก้ช่องที่ล็อกแล้วได้ 200 แต่ค่าไม่เปลี่ยน
 *
 * `updateTournamentSchema` รับแค่ venue/description/entryNotes แล้วปิดท้ายด้วย `.passthrough()`
 * ⇒ ส่ง `maxTeams`/`bracketFormat`/`genderRequirement` มาก็ผ่าน schema แล้วถูกเมินที่ repo
 *   ผู้จัดเห็น 200 เข้าใจว่าแก้สำเร็จ แล้วไปรู้ตัวตอนค่าไม่เปลี่ยน (QA 6 ต.ค.)
 *
 * ★ มติ 7 ต.ค. ⑩ ข — ปฏิเสธเฉพาะช่องที่ "มีความหมายแต่แก้ทางนี้ไม่ได้" ไม่ใช้ `.strict()`
 *   เพราะ `.strict()` จะพังทั้งจอถ้า FE ส่ง object ทั้งก้อนกลับมา
 */
describe('updateTournament — ช่องที่แก้ทางนี้ไม่ได้ (BE-15)', () => {
  beforeEach(() => {
    vi.mocked(mockedTournamentRepo.findTournamentById).mockResolvedValue({ tournament_id: 10 } as never);
  });

  it.each([
    ['maxTeams', { maxTeams: 8 }],
    ['genderRequirement', { genderRequirement: 'female' }],
    ['วันที่', { eventStartDate: '2026-12-01' }],
    ['กฎคุณสมบัติ', { eligibilityRules: [] }],
  ])('ส่ง %s มา → 409 USE_AMENDMENT_REQUEST และไม่เขียนอะไร', async (_name, body) => {
    await expect(TournamentService.updateTournament(10, 7, body as never))
      .rejects.toMatchObject({ status: 409, code: 'USE_AMENDMENT_REQUEST' });

    expect(mockedTournamentRepo.updateTournamentGeneral).not.toHaveBeenCalled();
  });

  /** ★ บอกชื่อช่องกลับไป ไม่ใช่แค่ "มีช่องผิด" — ไม่งั้นผู้จัดไม่รู้ว่าต้องไปยื่นคำขอเรื่องอะไร */
  it('บอกชื่อช่องที่ต้องไปยื่นคำขอ', async () => {
    const err = await TournamentService.updateTournament(10, 7, { venue: 'ใหม่', maxTeams: 8, minAge: 18 } as never)
      .catch((e: unknown) => e);

    expect((err as { extra: { amendmentFields: string[] } }).extra.amendmentFields.sort())
      .toEqual(['maxTeams', 'minAge']);
  });

  /** ★ ช่องที่แก้ไม่ได้เลย (ไม่มีแม้แต่ทาง amendment) ต้องแยกออกมาจากช่องที่ยื่นคำขอได้ */
  it('ช่องที่แก้ไม่ได้เลย แยกไว้ใน immutableFields', async () => {
    const err = await TournamentService.updateTournament(10, 7, { bracketFormat: 'round_robin' } as never)
      .catch((e: unknown) => e);

    expect((err as { extra: { immutableFields: string[]; amendmentFields: string[] } }).extra)
      .toMatchObject({ immutableFields: ['bracketFormat'], amendmentFields: [] });
  });

  /** ★ เคสปกติต้องไม่พัง — และคีย์แปลกที่ไม่มีความหมายยังถูกเมินเงียบเหมือนเดิม (ไม่ใช้ .strict()) */
  it('ช่องที่แก้ได้ตามปกติ ยังแก้ได้ · คีย์แปลกยังถูกเมินเงียบ', async () => {
    await TournamentService.updateTournament(10, 7, { venue: 'สนามใหม่', unrelatedKey: 1 } as never);

    expect(mockedTournamentRepo.updateTournamentGeneral).toHaveBeenCalledWith(10, 7, expect.objectContaining({ venue: 'สนามใหม่' }));
  });
});
