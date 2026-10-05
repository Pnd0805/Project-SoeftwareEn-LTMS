/**
 * BO-N ที่ชั้น service (มติ 5 ต.ค. 2569) — สามด่านที่ต้องใช้สูตรเดียวกัน
 *
 *   ① ensureScoreData        ผลการแข่งต้องเข้ารูปแบบ (S01 ส่งผล · S02b เขียนทับ · S04 amend)
 *   ② resolvePredictedWinner ใบทายผลต้องเข้ารูปแบบด้วย ตั้งแต่ตอนกดส่ง
 *   ③ setMatchFormat         ล็อกตามมติข้อ ⑤ — เปลี่ยนกลางทัวร์ไม่ได้
 *
 * ★ ①กับ② แยกกันอยู่คนละไฟล์ในโค้ดจริง แต่ต้องตอบเหมือนกัน ⇒ เทสไว้ด้วยกันที่นี่
 *   ถ้าสองฝั่งใช้กฎไม่ตรงกัน จะมีเคสที่ "ทายได้แต่ผลจริงใส่ไม่ได้" หรือกลับกัน
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../repositories/match.repo.js', () => ({
    findById: vi.fn(),
    findMatchById: vi.fn(),
    updateMatchBestOf: vi.fn(),
}));
vi.mock('../../repositories/tournament.repo.js', () => ({
    findTournamentById: vi.fn(),
    countStartedMatchesOfTournament: vi.fn(),
}));

import * as MatchResultService from '../matchResult.service.js';
import * as PickemService from '../pickem.service.js';
import * as MatchService from '../match.service.js';
import * as MatchRepo from '../../repositories/match.repo.js';
import * as TournamentRepo from '../../repositories/tournament.repo.js';
import type { MatchRow } from '../../types/db.js';

/** แมตช์ขั้นต่ำที่สองด่านต้องใช้ — ทีม 10 กับ 11 */
function match(bestOf: number | null): MatchRow {
    return { match_id: 30, tournament_id: 20, team_a_id: 10, team_b_id: 11, best_of: bestOf } as MatchRow;
}
function errOf(fn: () => unknown) {
    try { fn(); return null; } catch (e) { return e as { status: number; code: string; message: string; extra?: unknown }; }
}

beforeEach(() => vi.clearAllMocks());

