import { beforeEach, describe, expect, it } from 'vitest';
import { insert, testDb } from './helpers/db.js';
import { createFaculty, createMatch, createSportType, createTeam, createTournament, createUser, type TestUser } from './helpers/factories.js';
import { sweepInactiveTeams } from '../../repositories/team.repo.js';

/**
 * 🔴 A2 (8 ต.ค. 2569) — เขียนกฎ "เว้นว่างเกิน 6 เดือน" (BR-06 ข้อ 2) ใหม่เพื่อความเร็ว
 *
 * เดิมใช้ `(m.team_a_id = t.team_id OR m.team_b_id = t.team_id)` ซึ่ง `OR` คร่อมสองคอลัมน์
 * ⇒ ใช้ index ไม่ได้ ⇒ ไล่ `matches` ใหม่ทุกทีม · และฟังก์ชันนี้ถูกเรียกทุกครั้งที่เปิดหน้าทีม
 * ⇒ ถือ connection ของ pool ไว้นาน ⇒ ทุก endpoint รอคิวตาม
 *
 * ★ ไฟล์นี้ไม่ได้วัดความเร็ว — มันพิสูจน์สิ่งที่สำคัญกว่า: **กวาดทีมชุดเดิมเป๊ะ**
 *   เทส unit อ่านแต่ข้อความ SQL ⇒ จับไม่ได้ว่าความหมายเปลี่ยนไป
 *   เคสที่เสี่ยงที่สุดคือ NULL: ของเดิมพึ่ง `MAX(...) = NULL` ของใหม่พึ่ง "ไม่โผล่ในชุด IN"
 *   ถ้าใครเผลอใส่ COALESCE เพื่อ "กัน NULL" ทีมที่เพิ่งสร้างจะถูกกวาดทิ้งทันที
 */

let sport: number;
let faculty: number;
let leader: TestUser;
let tour: number;

const LONG_AGO = new Date(Date.now() - 400 * 24 * 3600_000);
const RECENT = new Date(Date.now() - 10 * 24 * 3600_000);

beforeEach(async () => {
    sport = await createSportType({ minMembers: 1, maxMembers: 10 });
    faculty = await createFaculty();
    leader = await createUser();
    tour = await createTournament({ organizer: leader.id, sportTypeId: sport, facultyId: faculty, status: 'public' });
});

/** ทีมที่สร้างไว้นานแล้วและ "เคยสมัครทัวร์" — ให้พ้นกฎ 14 วัน จะได้เหลือกฎ 6 เดือนกฎเดียว */
async function oldTeam(name: string): Promise<number> {
    const id = await createTeam({ leader: leader.id, sportTypeId: sport, name });
    await testDb().query('UPDATE teams SET created_at = ? WHERE team_id = ?', [LONG_AGO, id]);
    await insert('tournament_applications', {
        tournament_id: tour, team_id: id, tournament_application_status: 'rejected',
    });
    await testDb().query('UPDATE tournament_applications SET applied_at = ? WHERE team_id = ?', [LONG_AGO, id]);
    return id;
}

/** แมตช์ที่จบแล้วเมื่อ `when` — `updated_at` คือสิ่งที่กฎนี้วัด */
async function completedMatch(teamA: number | null, teamB: number | null, when: Date): Promise<void> {
    const id = await createMatch({ tournamentId: tour, teamA, teamB, status: 'completed' });
    await testDb().query('UPDATE matches SET updated_at = ? WHERE match_id = ?', [when, id]);
}

const sweptIds = async () => (await sweepInactiveTeams()).filter(s => s.reason === 'inactive_6_months').map(s => s.teamId);

