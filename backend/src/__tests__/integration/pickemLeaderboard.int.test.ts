import { beforeEach, describe, expect, it } from 'vitest';
import { anon, as } from './helpers/api.js';
import { insert } from './helpers/db.js';
import { createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, type TestUser } from './helpers/factories.js';
import { clearLeaderboardCache } from '../../services/pickem.service.js';

/**
 * B3 ① + ② (มติ 8 ต.ค. 2569) — ตารางอันดับ pick'em: แบ่งหน้า + จำผลไว้ 5 วินาที
 *
 * ของเดิมคืน **ทุกคน** และคำนวณใหม่ทุกคำขอ
 *   4,000 คน = 477 KB ต่อคำขอ · ทัวร์ใหญ่ 30,000 คน ≈ 3.5 MB · ~230 ms CPU ของ MySQL ต่อครั้ง
 *   วัดได้ว่าเป็น endpoint ที่แพงกว่าทุกเส้น 8–14 เท่าตอนระบบไม่แออัด (perf 8 ต.ค. · P2)
 *
 * ★ ไฟล์นี้พิสูจน์สิ่งที่ **เทส unit จับไม่ได้** เพราะ unit mock repo ทิ้ง:
 *   1. `RANK() OVER` ของ MySQL ให้เลขอันดับตามกฎเสมอของเราจริง (1,1,3 ไม่ใช่ 1,1,2)
 *   2. อันดับถูกคิด **ก่อน** LIMIT ⇒ หน้า 2 ต่อจากหน้า 1 ไม่ใช่เริ่มนับ 1 ใหม่
 *   3. `COUNT(*) OVER ()` นับคนทั้งทัวร์ ไม่ใช่แค่คนในหน้านั้น
 *   4. อันดับตรงกับ E29 (`/me/pickem`) ซึ่งคิดด้วยคิวรีคนละตัว — ถ้าสองฝั่งไม่ตรงกันจะเงียบสนิท
 */

let faculty: number;
let sport: number;
let organizer: TestUser;
let tour: number;
let teamA: number;
let teamB: number;
let match1: number;
let match2: number;

/** ให้คนหนึ่งได้แต้มตามที่ต้องการ — ทายไว้ 1–2 ใบแล้วตัดสินแล้ว */
async function scorer(points: number[], name: string): Promise<TestUser> {
    const user = await createUser({ fullName: name });
    const matches = [match1, match2];
    for (const [i, p] of points.entries()) {
        await insert('pickem_predictions', {
            user_id: user.id, match_id: matches[i]!, predicted_winner_team_id: teamA, points_earned: p,
        });
    }
    return user;
}

const leaderboard = async (query = '') =>
    (await anon.get(`/api/v1/tournaments/${tour}/pickem-leaderboard${query}`)).body;

beforeEach(async () => {
    clearLeaderboardCache();          // 🔴 ไม่ล้าง = เคสถัดไปได้ของจากเคสก่อน แล้วแดงแบบหาสาเหตุยาก
    faculty = await createFaculty();
    sport = await createSportType({ minMembers: 1, maxMembers: 10 });
    organizer = await createUser();
    tour = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
    teamA = await createTeam({ leader: organizer.id, sportTypeId: sport });
    teamB = await createTeam({ leader: organizer.id, sportTypeId: sport });
    match1 = await createMatch({ tournamentId: tour, teamA, teamB, status: 'completed' });
    match2 = await createMatch({ tournamentId: tour, teamA, teamB, status: 'completed' });
});

