import mysql from 'mysql2/promise';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { perfDb } from './env.js';

/**
 * Seed ปริมาณตาม "ตารางปริมาณงาน" ใน SRS 3.2 — ใส่ตรงด้วย bulk INSERT (ส่วนที่ไม่ได้เป็นเป้าการวัด)
 *
 *   บัญชีผู้ใช้        30,000      (SRS: 20,000–40,000)
 *   ทัวร์นาเมนต์       60          (SRS: 30–50 / ปี — ใส่เกินเล็กน้อยให้ตารางมีของเก่าด้วย)
 *   ทีมต่อทัวร์         8–64        (SRS: 4–64) · ผู้เล่นต่อทีม 2–15 (SRS: 1–15)
 *   Pick'em            4,000 คน × 32 แมตช์ = 128,000 การทาย ในทัวร์ "ร้อน" ทัวร์เดียว
 *
 * ★ ส่วนที่ "เป็นเป้าการวัด" ไม่ seed ตรง ทำผ่าน API จริงใน run.ts:
 *   สร้างสาย (PF-03) · ส่งผล + ยืนยัน (ตัดสินแต้ม pick'em) · เช็คอิน (PF-05)
 *
 * ★ ใช้ id ตายตัว (ฐานเพิ่งสร้าง มีแค่ rewards จาก migration 041) ⇒ อ้างถึงกันได้โดยไม่ต้องอ่านกลับ
 */

export const N_USERS = 30_000;
export const ORGANIZERS = { from: 1, to: 70 };
export const REFEREES = { from: 71, to: 100 };
export const PREDICTORS = { from: 20_001, to: 24_000 };   // 4,000 คนที่ทายทุกแมตช์รอบแรกของทัวร์ร้อน
export const VU_USERS = { from: 24_001, to: 30_000 };     // ผู้ใช้เสมือนตอนยิงโหลด (ไม่อยู่ในทีม/ทัวร์ใด ⇒ ทายผลได้)

const SPORTS = [
    // id, ชื่อ, min, max, default_mode, supports_best_of, ขนาดทีมที่ seed
    [1, 'ฟุตบอล', 11, 15, 'onsite', 0, 11],
    [2, 'บาสเกตบอล', 5, 12, 'onsite', 1, 8],
    [3, 'ฟุตซอล', 5, 10, 'onsite', 0, 5],
    [4, 'วอลเลย์บอล', 6, 12, 'onsite', 1, 6],
    [5, 'แบดมินตันคู่', 2, 2, 'onsite', 1, 2],
    [6, 'ROV', 5, 7, 'online', 1, 5],
] as const;

type Format = 'single_elimination' | 'double_elimination' | 'round_robin';
type TourSpec = { id: number; name: string; sport: number; format: Format; teams: number; teamSize: number };

export const HOT_TOUR = 1;                       // ทัวร์ที่คนดูเยอะสุดในวันแข่ง — บาส 64 ทีม
export const CHECKIN_TOUR = 14;                  // ฟุตบอล 2 ทีม × 15 คน สำหรับ PF-05
export const PF03_FORMATS: Format[] = ['single_elimination', 'double_elimination', 'round_robin'];
export const PF03_SIZES = [8, 16, 32, 64];
export const pf03TourId = (format: Format, size: number) =>
    2 + PF03_FORMATS.indexOf(format) * PF03_SIZES.length + PF03_SIZES.indexOf(size);
export const BACKGROUND_TOURS = { from: 15, to: 60 };

function tourSpecs(): TourSpec[] {
    const specs: TourSpec[] = [{ id: HOT_TOUR, name: 'บาสเกตบอลมหาวิทยาลัย 2569 (ทัวร์ร้อน)', sport: 2, format: 'single_elimination', teams: 64, teamSize: 8 }];
    for (const format of PF03_FORMATS) {
        for (const size of PF03_SIZES) {
            specs.push({ id: pf03TourId(format, size), name: `PF-03 ${format} ${size} ทีม`, sport: 3, format, teams: size, teamSize: 5 });
        }
    }
    specs.push({ id: CHECKIN_TOUR, name: 'ฟุตบอลเช็คอิน PF-05', sport: 1, format: 'single_elimination', teams: 2, teamSize: 15 });
    for (let id = BACKGROUND_TOURS.from; id <= BACKGROUND_TOURS.to; id++) {
        const sport = SPORTS[id % SPORTS.length]!;
        const rr = id % 3 === 0;
        specs.push({ id, name: `ทัวร์${sport[1]} รุ่น ${id}`, sport: sport[0], format: rr ? 'round_robin' : 'single_elimination',
                     teams: rr ? 8 : 16, teamSize: sport[6] });
    }
    return specs;
}

