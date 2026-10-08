import { beforeEach, describe, expect, it } from 'vitest';
import { all, one, testDb } from './helpers/db.js';
import { createFaculty, createSportType, createTournament, createUser, type TestUser } from './helpers/factories.js';
import { AUTO_DELETE_WARNING_DAYS, purgeExpiredTournaments, sweepAutoDeleteTournaments,
         TOURNAMENT_RETENTION_YEARS, warnBeforeAutoDelete } from '../../services/tournament.service.js';

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

const day = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const TODAY = day(0);
const YESTERDAY = day(-1);
const TOMORROW = day(1);

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


/**
 * BR-03 ส่วนที่ 2 (มติ 8 ต.ค. 2569) — เตือนผู้จัด 7 วันก่อนปิด
 *
 * ★ สิ่งที่พลาดง่ายที่สุดคือ **เตือนซ้ำ** — งานนี้รันทุกชั่วโมง
 *   ถ้าด่าน `auto_delete_warned_at` หลุด ผู้จัดจะได้ข้อความเดิม 24 ครั้งต่อวัน ตลอด 7 วัน
 *   เทสเรื่องนี้ต้องมี เพราะมันไม่ทำให้อะไรพัง — แค่สร้างความรำคาญที่ไม่มีใครเห็นในเทสอื่น
 */
describe('BR-03 ส่วนที่ 2 — เตือนล่วงหน้า 7 วัน', () => {
    const warningsFor = async (userId: number) => all<{ title: string; message: string; related_entity_id: number }>(
        'SELECT title, message, related_entity_id FROM notifications WHERE user_id = ? AND type = ?',
        [userId, 'tournament_auto_delete_warning']);

    it('private + เหลือ 7 วันพอดี → ได้รับคำเตือน พร้อมวันเริ่มแข่งและทางออก', async () => {
        const id = await tour('private', day(AUTO_DELETE_WARNING_DAYS));
        const name = (await one<{ name: string }>('SELECT name FROM tournaments WHERE tournament_id = ?', [id]))!.name;

        expect(await warnBeforeAutoDelete()).toContain(id);

        const notes = await warningsFor(organizer.id);
        expect(notes).toHaveLength(1);
        expect(notes[0]!.title).toContain(name);
        expect(notes[0]!.message).toContain(day(AUTO_DELETE_WARNING_DAYS));
        expect(notes[0]!.message).toContain('เผยแพร่');          // ต้องบอกทางออก ไม่ใช่แค่ขู่
        expect(notes[0]!.related_entity_id).toBe(id);
    });

    it('เหลือน้อยกว่า 7 วัน → ได้รับคำเตือนด้วย (ไม่ใช่เตือนแค่วันที่ตรงเป๊ะ)', async () => {
        const id = await tour('private', day(2));
        expect(await warnBeforeAutoDelete()).toContain(id);
    });

    it('ยังเหลือมากกว่า 7 วัน → ยังไม่เตือน', async () => {
        const id = await tour('private', day(AUTO_DELETE_WARNING_DAYS + 1));
        expect(await warnBeforeAutoDelete()).not.toContain(id);
        expect(await warningsFor(organizer.id)).toEqual([]);
    });

    /** 🔴 ไม่งั้นผู้จัดจะได้ "อีก 0 วันจะถูกปิด" กับ "ถูกปิดแล้ว" ในรอบงานเดียวกัน */
    it('ถึงวันแข่งแล้ว → ไม่เตือน (เป็นงานของตัวที่ปิดเลย)', async () => {
        const id = await tour('private', TODAY);
        expect(await warnBeforeAutoDelete()).not.toContain(id);
        expect(await warningsFor(organizer.id)).toEqual([]);
    });

    /** 🔴 ด่านกันเตือนซ้ำ — งานนี้รันทุกชั่วโมง */
    it('รันซ้ำ → เตือนครั้งเดียว', async () => {
        const id = await tour('private', day(3));

        await warnBeforeAutoDelete();
        expect(await warnBeforeAutoDelete()).not.toContain(id);
        expect(await warningsFor(organizer.id)).toHaveLength(1);
    });

    it.each(['public', 'completed', 'pending_approval', 'rejected'])(
        'สถานะ %s → ไม่เตือน (กฎพูดถึงทัวร์ที่ยังไม่เผยแพร่เท่านั้น)', async (status) => {
            await tour(status, day(3));
            expect(await warnBeforeAutoDelete()).toEqual([]);
        });

    it('เตือนแล้วค่อยเผยแพร่ → ไม่ถูกปิดเมื่อถึงวันแข่ง', async () => {
        const id = await tour('private', day(1));
        await warnBeforeAutoDelete();

        await testDb().query("UPDATE tournaments SET tournament_status = 'public' WHERE tournament_id = ?", [id]);
        await testDb().query('UPDATE tournaments SET event_start_date = ? WHERE tournament_id = ?', [YESTERDAY, id]);

        await sweepAutoDeleteTournaments();
        expect(await statusOf(id)).toBe('public');
    });
});

/**
 * BR-03 ส่วนที่ 3 (มติ 8 ต.ค. 2569) — ทัวร์ที่ปิดไปเกิน 4 ปี ⇒ soft delete
 *
 * ★ "วันปิดทัวร์" = COALESCE(completed_at, event_end_date, event_start_date)
 *   ลำดับเดียวกับที่ `career.repo.ts` ใช้อยู่แล้ว — ไม่ใช่กฎใหม่
 *   🔴 ถ้าดูแต่ `completed_at` ทัวร์ที่ไม่มีใครกดปิดจะอยู่ในระบบตลอดกาล
 */
