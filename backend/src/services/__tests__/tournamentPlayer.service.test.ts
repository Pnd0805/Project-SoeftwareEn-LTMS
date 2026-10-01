import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/career.repo.js', () => ({ findCareerByUser: vi.fn() }));
vi.mock('../../repositories/matchHistory.repo.js', () => ({
    findVerifiedMatchHistoryByUser: vi.fn(),
    findStatsForUserMatches: vi.fn(),
}));
vi.mock('../../utils/checkExist.js', () => ({ checkTournament: vi.fn(), checkUser: vi.fn() }));
// ด่าน OD-46 ต้องไม่ถูกเรียกจากเส้นนี้เลย — mock ไว้เพื่อให้พิสูจน์ได้ว่าไม่มีการเรียก
vi.mock('../../utils/profileStats.js', () => ({ canSeeProfileStats: vi.fn() }));

import * as Service from '../tournamentPlayer.service.js';
import * as CareerRepo from '../../repositories/career.repo.js';
import * as MatchHistoryRepo from '../../repositories/matchHistory.repo.js';
import { checkTournament, checkUser } from '../../utils/checkExist.js';
import { canSeeProfileStats } from '../../utils/profileStats.js';

const mockedCareer = vi.mocked(CareerRepo);
const mockedHistory = vi.mocked(MatchHistoryRepo);

function careerRow(overrides : Record<string , unknown> = {}){
    return {
        tournament_id : 20, tournament_name : 'KU Cup', sport_type_id : 1, tournament_status : 'completed',
        team_id : 5, team_name : 'Blue',
        played : 3, wins : 2, losses : 1, champion : 0,
        ...overrides,
    } as never;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkTournament).mockResolvedValue({ tournament_id : 20 } as never);
    vi.mocked(checkUser).mockResolvedValue({ user_id : 9 } as never);
    mockedCareer.findCareerByUser.mockResolvedValue([careerRow()]);
    mockedHistory.findVerifiedMatchHistoryByUser.mockResolvedValue([]);
    mockedHistory.findStatsForUserMatches.mockResolvedValue([]);
});

/**
 * OD-47 — RW06 "โปรไฟล์ในทัวร์" · สถิติของคนหนึ่งในทัวร์นี้ทัวร์เดียว
 * เส้นแบ่ง: ข้อมูลการแข่งขัน (เส้นนี้ เปิดเสมอ) กับ ข้อมูลโปรไฟล์ (U04/U14/RW05 ปิดได้ตาม OD-46)
 */
