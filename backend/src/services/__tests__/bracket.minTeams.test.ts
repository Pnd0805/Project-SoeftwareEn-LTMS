import { describe, it, expect, vi, beforeEach } from 'vitest';

const conn = { beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), query: vi.fn(async () => [{ insertId: 1, affectedRows: 1 }]) };
vi.mock('../../config/db.js', () => ({ default: { getConnection: vi.fn(async () => conn) } }));
vi.mock('../../repositories/application.repo.js', () => ({ findApprovedTeamsByTournament: vi.fn(async () => [{ team_id: 1 }, { team_id: 2 }]) }));
vi.mock('../../repositories/tournament.repo.js', () => ({ findTournamentById: vi.fn() }));
vi.mock('../../repositories/match.repo.js', () => ({
  countMatchesByTournament: vi.fn(async () => 0),
  findBracketUsage: vi.fn(async () => []),
  clearBracketTx: vi.fn(async () => ({ matchesDeleted: 6, nodesDeleted: 0 })),
  insertMatchTx: vi.fn(async () => 1),
  updateMatchNextMatchIdTx: vi.fn(),
  updateMatchLoserNextMatchIdTx: vi.fn(),
}));
vi.mock('../../repositories/bracketNode.repo.js', () => ({ insertBracketNodeTx: vi.fn(async () => 1) }));
vi.mock('../../repositories/sportType.repo.js', () => ({ findSportTypeById: vi.fn(async () => ({ default_mode: 'onsite' })) }));
vi.mock('../../repositories/pickem.repo.js', () => ({ findPickerIdsTx: vi.fn(async () => []) }));
vi.mock('../../repositories/matchReferee.repo.js', () => ({ findAssignedUserIdsInTournament: vi.fn(async () => []) }));
vi.mock('../notification.service.js', () => ({ notifyUsers: vi.fn(), notifyTournamentSquads: vi.fn() }));

import { createBracket, minTeamsToDraw } from '../bracket.service.js';
import * as ApplicationRepo from '../../repositories/application.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import * as MatchRepo from '../../repositories/match.repo.js';

type Format = 'single_elimination' | 'double_elimination' | 'round_robin' | null;

/** ทัวร์ตัวอย่าง — เปลี่ยนแค่รูปแบบสายกับ min_teams ส่วนที่เหลือคงที่ */
const tournament = (bracket_format: Format, min_teams = 2) =>
  ({ tournament_id: 50, name: 'Cup', requested_by_user_id: 7, min_teams, sport_type_id: 1, bracket_format });

/**
 * ตั้งทัวร์ + จำนวนทีม approved · คืน seed ครบทุกทีมไว้ใช้กับ seedingMethod: 'manual'
 * (manual ที่ seed ไม่ครบจะติด MANUAL_SEEDS_MISMATCH ก่อนถึงด่านจำนวนทีม จึงวัดกฎใหม่ไม่ได้)
 */
const setup = (bracket_format: Format, teams: number, min_teams = 2) => {
  vi.mocked(TournamentRepo.findTournamentById).mockResolvedValue(tournament(bracket_format, min_teams) as never);
  vi.mocked(ApplicationRepo.findApprovedTeamsByTournament).mockResolvedValue(
    Array.from({ length: teams }, (_, i) => ({ team_id: i + 1 })) as never);
  return Array.from({ length: teams }, (_, i) => i + 1);
};

beforeEach(() => vi.clearAllMocks());

/**
 * OD-33 (FE-double-elimination-four-team-minimum) — double elimination ต้องมี 4 ทีมก่อนจับสาย
 * FE ปิดปุ่ม Draw ให้แล้ว แต่ client ที่ยิง API ตรงยังทำได้ ด่านจริงจึงต้องอยู่ที่ service
 */
describe('minTeamsToDraw — ขั้นต่ำต่อรูปแบบสาย', () => {
  it('double elimination ใช้ 4 เป็นพื้น', () => {
    expect(minTeamsToDraw({ bracket_format: 'double_elimination', min_teams: 2 })).toBe(4);
  });

  it('min_teams ที่สูงกว่าชนะพื้นของรูปแบบ (max ไม่ใช่ 4 ตายตัว)', () => {
    expect(minTeamsToDraw({ bracket_format: 'double_elimination', min_teams: 6 })).toBe(6);
  });

  it('รูปแบบอื่นและ null ยังใช้ 2 เหมือนเดิม', () => {
    expect(minTeamsToDraw({ bracket_format: 'single_elimination', min_teams: 2 })).toBe(2);
    expect(minTeamsToDraw({ bracket_format: 'round_robin', min_teams: 2 })).toBe(2);
    expect(minTeamsToDraw({ bracket_format: null, min_teams: 2 })).toBe(2);
    expect(minTeamsToDraw({ bracket_format: 'single_elimination', min_teams: 8 })).toBe(8);
  });
});