describe('E28 ตารางอันดับ pick\'em — อันดับจาก SQL + แบ่งหน้า', () => {
    it('เสมอได้อันดับเดียวกันแล้วข้ามเลข (1,1,3) — ไม่ใช่ 1,1,2 แบบ DENSE_RANK', async () => {
        await scorer([10, 10], 'กนก');     // 20 แต้ม ถูก 2
        await scorer([10, 10], 'ขจร');     // 20 แต้ม ถูก 2 — เสมอ
        await scorer([10, 0], 'คมสัน');    // 10 แต้ม ถูก 1

        const body = await leaderboard();
        expect(body.items.map((i: { rank: number }) => i.rank)).toEqual([1, 1, 3]);
    });

    it('แต้มเท่ากันแต่ทายถูกมากกว่า → อันดับดีกว่า (settled ไม่มีผล)', async () => {
        await scorer([20, 0], 'ก ทายถูกใบเดียว');    // 20 แต้ม ถูก 1
        await scorer([10, 10], 'ข ทายถูกสองใบ');     // 20 แต้ม ถูก 2

        const body = await leaderboard();
        expect(body.items.map((i: { rank: number; user: { fullName: string } }) => [i.rank, i.user.fullName]))
            .toEqual([[1, 'ข ทายถูกสองใบ'], [2, 'ก ทายถูกใบเดียว']]);
    });

    /** 🔴 เคสหลักของ ② — ถ้าอันดับถูกคิดหลัง LIMIT หน้า 2 จะเริ่มที่ 1 */
    it('หน้า 2 ต่ออันดับจากหน้า 1 — อันดับคิดจากคนทั้งทัวร์ ก่อนตัด LIMIT', async () => {
        for (const p of [50, 40, 30, 20, 10]) await scorer([p], `แต้ม ${p}`);

        const page1 = await leaderboard('?page=1&pageSize=2');
        const page2 = await leaderboard('?page=2&pageSize=2');
        const page3 = await leaderboard('?page=3&pageSize=2');

        expect(page1.items.map((i: { rank: number }) => i.rank)).toEqual([1, 2]);
        expect(page2.items.map((i: { rank: number }) => i.rank)).toEqual([3, 4]);
        expect(page3.items.map((i: { rank: number }) => i.rank)).toEqual([5]);
    });

    it('pagination นับคนทั้งทัวร์ ไม่ใช่คนในหน้านั้น', async () => {
        for (const p of [50, 40, 30, 20, 10]) await scorer([p], `แต้ม ${p}`);

        const body = await leaderboard('?page=2&pageSize=2');
        expect(body.pagination).toEqual({ page: 2, pageSize: 2, totalItems: 5, totalPages: 3 });
        expect(body.items).toHaveLength(2);
    });

    it('ไม่ส่ง query → หน้าแรก 20 คน (ไม่ใช่ทุกคนเหมือนเดิม)', async () => {
        for (let i = 0; i < 23; i++) await scorer([10], `คนที่ ${i}`);

        const body = await leaderboard();
        expect(body.items).toHaveLength(20);
        expect(body.pagination).toMatchObject({ page: 1, pageSize: 20, totalItems: 23, totalPages: 2 });
    });

    it('ยังไม่มีใครทายที่ตัดสินแล้ว → items ว่าง + totalItems 0 (ไม่ใช่ 500)', async () => {
        const body = await leaderboard();
        expect(body.items).toEqual([]);
        expect(body.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    });

    it('ใบที่ยังไม่ตัดสิน (points_earned NULL) ไม่ถูกนับ', async () => {
        const waiting = await createUser({ fullName: 'ยังไม่ตัดสิน' });
        await insert('pickem_predictions', {
            user_id: waiting.id, match_id: match1, predicted_winner_team_id: teamA, points_earned: null,
        });
        await scorer([10], 'ตัดสินแล้ว');

        const body = await leaderboard();
        expect(body.items.map((i: { user: { fullName: string } }) => i.user.fullName)).toEqual(['ตัดสินแล้ว']);
    });

    it('การทายในทัวร์อื่นไม่ปนเข้ามา', async () => {
        const other = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
        const otherMatch = await createMatch({ tournamentId: other, teamA, teamB, status: 'completed' });
        const outsider = await createUser({ fullName: 'คนทัวร์อื่น' });
        await insert('pickem_predictions', {
            user_id: outsider.id, match_id: otherMatch, predicted_winner_team_id: teamA, points_earned: 99,
        });
        await scorer([10], 'คนทัวร์นี้');

        const body = await leaderboard();
        expect(body.pagination.totalItems).toBe(1);
        expect(body.items[0].user.fullName).toBe('คนทัวร์นี้');
    });

    /**
     * ★ ด่านสำคัญที่สุดของไฟล์นี้ — E28 กับ E29 คิดอันดับด้วยคิวรีคนละตัว
     *   ถ้าสองฝั่งไม่ตรงกัน ทั้งคู่ยังตอบ 200 เหมือนเดิม ต่างแค่เลขอันดับ ⇒ ไม่มีใครเห็น
     */
    it('อันดับตรงกับ E29 /me/pickem ทุกคน รวมคนที่เสมอกัน', async () => {
        const users = [await scorer([10, 10], 'ก'), await scorer([10, 10], 'ข'), await scorer([10, 0], 'ค')];

        const body = await leaderboard('?pageSize=100');
        for (const u of users) {
            const mine = await as(u).get(`/tournaments/${tour}/me/pickem`);
            const inTable = body.items.find((i: { user: { id: number } }) => i.user.id === u.id);
            expect(mine.body.rank).toBe(inTable.rank);
        }
    });
});

describe('E28 — แคช 5 วินาที', () => {
    it('ผลใหม่ยังไม่โผล่ทันทีภายใน 5 วิ แล้วโผล่หลังล้างแคช', async () => {
        await scorer([10], 'คนแรก');
        expect((await leaderboard()).pagination.totalItems).toBe(1);

        await scorer([20], 'คนที่สอง');
        // ★ ยังได้ของเดิมจากแคช — นี่คือราคาที่ยอมจ่าย (เกณฑ์ PF-04 ยอมให้ตามหลัง ≤ 10 วิ)
        expect((await leaderboard()).pagination.totalItems).toBe(1);

        clearLeaderboardCache();
        expect((await leaderboard()).pagination.totalItems).toBe(2);
    });

    it('แคชไม่ข้ามหน้ากัน — หน้า 2 ไม่ได้ของหน้า 1', async () => {
        for (const p of [30, 20, 10] as const) await scorer([p], `แต้ม ${p}`);

        const page1 = await leaderboard('?page=1&pageSize=1');
        const page2 = await leaderboard('?page=2&pageSize=1');
        expect(page1.items[0].user.fullName).toBe('แต้ม 30');
        expect(page2.items[0].user.fullName).toBe('แต้ม 20');
    });

    it('แคชไม่ข้ามทัวร์กัน', async () => {
        await scorer([10], 'คนทัวร์นี้');
        expect((await leaderboard()).pagination.totalItems).toBe(1);

        const other = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
        const body = (await anon.get(`/api/v1/tournaments/${other}/pickem-leaderboard`)).body;
        expect(body.pagination.totalItems).toBe(0);
    });

    it('ทัวร์ที่ไม่มีจริง → 404 เสมอ ไม่ถูกแคชเป็นผลสำเร็จ', async () => {
        for (let i = 0; i < 2; i++) {
            const res = await anon.get('/api/v1/tournaments/99999999/pickem-leaderboard');
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('TOURNAMENT_NOT_FOUND');
        }
    });
});