const dt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
const DAY = 86_400_000;

async function bulk(pool: Pool, table: string, cols: string[], rows: unknown[][], chunk = 2000): Promise<void> {
    for (let i = 0; i < rows.length; i += chunk) {
        await pool.query(`INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(',')}) VALUES ?`, [rows.slice(i, i + chunk)]);
    }
}

export type SeedInfo = {
    tours: TourSpec[];
    organizerOf: Record<number, number>;
    /** ทีมของแต่ละทัวร์ (ตามลำดับ) */
    teamsOf: Record<number, number[]>;
    leaderOf: Record<number, number>;
    membersOf: Record<number, number[]>;
};

export async function seedBulk(): Promise<SeedInfo> {
    const pool = mysql.createPool({ ...perfDb(), charset: 'utf8mb4', timezone: 'Z', connectionLimit: 4 });
    const t0 = Date.now();
    try {
        // ── อ้างอิง ──
        await bulk(pool, 'faculties', ['faculty_id', 'name'], Array.from({ length: 15 }, (_, i) => [i + 1, `คณะที่ ${i + 1}`]));
        await bulk(pool, 'departments', ['department_id', 'faculty_id', 'name'],
            Array.from({ length: 45 }, (_, i) => [i + 1, Math.floor(i / 3) + 1, `ภาควิชาที่ ${i + 1}`]));
        await bulk(pool, 'sport_types', ['sport_type_id', 'name', 'min_members', 'max_members', 'default_mode', 'supports_best_of'],
            SPORTS.map(s => [s[0], s[1], s[2], s[3], s[4], s[5]]));

        // ── ผู้ใช้ 30,000 ──
        const users: unknown[][] = [];
        for (let id = 1; id <= N_USERS; id++) {
            const dep = (id % 45) + 1;
            users.push([id, `ผู้ใช้ทดสอบ ${id}`, `perf${id}@perf.local`, 'not-a-bcrypt-hash-login-disabled',
                id % 2 ? 'male' : 'female', `${2001 + (id % 6)}-0${1 + (id % 9)}-15`, id <= 100 ? 'staff' : 'student',
                Math.floor((dep - 1) / 3) + 1, dep, id <= 100 ? null : 1 + (id % 4), 1]);
        }
        await bulk(pool, 'users', ['user_id', 'full_name', 'email', 'password_hash', 'gender', 'birth_date', 'user_type',
            'faculty_id', 'department_id', 'year', 'email_verified'], users);

        // ── ทัวร์ ทีม ใบสมัคร รายชื่อลงแข่ง ──
        const tours = tourSpecs();
        const info: SeedInfo = { tours, organizerOf: {}, teamsOf: {}, leaderOf: {}, membersOf: {} };
        const now = Date.now();
        const tourRows: unknown[][] = [], teamRows: unknown[][] = [], memberRows: unknown[][] = [];
        let nextUser = 101, nextTeam = 1;
        for (const t of tours) {
            const organizer = ORGANIZERS.from + (t.id % (ORGANIZERS.to - ORGANIZERS.from + 1));
            info.organizerOf[t.id] = organizer;
            tourRows.push([t.id, t.name, t.sport, t.format, 'faculty', (t.id % 15) + 1, organizer, 'public', 0,
                dt(new Date(now - 20 * DAY)), dt(new Date(now - 5 * DAY)), dt(new Date(now + DAY)).slice(0, 10),
                dt(new Date(now + 30 * DAY)).slice(0, 10), t.teams, 2, 'สนามกีฬากลาง']);
            info.teamsOf[t.id] = [];
            for (let k = 0; k < t.teams; k++) {
                const teamId = nextTeam++;
                const members = Array.from({ length: t.teamSize }, () => nextUser++);
                info.teamsOf[t.id]!.push(teamId);
                info.leaderOf[teamId] = members[0]!;
                info.membersOf[teamId] = members;
                teamRows.push([teamId, `ทีม ${teamId}`, t.sport, members[0], 'Ready', 'Unofficial', 'public']);
                for (const u of members) memberRows.push([teamId, u]);
            }
        }
        if (nextUser > PREDICTORS.from) throw new Error(`[perf] สมาชิกทีมล้นเข้าช่วง predictors (${nextUser})`);

        await bulk(pool, 'tournaments', ['tournament_id', 'name', 'sport_type_id', 'bracket_format', 'scope_type',
            'organizing_faculty_id', 'requested_by_user_id', 'tournament_status', 'registration_open', 'registration_start',
            'registration_end', 'event_start_date', 'event_end_date', 'max_teams', 'min_teams', 'venue'], tourRows);
        await bulk(pool, 'teams', ['team_id', 'name', 'sport_type_id', 'leader_id', 'readiness_status', 'official_status', 'visibility'], teamRows);
        await bulk(pool, 'team_members', ['team_id', 'user_id'], memberRows);

        // ใบสมัคร (approved) — ต้องอ่าน id กลับมาเพื่อผูก application_players
        await bulk(pool, 'tournament_applications', ['tournament_id', 'team_id', 'tournament_application_status', 'hard_filter_passed'],
            tours.flatMap(t => info.teamsOf[t.id]!.map(team => [t.id, team, 'approved', 1])));
        const [apps] = await pool.query<RowDataPacket[]>('SELECT tournament_application_id AS a, tournament_id AS t, team_id AS team FROM tournament_applications');
        await bulk(pool, 'application_players', ['tournament_application_id', 'tournament_id', 'user_id'],
            apps.flatMap(r => info.membersOf[r['team']]!.map(u => [r['a'], r['t'], u])));

        // กรรมการของทัวร์ร้อนและทัวร์เช็คอิน (ตอบรับแล้ว · คนใน)
        await bulk(pool, 'tournament_referees', ['tournament_id', 'user_id', 'invited_by', 'invitation_status'], [
            ...Array.from({ length: 10 }, (_, i) => [HOT_TOUR, REFEREES.from + i, info.organizerOf[HOT_TOUR], 'accepted']),
            [CHECKIN_TOUR, REFEREES.from + 20, info.organizerOf[CHECKIN_TOUR], 'accepted'],
        ]);

        const [[counts]] = await pool.query<RowDataPacket[]>(
            `SELECT (SELECT COUNT(*) FROM users) u, (SELECT COUNT(*) FROM tournaments) t, (SELECT COUNT(*) FROM teams) tm,
                    (SELECT COUNT(*) FROM team_members) m, (SELECT COUNT(*) FROM application_players) ap`);
        console.log(`[perf] seed: users=${counts!['u']} tournaments=${counts!['t']} teams=${counts!['tm']} ` +
                    `members=${counts!['m']} roster=${counts!['ap']} (${Date.now() - t0} ms)`);
        return info;
    } finally {
        await pool.end();
    }
}