describe('A2 — กฎ "เว้นว่างเกิน 6 เดือน" ต้องกวาดทีมชุดเดิมหลังเขียน SQL ใหม่', () => {
    it('แมตช์ล่าสุดอยู่ฝั่ง A และนานเกิน 6 เดือน → ถูกกวาด', async () => {
        const team = await oldTeam('ฝั่ง A เก่า');
        await completedMatch(team, null, LONG_AGO);
        expect(await sweptIds()).toContain(team);
    });

    /** 🔴 เคสที่ `OR` เดิมคลุมไว้ — ถ้าเขียนใหม่ผิด ทีมแบบนี้จะหลุด */
    it('แมตช์ล่าสุดอยู่ฝั่ง B เท่านั้น และนานเกิน 6 เดือน → ถูกกวาด', async () => {
        const team = await oldTeam('ฝั่ง B เก่า');
        await completedMatch(null, team, LONG_AGO);
        expect(await sweptIds()).toContain(team);
    });

    it('🔴 แมตช์เก่าอยู่ฝั่ง A แต่แมตช์ใหม่อยู่ฝั่ง B → ยังไม่ถูกกวาด (ต้องรวมสองฝั่งก่อนเทียบ)', async () => {
        const team = await oldTeam('เก่า A ใหม่ B');
        await completedMatch(team, null, LONG_AGO);
        await completedMatch(null, team, RECENT);
        expect(await sweptIds()).not.toContain(team);
    });

    it('มีแมตช์จบไม่นานมานี้ → ไม่ถูกกวาด', async () => {
        const team = await oldTeam('เพิ่งแข่ง');
        await completedMatch(team, null, RECENT);
        expect(await sweptIds()).not.toContain(team);
    });

    it('แมตช์เก่าแต่ยังไม่ completed → ไม่นับ ⇒ ไม่มีแมตช์ที่จบเลย ⇒ กฎนี้ไม่จับ', async () => {
        const team = await oldTeam('ยังไม่จบ');
        const id = await createMatch({ tournamentId: tour, teamA: team, teamB: null, status: 'scheduled' });
        await testDb().query('UPDATE matches SET updated_at = ? WHERE match_id = ?', [LONG_AGO, id]);
        expect(await sweptIds()).not.toContain(team);
    });

    /**
     * 🔴 เคสที่พังง่ายที่สุดถ้าเขียนใหม่ผิด
     * ของเดิม: `MAX(...)` เป็น NULL แล้ว `NULL < x` เป็นเท็จ
     * ของใหม่: ทีมนี้ไม่โผล่ในชุด `IN` เลย
     * ⇒ ผลเหมือนกัน แต่ถ้าใครใส่ COALESCE เพื่อ "กัน NULL" ทีมใหม่จะถูกกวาดทิ้งทันที
     */
    it('ทีมที่ไม่เคยมีแมตช์ที่จบเลย → กฎนี้ไม่จับ (เป็นหน้าที่ของกฎ 14 วัน)', async () => {
        const team = await oldTeam('ไม่เคยแข่ง');
        expect(await sweptIds()).not.toContain(team);
    });

    it('ทีมที่มีใบสมัคร pending/approved ภายใน 6 เดือน → ไม่ถูกกวาด', async () => {
        const team = await oldTeam('ยังสมัครค้างอยู่');
        await completedMatch(team, null, LONG_AGO);
        await insert('tournament_applications', {
            tournament_id: tour, team_id: team, tournament_application_status: 'pending',
        });
        expect(await sweptIds()).not.toContain(team);
    });

    it('ทีม Official → ไม่ถูกกวาด', async () => {
        const team = await oldTeam('ทีมทางการ');
        await completedMatch(team, null, LONG_AGO);
        await testDb().query("UPDATE teams SET official_status = 'Official' WHERE team_id = ?", [team]);
        expect(await sweptIds()).not.toContain(team);
    });

    it('ทีมที่ถูกปิดไปแล้ว → ไม่ถูกกวาดซ้ำ', async () => {
        const team = await oldTeam('ปิดไปแล้ว');
        await completedMatch(team, null, LONG_AGO);
        await testDb().query('UPDATE teams SET deleted_at = NOW() WHERE team_id = ?', [team]);
        expect(await sweptIds()).not.toContain(team);
    });

    it('แมตช์ของทีมอื่นไม่ทำให้ทีมนี้รอด — ชุดแมตช์ต้องแยกตามทีมถูกต้อง', async () => {
        const quiet = await oldTeam('ทีมเงียบ');
        const busy = await oldTeam('ทีมที่ยังแข่ง');
        await completedMatch(quiet, null, LONG_AGO);
        await completedMatch(busy, null, RECENT);

        const swept = await sweptIds();
        expect(swept).toContain(quiet);
        expect(swept).not.toContain(busy);
    });
});
