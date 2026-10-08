import { beforeEach, describe, expect, it } from 'vitest';
import { all, one, testDb } from './helpers/db.js';
import { createFaculty, createSportType, createTournament, createUser, type TestUser } from './helpers/factories.js';
import { sweepAutoDeleteTournaments } from '../../services/tournament.service.js';

/**
 * BR-03 ส่วนที่ 1 (มติ 8 ต.ค. 2569) — ทัวร์ที่ยัง private เมื่อถึงวันแข่ง ⇒ 'auto_deleted'
 *
 * 🔴 ก่อนหน้านี้ **ไม่มีโค้ดไหนตั้งสถานะนี้เลย** มีแต่ฝั่งอ่านที่ซ่อนมันไว้
 *   ⇒ สถานะมีอยู่ใน enum แต่ไม่มีทางไปถึงได้จริง (`it.todo` ค้างอยู่ใน tournament.delete.test.ts)
 *
 * ★ ต้องเป็นเทส integration เพราะทั้งกฎอยู่ใน SQL — unit ที่ mock repo ทิ้งจะไม่เห็นอะไรเลย
 *   เรื่องที่พลาดง่ายที่สุดคือ **ขอบของวัน**: `event_start_date` เป็นชนิด DATE
 *   ถ้าเทียบด้วย NOW() ทัวร์ที่เริ่ม "วันนี้" จะถูกปิดตั้งแต่เที่ยงคืนตรง แทนที่จะมีเวลาทั้งวัน
 *
 * ★ อีกสองส่วนของ BR-03 **ยังไม่ได้ทำ** เพราะยังไม่มีมติ:
 *   แจ้งเตือนล่วงหน้ากี่วัน · "ลบเมื่อครบ 4 ปี" นับจากอะไรและลบจริงหรือ soft delete
 */

let faculty: number;
let sport: number;
let organizer: TestUser;

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

/** ทัวร์ที่มีสถานะและวันเริ่มตามต้องการ */
async function tour(status: string, startDate: string): Promise<number> {
    const id = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'private' });
    await testDb().query('UPDATE tournaments SET tournament_status = ?, event_start_date = ? WHERE tournament_id = ?',
        [status, startDate, id]);
    return id;
}

const statusOf = async (id: number) =>
    (await one<{ tournament_status: string }>('SELECT tournament_status FROM tournaments WHERE tournament_id = ?', [id]))!.tournament_status;

beforeEach(async () => {
    faculty = await createFaculty();
    sport = await createSportType({ minMembers: 1, maxMembers: 10 });
    organizer = await createUser();
});

describe('BR-03 — ปิดทัวร์ที่ยังไม่เผยแพร่จนถึงวันแข่ง', () => {
    it('private + วันแข่งผ่านไปแล้ว → auto_deleted', async () => {
        const id = await tour('private', YESTERDAY);
        const swept = await sweepAutoDeleteTournaments();

        expect(swept.map(s => s.tournamentId)).toContain(id);
        expect(await statusOf(id)).toBe('auto_deleted');
    });

    /** 🔴 ขอบของวัน — ถ้าเทียบด้วย NOW() เคสนี้จะถูกปิดทั้งที่วันแข่งยังไม่ผ่าน */
    it('private + วันแข่งคือวันนี้ → ถูกปิด (ถึงวันแข่งแล้ว)', async () => {
        const id = await tour('private', TODAY);
        await sweepAutoDeleteTournaments();
        expect(await statusOf(id)).toBe('auto_deleted');
    });

    it('private + วันแข่งยังไม่ถึง → ไม่ถูกแตะ', async () => {
        const id = await tour('private', TOMORROW);
        await sweepAutoDeleteTournaments();
        expect(await statusOf(id)).toBe('private');
    });

    it.each(['public', 'completed', 'pending_approval', 'rejected'])(
        'สถานะ %s แม้วันแข่งผ่านไปแล้ว → ไม่ถูกแตะ (กฎนี้พูดถึงทัวร์ที่ยังไม่เผยแพร่เท่านั้น)', async (status) => {
            const id = await tour(status, YESTERDAY);
            await sweepAutoDeleteTournaments();
            expect(await statusOf(id)).toBe(status);
        });

    it('ทัวร์ที่ถูกลบไปแล้ว (deleted_at) → ไม่ถูกแตะซ้ำ', async () => {
        const id = await tour('private', YESTERDAY);
        await testDb().query('UPDATE tournaments SET deleted_at = NOW() WHERE tournament_id = ?', [id]);

        const swept = await sweepAutoDeleteTournaments();
        expect(swept.map(s => s.tournamentId)).not.toContain(id);
        expect(await statusOf(id)).toBe('private');
    });

    it('ปิดรับสมัครไปด้วย — ไม่ให้มีใบสมัครใหม่วิ่งเข้าหาทัวร์ที่ตายแล้ว', async () => {
        const id = await tour('private', YESTERDAY);
        await testDb().query('UPDATE tournaments SET registration_open = TRUE WHERE tournament_id = ?', [id]);

        await sweepAutoDeleteTournaments();
        const row = await one<{ registration_open: number }>('SELECT registration_open FROM tournaments WHERE tournament_id = ?', [id]);
        expect(row!.registration_open).toBe(0);
    });

    it('ผู้จัดได้รับแจ้งเตือน พร้อมเหตุผลและชื่อทัวร์', async () => {
        const id = await tour('private', YESTERDAY);
        const name = (await one<{ name: string }>('SELECT name FROM tournaments WHERE tournament_id = ?', [id]))!.name;

        await sweepAutoDeleteTournaments();

        const notes = await all<{ type: string; title: string; message: string; related_entity_id: number }>(
            'SELECT type, title, message, related_entity_id FROM notifications WHERE user_id = ? AND type = ?',
            [organizer.id, 'tournament_auto_deleted']);
        expect(notes).toHaveLength(1);
        expect(notes[0]!.title).toContain(name);
        expect(notes[0]!.message).toContain('ยังไม่ได้เผยแพร่');
        expect(notes[0]!.related_entity_id).toBe(id);
    });

    /** ★ รอบที่สองต้องไม่แจ้งซ้ำ — งานนี้รันทุกชั่วโมง ถ้าแจ้งซ้ำผู้จัดจะได้แจ้งเตือนเดิมทุกชั่วโมงตลอดไป */
    it('รันซ้ำ → ไม่ปิดซ้ำ ไม่แจ้งซ้ำ', async () => {
        const id = await tour('private', YESTERDAY);

        await sweepAutoDeleteTournaments();
        const second = await sweepAutoDeleteTournaments();

        expect(second.map(s => s.tournamentId)).not.toContain(id);
        const notes = await all('SELECT 1 FROM notifications WHERE user_id = ? AND type = ?',
            [organizer.id, 'tournament_auto_deleted']);
        expect(notes).toHaveLength(1);
    });

    it('ไม่มีทัวร์ไหนเข้าเกณฑ์ → ไม่แจ้งใครเลย', async () => {
        await tour('private', TOMORROW);
        expect(await sweepAutoDeleteTournaments()).toEqual([]);
        expect(await all('SELECT 1 FROM notifications WHERE type = ?', ['tournament_auto_deleted'])).toEqual([]);
    });
});