/** การทาย 4,000 คน × ทุกแมตช์ที่ส่งมา (เรียกหลังสร้างสายทัวร์ร้อนแล้ว) */
export async function seedPredictions(matches: { id: number; a: number; b: number }[]): Promise<number> {
    const pool = mysql.createPool({ ...perfDb(), charset: 'utf8mb4', timezone: 'Z', connectionLimit: 4 });
    try {
        const rows: unknown[][] = [];
        for (let u = PREDICTORS.from; u <= PREDICTORS.to; u++) {
            for (const m of matches) {
                // สุ่มแบบกำหนดได้ — ให้ได้ทั้งทายถูกเป๊ะ ใกล้ และผิดข้าง
                const h = (u * 31 + m.id * 17) % 100;
                const aWins = h < 55;
                const hi = 60 + (h % 30), lo = hi - 1 - (h % 12);
                rows.push([u, m.id, aWins ? m.a : m.b, JSON.stringify(aWins ? { [m.a]: hi, [m.b]: lo } : { [m.a]: lo, [m.b]: hi })]);
            }
        }
        await bulk(pool, 'pickem_predictions', ['user_id', 'match_id', 'predicted_winner_team_id', 'predicted_score_data'], rows, 5000);
        return rows.length;
    } finally {
        await pool.end();
    }
}

/** เปิดคิวรีตรงสั้น ๆ ระหว่าง run (เตรียมสถานะแมตช์ที่ไม่ใช่เป้าการวัด) */
export function perfPool(): Pool {
    return mysql.createPool({ ...perfDb(), charset: 'utf8mb4', timezone: 'Z', connectionLimit: 2 });
}
