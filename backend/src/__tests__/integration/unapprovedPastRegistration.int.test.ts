import { beforeEach, describe, expect, it } from 'vitest';
import { as } from './helpers/api.js';
import { all, one, testDb } from './helpers/db.js';
import { createFaculty, createSportType, createTournament, createUser, makeAdmin, type TestUser } from './helpers/factories.js';
import { sweepAutoDeleteTournaments, sweepUnapprovedPastRegistration } from '../../services/tournament.service.js';
import { thaiDatePlusDays } from '../../utils/thaiDate.js';

/** วันไทย (YYYY-MM-DD) — 31 ต.ค. 2569: เดิมใช้ CURDATE() (วัน UTC) */
const day = (offsetDays: number) => thaiDatePlusDays(Date.now(), offsetDays);

/**
 * OD-80 (30 ต.ค. 2569 · เอกสารแก้ UI ข้อ 9) — คำขอจัดทัวร์ที่ admin ไม่อนุมัติจนเลยวันปิดรับสมัคร ⇒ 'auto_deleted'
 *
 * 🔴 เดิมไม่มีงานไหนแตะ pending_approval ⇒ คำขอค้างรออนุมัติตลอดไป (ทัวร์ 2 ในฐานเดโม)
 * ★ ต้องเป็นเทส integration เพราะกฎอยู่ใน SQL — เรื่องที่พลาดง่ายคือขอบเวลา (registration_end เป็น DATETIME)
 *   และด่านอนุมัติใน service ต้องตัดสินตรงกับงาน (JS เทียบเวลา · SQL เทียบ NOW())
 */

let faculty: number;
let sport: number;
let organizer: TestUser;

/** ทัวร์สถานะที่ต้องการ · regEndSql = นิพจน์ SQL ของ registration_end (หรือ NULL) */
async function tour(status: string, regEndSql: string, eventStart = `'${day(10)}'`): Promise<number> {
    const id = await createTournament({ organizer: organizer.id, sportTypeId: sport, facultyId: faculty, status: 'pending_approval' });
    await testDb().query(
        `UPDATE tournaments SET tournament_status = ?, registration_start = NOW() - INTERVAL 5 DAY,
                registration_end = ${regEndSql}, event_start_date = ${eventStart} WHERE tournament_id = ?`,
        [status, id]);
    return id;
}

const statusOf = async (id: number) =>
    (await one<{ tournament_status: string }>('SELECT tournament_status FROM tournaments WHERE tournament_id = ?', [id]))!.tournament_status;
const notesOf = (userId: number) => all<{ title: string; message: string; related_entity_id: number }>(
    'SELECT title, message, related_entity_id FROM notifications WHERE user_id = ? AND type = ?', [userId, 'tournament_auto_deleted']);

beforeEach(async () => {
    faculty = await createFaculty();
    sport = await createSportType();
    organizer = await createUser();
});

describe('OD-80 — ปิดคำขอที่ไม่ได้อนุมัติทันวันปิดรับสมัคร', () => {
    it('รออนุมัติ + ปิดรับสมัครไปแล้ว 1 ชม. → auto_deleted · ปิดรับสมัคร', async () => {
        const id = await tour('pending_approval', 'NOW() - INTERVAL 1 HOUR');
        await testDb().query('UPDATE tournaments SET registration_open = TRUE WHERE tournament_id = ?', [id]);

        expect((await sweepUnapprovedPastRegistration()).map(s => s.tournamentId)).toContain(id);
        expect(await statusOf(id)).toBe('auto_deleted');
        expect((await one<{ registration_open: number }>('SELECT registration_open FROM tournaments WHERE tournament_id = ?', [id]))!.registration_open).toBe(0);
    });

    it('รออนุมัติ + ยังเหลือเวลารับสมัคร 1 ชม. → ไม่ถูกแตะ', async () => {
        const id = await tour('pending_approval', 'NOW() + INTERVAL 1 HOUR');
        await sweepUnapprovedPastRegistration();
        expect(await statusOf(id)).toBe('pending_approval');
    });

    it.each([
        ['วันแข่งผ่านไปแล้ว → ปิด', `'${day(-1)}'`, 'auto_deleted'],
        ['วันแข่งยังไม่ถึง → ไม่แตะ', `'${day(1)}'`, 'pending_approval'],
    ])('ไม่มีวันปิดรับสมัคร (ข้อมูลเก่า) · %s', async (_label, eventStart, expected) => {
        const id = await tour('pending_approval', 'NULL', eventStart);
        await sweepUnapprovedPastRegistration();
        expect(await statusOf(id)).toBe(expected);
    });

    it.each(['private', 'public', 'rejected', 'completed'])(
        'สถานะ %s แม้เลยวันปิดรับสมัคร → งานนี้ไม่แตะ', async (status) => {
            const id = await tour(status, 'NOW() - INTERVAL 1 DAY');
            await sweepUnapprovedPastRegistration();
            expect(await statusOf(id)).toBe(status);
        });

    it('ทัวร์ที่ถูกลบไปแล้ว (deleted_at) → ไม่แตะ', async () => {
        const id = await tour('pending_approval', 'NOW() - INTERVAL 1 DAY');
        await testDb().query('UPDATE tournaments SET deleted_at = NOW() WHERE tournament_id = ?', [id]);
        await sweepUnapprovedPastRegistration();
        expect(await statusOf(id)).toBe('pending_approval');
    });

    it('ผู้จัดได้แจ้งเตือน "admin ไม่ได้อนุมัติทันวันรับสมัคร" — ไม่ใช่ข้อความ "ยังไม่ได้เผยแพร่" ของ BR-03', async () => {
        const id = await tour('pending_approval', 'NOW() - INTERVAL 1 HOUR');
        const name = (await one<{ name: string }>('SELECT name FROM tournaments WHERE tournament_id = ?', [id]))!.name;

        await sweepUnapprovedPastRegistration();

        const notes = await notesOf(organizer.id);
        expect(notes).toHaveLength(1);
        expect(notes[0]!.title).toContain(name);
        expect(notes[0]!.message).toContain('ไม่ได้อนุมัติทันวันปิดรับสมัคร');
        expect(notes[0]!.message).not.toContain('ยังไม่ได้เผยแพร่');
        expect(notes[0]!.related_entity_id).toBe(id);
    });

    it('รันซ้ำ → ไม่ปิดซ้ำ ไม่แจ้งซ้ำ', async () => {
        const id = await tour('pending_approval', 'NOW() - INTERVAL 1 HOUR');
        await sweepUnapprovedPastRegistration();
        expect((await sweepUnapprovedPastRegistration()).map(s => s.tournamentId)).not.toContain(id);
        expect(await notesOf(organizer.id)).toHaveLength(1);
    });

    /** งาน BR-03 เดิมยังไม่แตะ pending_approval — สองงานแยกกัน ไม่ซ้อนกัน */
    it('งาน BR-03 (private ถึงวันแข่ง) ยังไม่แตะคำขอที่รออนุมัติ', async () => {
        const id = await tour('pending_approval', 'NOW() - INTERVAL 1 DAY', `'${day(-1)}'`);
        await sweepAutoDeleteTournaments();
        expect(await statusOf(id)).toBe('pending_approval');
    });
});