describe('createBracket — double elimination ต่ำกว่า 4 ทีม', () => {
  for (const seeding of ['random', 'manual'] as const) {
    const seedsFor = (seeds: number[]) => (seeding === 'manual' ? seeds : undefined);

    it(`${seeding}: 2 ทีม → 422 พร้อมตัวเลขทั้งสองฝั่ง`, async () => {
      const seeds = setup('double_elimination', 2);
      await expect(createBracket(50, seeding, seedsFor(seeds)))
        .rejects.toMatchObject({
          status: 422, code: 'TEAM_COUNT_MISMATCH',
          message: 'รูปแบบ double elimination ต้องมีทีมที่อนุมัติแล้วอย่างน้อย 4 ทีม',
          extra: { bracketFormat: 'double_elimination', required: 4, approved: 2 },
        });
      expect(MatchRepo.insertMatchTx).not.toHaveBeenCalled();
    });

    it(`${seeding}: 3 ทีม → 422 required 4`, async () => {
      const seeds = setup('double_elimination', 3);
      await expect(createBracket(50, seeding, seedsFor(seeds)))
        .rejects.toMatchObject({ status: 422, code: 'TEAM_COUNT_MISMATCH', extra: { required: 4, approved: 3 } });
    });

    it(`${seeding}: 4 ทีม → จับสายได้`, async () => {
      const seeds = setup('double_elimination', 4);
      await expect(createBracket(50, seeding, seedsFor(seeds)))
        .resolves.toMatchObject({ bracketFormat: 'double_elimination', replaced: false });
      expect(MatchRepo.insertMatchTx).toHaveBeenCalled();
    });
  }

  it('min_teams 6 + 5 ทีม → 422 required 6 (ไม่ใช่ 4)', async () => {
    setup('double_elimination', 5, 6);
    await expect(createBracket(50, 'random', undefined))
      .rejects.toMatchObject({ status: 422, code: 'TEAM_COUNT_MISMATCH', extra: { required: 6, approved: 5 } });
  });

  it('min_teams 6 + 6 ทีม → ผ่าน', async () => {
    setup('double_elimination', 6, 6);
    await expect(createBracket(50, 'random', undefined)).resolves.toMatchObject({ bracketFormat: 'double_elimination' });
  });
});

// กันแก้กว้างเกิน — รูปแบบอื่นต้องไม่ถูกกฎใหม่แตะเลย
describe('createBracket — รูปแบบอื่นยังจับสาย 2 ทีมได้เหมือนเดิม', () => {
  for (const format of ['single_elimination', 'round_robin'] as const) {
    it(`${format} + 2 ทีม → ผ่าน`, async () => {
      setup(format, 2);
      await expect(createBracket(50, 'random', undefined)).resolves.toMatchObject({ bracketFormat: format });
    });
  }

  it('ต่ำกว่า 2 ทีมยัง 422 เหมือนเดิม และแนบ extra ชุดเดียวกัน', async () => {
    setup('single_elimination', 1);
    await expect(createBracket(50, 'random', undefined)).rejects.toMatchObject({
      status: 422, code: 'TEAM_COUNT_MISMATCH',
      message: 'จำนวนทีมไม่สอดคล้องกับรูปแบบการแข่งขันที่เลือก',
      extra: { bracketFormat: 'single_elimination', required: 2, approved: 1 },
    });
  });

  it('ต่ำกว่า min_teams ของทัวร์ยัง 422 เหมือนเดิม', async () => {
    setup('single_elimination', 3, 4);
    await expect(createBracket(50, 'random', undefined)).rejects.toMatchObject({
      status: 422, code: 'TEAM_COUNT_MISMATCH', extra: { required: 4, approved: 3 },
    });
  });
});

/**
 * ★ ข้อที่ห้ามพลาด — ถ้ากฎใหม่ปฏิเสธการ redraw สายเดิมต้องยังอยู่ครบ
 * ด่านจำนวนทีมอยู่ก่อน pool.getConnection()/clearBracketTx จึงไม่มีอะไรถูกลบ — เทสนี้ล็อกลำดับนั้นไว้
 */