describe('BR-03 ส่วนที่ 3 — ลบทัวร์ที่ปิดเกิน 4 ปี', () => {
    const YEARS_AGO_5 = day(-365 * 5);
    const YEARS_AGO_3 = day(-365 * 3);

    const deletedInfo = (id: number) =>
        one<{ deleted_at: Date | null; deleted_by: number | null }>(
            'SELECT deleted_at, deleted_by FROM tournaments WHERE tournament_id = ?', [id]);

    it('ปิดไปแล้ว 5 ปี (completed_at) → soft delete · deleted_by เป็น NULL (ระบบลบ)', async () => {
        const id = await tour('completed', YEARS_AGO_5);
        await testDb().query('UPDATE tournaments SET completed_at = ? WHERE tournament_id = ?', [YEARS_AGO_5, id]);

        expect(await purgeExpiredTournaments()).toBeGreaterThanOrEqual(1);
        const row = await deletedInfo(id);
        expect(row!.deleted_at).not.toBeNull();
        expect(row!.deleted_by).toBeNull();
    });

    it('ปิดไปแล้ว 3 ปี → ยังไม่ลบ', async () => {
        const id = await tour('completed', YEARS_AGO_3);
        await testDb().query('UPDATE tournaments SET completed_at = ? WHERE tournament_id = ?', [YEARS_AGO_3, id]);

        await purgeExpiredTournaments();
        expect((await deletedInfo(id))!.deleted_at).toBeNull();
    });

    /** 🔴 เคสที่หลุดถ้าดูแต่ completed_at — ทัวร์ที่ไม่มีใครกดปิด */
    it('ไม่มี completed_at แต่ event_end_date ผ่านมา 5 ปี → ลบ', async () => {
        const id = await tour('public', YEARS_AGO_5);
        await testDb().query('UPDATE tournaments SET completed_at = NULL, event_end_date = ? WHERE tournament_id = ?',
            [YEARS_AGO_5, id]);

        await purgeExpiredTournaments();
        expect((await deletedInfo(id))!.deleted_at).not.toBeNull();
    });

    it('ไม่มีทั้ง completed_at และ event_end_date → ใช้ event_start_date', async () => {
        const id = await tour('rejected', YEARS_AGO_5);
        await testDb().query('UPDATE tournaments SET completed_at = NULL, event_end_date = NULL WHERE tournament_id = ?', [id]);

        await purgeExpiredTournaments();
        expect((await deletedInfo(id))!.deleted_at).not.toBeNull();
    });

    /** ★ completed_at ต้องชนะ event_start_date — ทัวร์ที่เริ่มนานแล้วแต่ปิดเมื่อปีก่อน ยังไม่ครบ 4 ปี */
    it('วันเริ่มเก่า 5 ปี แต่เพิ่งปิดปีก่อน → ยังไม่ลบ (completed_at ต้องมาก่อน)', async () => {
        const id = await tour('completed', YEARS_AGO_5);
        await testDb().query('UPDATE tournaments SET completed_at = ?, event_end_date = ? WHERE tournament_id = ?',
            [day(-365), day(-365), id]);

        await purgeExpiredTournaments();
        expect((await deletedInfo(id))!.deleted_at).toBeNull();
    });

    it('ลบไปแล้ว → ไม่ถูกนับซ้ำในรอบถัดไป', async () => {
        const id = await tour('completed', YEARS_AGO_5);
        await testDb().query('UPDATE tournaments SET completed_at = ? WHERE tournament_id = ?', [YEARS_AGO_5, id]);

        const first = await purgeExpiredTournaments();
        const second = await purgeExpiredTournaments();
        expect(first).toBeGreaterThanOrEqual(1);
        expect(second).toBe(0);
    });

    it('สถานะไม่ถูกเปลี่ยนเป็น auto_deleted — ส่วนนี้คือการลบ ไม่ใช่การปิด', async () => {
        const id = await tour('completed', YEARS_AGO_5);
        await testDb().query('UPDATE tournaments SET completed_at = ? WHERE tournament_id = ?', [YEARS_AGO_5, id]);

        await purgeExpiredTournaments();
        expect(await statusOf(id)).toBe('completed');
    });

    it('ไม่แจ้งเตือนใคร — เรื่องนี้เกิดหลังปิดทัวร์ 4 ปี ไม่มีอะไรให้ใครทำต่อ', async () => {
        const id = await tour('completed', YEARS_AGO_5);
        await testDb().query('UPDATE tournaments SET completed_at = ? WHERE tournament_id = ?', [YEARS_AGO_5, id]);

        await purgeExpiredTournaments();
        expect(await all('SELECT 1 FROM notifications WHERE related_entity_id = ? AND related_entity_type = ?',
            [id, 'tournament'])).toEqual([]);
    });

    it('ค่าคงที่ที่ใช้คือ 4 ปี และ 7 วัน ตามมติ', () => {
        expect(TOURNAMENT_RETENTION_YEARS).toBe(4);
        expect(AUTO_DELETE_WARNING_DAYS).toBe(7);
    });
});