/**
 * ด่านอนุมัติ — งานรันชั่วโมงละครั้ง ⇒ ก่อนงานรอบถัดไป admin ยังเห็นคำขอที่เลยวันอยู่
 * ★ ใช้ NOW() ของฐานตั้งค่าในเทส แล้วให้ service เทียบด้วยเวลาของ JS ⇒ พิสูจน์ว่าสองฝั่งอ่านเวลาตรงกัน (UTC)
 */
describe('OD-80 — อนุมัติคำขอที่เลยวันปิดรับสมัครไม่ได้', () => {
    let admin: TestUser;
    beforeEach(async () => {
        admin = await createUser();
        await makeAdmin(admin.id, 'university_wide');
    });

    it('เลยวันปิดรับสมัคร 1 ชม. → 409 REGISTRATION_PERIOD_ENDED · ยังรออนุมัติ (ให้งานปิดตามกฎ)', async () => {
        const id = await tour('pending_approval', 'NOW() - INTERVAL 1 HOUR');
        const res = await as(admin).post(`/tournaments/${id}/approve`);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('REGISTRATION_PERIOD_ENDED');
        expect(res.body.error.tournamentId).toBe(id);
        expect(await statusOf(id)).toBe('pending_approval');
    });

    it('ไม่มีวันปิดรับสมัคร + วันแข่งผ่านไปแล้ว → 409 เหมือนกัน (เกณฑ์เดียวกับงาน)', async () => {
        const id = await tour('pending_approval', 'NULL', `'${day(-1)}'`);
        const res = await as(admin).post(`/tournaments/${id}/approve`);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('REGISTRATION_PERIOD_ENDED');
    });

    it('ยังเหลือเวลารับสมัคร 1 ชม. → อนุมัติได้', async () => {
        const id = await tour('pending_approval', 'NOW() + INTERVAL 1 HOUR');
        expect((await as(admin).post(`/tournaments/${id}/approve`)).status).toBe(200);
        expect(await statusOf(id)).toBe('private');
    });

    it('ถูกงานปิดไปแล้ว → อนุมัติไม่ได้ (409 INVALID_STATUS_TRANSITION ตามเดิม)', async () => {
        const id = await tour('pending_approval', 'NOW() - INTERVAL 1 HOUR');
        await sweepUnapprovedPastRegistration();
        const res = await as(admin).post(`/tournaments/${id}/approve`);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
});

/** 🔴 31 ต.ค. 2569 — คำขอที่ไม่มีวันปิดรับสมัคร ใช้วันแข่งแทน ⇒ นับวันไทย · ตรึงเวลาเอง */
describe('OD-80 — นับวันตามเวลาไทย', () => {
    it('ไม่มีวันปิดรับสมัคร · ตี 1 ไทยของวันแข่ง → ปิด · 23:30 ไทยของวันก่อนหน้า → ยังไม่ปิด', async () => {
        const id = await tour('pending_approval', 'NULL', "'2030-01-10'");
        await sweepUnapprovedPastRegistration(new Date('2030-01-09T23:30:00+07:00'));
        expect(await statusOf(id)).toBe('pending_approval');
        await sweepUnapprovedPastRegistration(new Date('2030-01-10T01:00:00+07:00'));
        expect(await statusOf(id)).toBe('auto_deleted');
    });
});