// ═════════════════════════════════════════════════════════════════════════════
describe('① ensureScoreData — ผลการแข่งต้องเข้ารูปแบบ BO-N', () => {
    it('BO3 รับ 2-0 และ 2-1', () => {
        expect(() => MatchResultService.ensureScoreData(match(3), 10, { '10': 2, '11': 0 })).not.toThrow();
        expect(() => MatchResultService.ensureScoreData(match(3), 10, { '10': 2, '11': 1 })).not.toThrow();
    });

    it('BO5 รับ 3-2 แต่ไม่รับ 2-1 (ยังไม่จบ)', () => {
        expect(() => MatchResultService.ensureScoreData(match(5), 10, { '10': 3, '11': 2 })).not.toThrow();
        expect(errOf(() => MatchResultService.ensureScoreData(match(5), 10, { '10': 2, '11': 1 })))
            .toMatchObject({ status: 400, code: 'SCORE_NOT_IN_MATCH_FORMAT' });
    });

    // 🔴 เคสหลักที่ด่านนี้มีไว้กัน — กรรมการกรอกแต้มในเกมแทนจำนวนเกม
    //   ก่อนมี BO-N สกอร์นี้ผ่านทุกด่าน และ Pick'em ก็คิดแต้มจากมันไปเลย
    it('ปฏิเสธแบดมินตันที่กรอก 21-19 แทน 2-0', () => {
        const err = errOf(() => MatchResultService.ensureScoreData(match(3), 10, { '10': 21, '11': 19 }));
        expect(err).toMatchObject({ status: 400, code: 'SCORE_NOT_IN_MATCH_FORMAT' });
        expect(err!.message).toContain('2 เกมพอดี');
    });

    /**
     * 🔴 บันทึกไว้: สาขา "ฝ่ายแพ้ได้เกินเพดาน" ของ scorePairError **เข้าไม่ถึงจากประตูนี้**
     *
     * เพราะเพดานของผู้แพ้ = (N-1)/2 ซึ่งน้อยกว่าจำนวนที่ผู้ชนะต้องได้ = (N+1)/2 อยู่ 1 เสมอ
     * ⇒ ถ้าผู้แพ้ได้เกินเพดาน แปลว่าได้ ≥ เท่ากับผู้ชนะ ⇒ เสมอหรือแพ้กลับทาง
     *   ซึ่งด่าน "ผู้ชนะต้องแต้มมากกว่า" (ข้อ c.) ดักไปก่อนแล้วด้วย VALIDATION_FAILED
     *
     * ⇒ สาขานั้นเป็นการกันไว้เผื่อมีคนเรียก util ตรงจากที่อื่นในอนาคต
     *   และถูกคุมด้วยเทสของ utils/matchFormat ไม่ใช่ที่นี่
     * ★ เทสข้อนี้ตรึง "ลำดับของด่าน" ไว้ ไม่ได้ตรึงเรื่องรูปแบบ — ถ้าวันหนึ่งมีคนย้าย
     *   ด่าน BO-N ขึ้นไปก่อนข้อ c. ข้อความที่ผู้ใช้เห็นจะเปลี่ยนไปทั้งที่ไม่มีใครตั้งใจ
     */
    it('2-2 ใน BO3 ได้ VALIDATION_FAILED (เสมอ) ไม่ใช่ error ของรูปแบบ — ด่าน c. มาก่อน', () => {
        expect(errOf(() => MatchResultService.ensureScoreData(match(3), 10, { '10': 2, '11': 2 })))
            .toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    });

    // ★ best_of เป็น null = กีฬาไม่ได้แข่งเป็นรอบ ⇒ กฎเดิมทั้งหมด ไม่มีเพดาน
    //   ข้อนี้สำคัญ: ฟุตบอล 7-1 และบาสเกตบอล 98-74 ต้องผ่านเหมือนเดิม
    it('best_of = null ⇒ ไม่มีเพดาน (ฟุตบอล 7-1 · บาสเกตบอล 98-74 ผ่าน)', () => {
        expect(() => MatchResultService.ensureScoreData(match(null), 10, { '10': 7, '11': 1 })).not.toThrow();
        expect(() => MatchResultService.ensureScoreData(match(null), 10, { '10': 98, '11': 74 })).not.toThrow();
    });

    // 🔴 ลำดับของด่านสำคัญ: ต้องรู้ก่อนว่าใครชนะ จึงจะบอกได้ว่าเกมของใครต้องเป็นเท่าไร
    //   ⇒ กฎ "ผู้ชนะต้องแต้มมากกว่า" ต้องตอบก่อน BO-N ไม่ใช่หลัง
    it('เสมอกันยังได้ VALIDATION_FAILED ไม่ใช่ SCORE_NOT_IN_MATCH_FORMAT', () => {
        expect(errOf(() => MatchResultService.ensureScoreData(match(3), 10, { '10': 1, '11': 1 })))
            .toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    });

    it('key ผิดยังได้ VALIDATION_FAILED เหมือนเดิม — BO-N ไม่แทนที่ด่านเก่า', () => {
        expect(errOf(() => MatchResultService.ensureScoreData(match(3), 10, { '10': 2, '99': 0 })))
            .toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    });

    it('error แนบ bestOf และ possibleScores มาให้ FE โชว์ตัวเลือกได้', () => {
        const err = errOf(() => MatchResultService.ensureScoreData(match(5), 10, { '10': 9, '11': 0 }));
        expect(err).toMatchObject({ extra: { bestOf: 5, possibleScores: [[3, 0], [3, 1], [3, 2]] } });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('② resolvePredictedWinner — ใบทายผลต้องเข้ารูปแบบตั้งแต่กดส่ง', () => {
    it('BO3 รับ 2-1 และอนุมานผู้ชนะถูก', () => {
        expect(PickemService.resolvePredictedWinner(match(3), { '10': 1, '11': 2 })).toBe(11);
    });

    // ★ เหตุผลที่ต้องตรวจตอนกดส่ง ไม่ใช่ตอนคิดแต้ม:
    //   ถ้าปล่อยให้ทาย 3-1 ไว้ในแมตช์ BO3 ใบนั้นแพ้แน่นอนตั้งแต่กดส่ง เพราะผลจริง
    //   ไม่มีทางเป็น 3-1 ได้ ⇒ บอกเขาตอนกดดีกว่าให้รู้ตอนแพ้
    it('ปฏิเสธการทาย 3-1 ในแมตช์ BO3 — ผลจริงเป็นค่านี้ไม่ได้', () => {
        const err = errOf(() => PickemService.resolvePredictedWinner(match(3), { '10': 3, '11': 1 }));
        expect(err).toMatchObject({ status: 422, code: 'PICK_SCORE_NOT_IN_MATCH_FORMAT' });
    });

    it('ใช้ 422 ไม่ใช่ 400 — ตามแบบของ PICK_* ทั้งเส้น', () => {
        expect(errOf(() => PickemService.resolvePredictedWinner(match(3), { '10': 21, '11': 19 })))
            .toMatchObject({ status: 422 });
    });

    it('best_of = null ⇒ ทายสกอร์ฟุตบอลได้อิสระเหมือนเดิม', () => {
        expect(() => PickemService.resolvePredictedWinner(match(null), { '10': 3, '11': 1 })).not.toThrow();
    });

    it('ทายเสมอยังได้ PICK_SCORE_TIE ไม่ใช่ error ของรูปแบบ', () => {
        expect(errOf(() => PickemService.resolvePredictedWinner(match(3), { '10': 2, '11': 2 })))
            .toMatchObject({ code: 'PICK_SCORE_TIE' });
    });

    // 🔴 ด่านนี้กับ ① ต้องตอบเหมือนกันทุกคู่สกอร์ ไม่งั้นจะมีเคสที่ทายได้แต่ผลจริงใส่ไม่ได้
    it('ตอบเหมือน ensureScoreData ทุกคู่ — ไม่มีสกอร์ที่ "ทายได้แต่ส่งผลไม่ได้"', () => {
        for (const bestOf of [1, 3, 5, 7] as const) {
            for (let w = 0; w <= 5; w++) {
                for (let l = 0; l < w; l++) {
                    const score = { '10': w, '11': l };
                    const pickOk = errOf(() => PickemService.resolvePredictedWinner(match(bestOf), score)) === null;
                    const resultOk = errOf(() => MatchResultService.ensureScoreData(match(bestOf), 10, score)) === null;
                    expect({ bestOf, w, l, pickOk }).toEqual({ bestOf, w, l, pickOk: resultOk });
                }
            }
        }
    });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('③ setMatchFormat — ล็อกตามมติข้อ ⑤', () => {
    beforeEach(() => {
        vi.mocked(MatchRepo.findMatchById).mockResolvedValue({ match_id: 30, tournament_id: 20 } as never);
        vi.mocked(TournamentRepo.countStartedMatchesOfTournament).mockResolvedValue(0);
    });

    it('ตั้งได้เมื่อยังไม่มีแมตช์ไหนของทัวร์เริ่มแข่ง', async () => {
        await expect(MatchService.setMatchFormat(30, { bestOf: 7 })).resolves.toEqual({ id: 30, bestOf: 7 });
        expect(MatchRepo.updateMatchBestOf).toHaveBeenCalledWith(30, 7);
    });

    it('ส่ง null ได้ = ปลดเพดาน (ไม่ใช่ "ไม่เปลี่ยน")', async () => {
        await expect(MatchService.setMatchFormat(30, { bestOf: null })).resolves.toEqual({ id: 30, bestOf: null });
        expect(MatchRepo.updateMatchBestOf).toHaveBeenCalledWith(30, null);
    });

    // 🔴 ล็อกระดับ **ทัวร์** ไม่ใช่ระดับแมตช์ — แมตช์เดียวเริ่มแข่งก็ล็อกทั้งทัวร์
    //   เหตุ: ถ้าล็อกแค่แมตช์ตัวเอง ผู้จัดจะเปลี่ยนรูปแบบรอบชิงหลังเห็นว่าใครเข้าชิงได้
    //   และใบทายผลที่ส่งไว้แล้วจะกลายเป็นใบที่เป็นไปไม่ได้
    it('ล็อกทั้งทัวร์เมื่อมีแมตช์อื่นเริ่มแข่งไปแล้ว ทั้งที่แมตช์นี้ยังไม่เริ่ม', async () => {
        vi.mocked(TournamentRepo.countStartedMatchesOfTournament).mockResolvedValue(1);
        await expect(MatchService.setMatchFormat(30, { bestOf: 5 }))
            .rejects.toMatchObject({ status: 409, code: 'MATCH_FORMAT_LOCKED', extra: { startedMatches: 1 } });
        expect(MatchRepo.updateMatchBestOf).not.toHaveBeenCalled();
    });

    it('ไม่พบแมตช์ → 404 และไม่เขียนอะไร', async () => {
        vi.mocked(MatchRepo.findMatchById).mockResolvedValue(null);
        await expect(MatchService.setMatchFormat(30, { bestOf: 3 }))
            .rejects.toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND' });
        expect(MatchRepo.updateMatchBestOf).not.toHaveBeenCalled();
    });
});