describe('createBracket replace — ถูกปฏิเสธแล้วสายเดิมต้องไม่หาย', () => {
  beforeEach(() => vi.mocked(MatchRepo.countMatchesByTournament).mockResolvedValue(6 as never));

  it('double elimination + 2 ทีม + replace: true → 422 และไม่มีการลบสายเดิม', async () => {
    setup('double_elimination', 2);
    const before = await MatchRepo.countMatchesByTournament(50);

    await expect(createBracket(50, 'random', undefined, true)).rejects.toMatchObject({
      status: 422, code: 'TEAM_COUNT_MISMATCH', extra: { required: 4, approved: 2 },
    });

    expect(MatchRepo.clearBracketTx).not.toHaveBeenCalled();
    expect(conn.beginTransaction).not.toHaveBeenCalled();
    expect(MatchRepo.insertMatchTx).not.toHaveBeenCalled();
    expect(await MatchRepo.countMatchesByTournament(50)).toBe(before);
  });

  it('เติมเป็น 4 ทีมแล้ว replace: true จับใหม่ได้', async () => {
    setup('double_elimination', 4);
    await expect(createBracket(50, 'random', undefined, true)).resolves.toMatchObject({ replaced: true });
    expect(MatchRepo.clearBracketTx).toHaveBeenCalledWith(conn, 50);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });
});

/**
 * BRACKET_FORMAT_NOT_SET — เดิม **ไม่มีเทสไหนเอ่ยถึงเลย** (ไล่ตรวจ 6 ต.ค. 2569)
 *
 * ★ ด่านนี้อยู่ "ท้ายสุด" ของ buildBracket เป็น fallthrough: ไม่ตรงรูปแบบไหนเลย ⇒ โยน
 *   ⇒ มันคือตัวกันไม่ให้ฟังก์ชันจบแบบเงียบ ๆ โดยไม่สร้างอะไร
 * 🔴 ถ้าเปลี่ยน fallthrough เป็น return ว่าง ๆ (ซึ่งดู "ไม่พัง" กว่า) ORG จะกดจับสายสำเร็จ
 *   ได้ response 200 แต่ไม่มีแมตช์เกิดขึ้นเลย แล้วทุกคนรอสายที่ไม่มีอยู่
 *   นี่คือเหตุผลที่ต้องเป็น error ไม่ใช่ no-op
 *
 * ★ ลำดับสำคัญ: ด่านจำนวนทีมมาก่อน ⇒ ต้องให้ทีมครบ 2 ทีมก่อน ด่านนี้จึงจะถึง
 *   (min_teams ของทัวร์ที่ไม่ตั้งรูปแบบ ยังใช้พื้น 2 — ล็อกไว้ที่เทส minTeamsToDraw ข้างบน)
 */
describe('createBracket — ทัวร์ที่ยังไม่ตั้งรูปแบบสาย', () => {
  /**
   * ★ ต้องตั้ง countMatchesByTournament เองทุกเทสในบล็อกนี้
   *   clearAllMocks ล้างแค่ประวัติการเรียก ไม่ล้าง implementation ⇒ ค่าที่เทสก่อนหน้าตั้งไว้ (6)
   *   จะค้างมา แล้วจะติด BRACKET_ALREADY_EXISTS ก่อนถึงด่านที่บล็อกนี้ต้องการเทส
   */
  it('bracket_format = null = 422 BRACKET_FORMAT_NOT_SET', async () => {
    setup(null, 2);
    vi.mocked(MatchRepo.countMatchesByTournament).mockResolvedValue(0 as never);

    await expect(createBracket(50, 'random', undefined)).rejects.toMatchObject({
      status: 422, code: 'BRACKET_FORMAT_NOT_SET',
    });
  });

  it('ไม่สร้างแมตช์ทิ้งไว้ครึ่ง ๆ และไม่แจ้งทีมว่าสายออกแล้ว', async () => {
    setup(null, 2);
    vi.mocked(MatchRepo.countMatchesByTournament).mockResolvedValue(0 as never);

    await expect(createBracket(50, 'random', undefined)).rejects.toMatchObject({ code: 'BRACKET_FORMAT_NOT_SET' });
    expect(MatchRepo.insertMatchTx).not.toHaveBeenCalled();
  });

  /**
   * 🔴 เคสที่อันตรายที่สุดคือ replace: true — ตอนนั้นสายเก่าถูกลบไปแล้วในทรานแซกชัน
   *   ถ้าด่านนี้ไม่โยน ทัวร์จะเหลือ "ไม่มีสายทั้งเก่าและใหม่"
   *   โยนแล้ว catch ใน createBracket ต้อง rollback ⇒ สายเดิมกลับมาครบ
   */
  it('replace: true ที่ไม่มีรูปแบบ = rollback สายเดิมไม่หาย', async () => {
    setup(null, 2);
    vi.mocked(MatchRepo.countMatchesByTournament).mockResolvedValue(6 as never);

    await expect(createBracket(50, 'random', undefined, true)).rejects.toMatchObject({ code: 'BRACKET_FORMAT_NOT_SET' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});