describe('getTournamentPlayerStats', () => {
    it('กรองทั้งสอง repo ด้วย tournamentId ไม่ใช่ดึงทุกทัวร์มาแล้วกรองทีหลัง', async () => {
        await Service.getTournamentPlayerStats(20 , 9);

        expect(mockedCareer.findCareerByUser).toHaveBeenCalledWith(9 , 20);
        expect(mockedHistory.findVerifiedMatchHistoryByUser).toHaveBeenCalledWith(9 , 20);
    });

    it('คืนตัวเลขของทัวร์นี้พร้อมทีมที่ลงในทัวร์นี้', async () => {
        const result = await Service.getTournamentPlayerStats(20 , 9);

        expect(result).toMatchObject({
            tournament : { id : 20 , name : 'KU Cup' , sportTypeId : 1 , status : 'completed' },
            team : { id : 5 , name : 'Blue' },
            played : 3 , wins : 2 , losses : 1 , champion : false,
        });
    });

    it('champion มาจากเลข 1/0 ของ SQL ไม่ใช่ค่าความจริงแบบหลวม', async () => {
        mockedCareer.findCareerByUser.mockResolvedValue([careerRow({ champion : 1 })]);
        await expect(Service.getTournamentPlayerStats(20 , 9)).resolves.toMatchObject({ champion : true });
    });

    /**
     * สำคัญที่สุดของ OD-47 — เส้นนี้ต้องไม่ผูกกับสวิตช์ OD-46
     * ถ้าใครเผลอเอาด่านมาใส่ คนที่ปิดสถิติโปรไฟล์จะหายจากหน้าทัวร์ที่ตัวเองลงแข่ง
     * ซึ่งเกินกว่าที่มติกำหนด และทำให้หน้าทัวร์ของผู้จัดมีช่องว่างที่อธิบายไม่ได้
     */
    it('ไม่เรียกด่าน OD-46 เลย แม้เจ้าของจะปิดสถิติโปรไฟล์ไว้', async () => {
        const result = await Service.getTournamentPlayerStats(20 , 9);

        expect(canSeeProfileStats).not.toHaveBeenCalled();
        expect(result).not.toHaveProperty('statsHidden');
    });

    it('ไม่ได้อยู่ในรายชื่อที่ผ่านของทัวร์นี้ → 404 PLAYER_NOT_IN_TOURNAMENT', async () => {
        mockedCareer.findCareerByUser.mockResolvedValue([]);

        await expect(Service.getTournamentPlayerStats(20 , 9)).rejects.toMatchObject({
            status : 404, code : 'PLAYER_NOT_IN_TOURNAMENT',
        });
        expect(mockedHistory.findVerifiedMatchHistoryByUser).not.toHaveBeenCalled();
    });

    // อยู่ในรายชื่อแต่ยังไม่ได้ลงสนาม = มีแถวและ played 0 คนละเรื่องกับ "ไม่ได้อยู่ในทัวร์"
    it('อยู่ในรายชื่อแต่ยังไม่ลงสนาม → 200 played 0 ไม่ใช่ 404', async () => {
        mockedCareer.findCareerByUser.mockResolvedValue([careerRow({ played : 0 , wins : 0 , losses : 0 })]);

        const result = await Service.getTournamentPlayerStats(20 , 9);

        expect(result.played).toBe(0);
        expect(result.matches).toEqual([]);
    });

    describe('รวมสถิติรายแมตช์เป็นยอดของทัวร์', () => {
        it('บวกข้ามแมตช์ตาม stat_key', async () => {
            mockedHistory.findVerifiedMatchHistoryByUser.mockResolvedValue([
                { match_id : 10 } as never, { match_id : 11 } as never,
            ]);
            mockedHistory.findStatsForUserMatches.mockResolvedValue([
                { match_id : 10, stat_key : 'goals', stat_label_th : 'ประตู', value_int : 2 },
                { match_id : 11, stat_key : 'goals', stat_label_th : 'ประตู', value_int : 3 },
                { match_id : 10, stat_key : 'assists', stat_label_th : 'แอสซิสต์', value_int : 1 },
            ] as never);

            const result = await Service.getTournamentPlayerStats(20 , 9);

            expect(result.playerStats).toEqual([
                { statKey : 'goals', statLabelTh : 'ประตู', value : 5 },
                { statKey : 'assists', statLabelTh : 'แอสซิสต์', value : 1 },
            ]);
        });

        // ช่องที่กรรมการไม่ได้กรอกคือ "ไม่มีข้อมูล" ไม่ใช่ 0 — กฎเดียวกับ playerStats รายแมตช์
        it('ทุกแมตช์ว่าง → ยอดรวมเป็น null ไม่ใช่ 0', async () => {
            mockedHistory.findVerifiedMatchHistoryByUser.mockResolvedValue([{ match_id : 10 } as never]);
            mockedHistory.findStatsForUserMatches.mockResolvedValue([
                { match_id : 10, stat_key : 'goals', stat_label_th : 'ประตู', value_int : null },
            ] as never);

            const result = await Service.getTournamentPlayerStats(20 , 9);

            expect(result.playerStats).toEqual([{ statKey : 'goals', statLabelTh : 'ประตู', value : null }]);
        });

        it('กรอกบางแมตช์ → บวกเฉพาะแมตช์ที่กรอก ไม่นับช่องว่างเป็น 0', async () => {
            mockedHistory.findVerifiedMatchHistoryByUser.mockResolvedValue([
                { match_id : 10 } as never, { match_id : 11 } as never,
            ]);
            mockedHistory.findStatsForUserMatches.mockResolvedValue([
                { match_id : 10, stat_key : 'goals', stat_label_th : 'ประตู', value_int : null },
                { match_id : 11, stat_key : 'goals', stat_label_th : 'ประตู', value_int : 4 },
            ] as never);

            const result = await Service.getTournamentPlayerStats(20 , 9);

            expect(result.playerStats).toEqual([{ statKey : 'goals', statLabelTh : 'ประตู', value : 4 }]);
        });
    });

    it('ทัวร์ไม่มีจริง → โยนต่อจาก checkTournament และไม่ค้นอะไรเลย', async () => {
        vi.mocked(checkTournament).mockRejectedValue(Object.assign(new Error('x') , { status : 404 }));

        await expect(Service.getTournamentPlayerStats(999 , 9)).rejects.toMatchObject({ status : 404 });
        expect(mockedCareer.findCareerByUser).not.toHaveBeenCalled();
    });
});
