import { insert } from './db.js';
import { signToken } from '../../../utils/token.js';

/**
 * ตัวปั้นข้อมูลสำหรับ integration test — แต่ละตัวสร้าง "แถวเดียวที่ถูกต้อง" พร้อมค่าตั้งต้นที่สมเหตุสมผล
 *
 * ★ หลักการ: เทสบอกเฉพาะสิ่งที่สำคัญกับเทสนั้น ที่เหลือเป็นค่าตั้งต้น
 *     const tour = await createTournament({ organizer: orgA.id, status: 'public' });
 * ★ ทุกตัวคืน id จริงจากฐาน — ห้ามเดา id (resetDb ไม่ย้อน AUTO_INCREMENT)
 * ★ คอลัมน์ที่บังคับดูจาก information_schema ของฐานเทสจริง (schema.sql + migration ถึง 045)
 */

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(++seq).toString(36)}`;

// ───────────────────────────── ข้อมูลอ้างอิง ─────────────────────────────

export async function createFaculty(o: { name?: string } = {}): Promise<number> {
    return insert('faculties', { name: o.name ?? `คณะทดสอบ ${uniq()}` });
}

/**
 * 🆕 supportsBestOf (migration 047) — ค่าเริ่มต้น **true** ต่างจาก DEFAULT 0 ของฐานโดยเจตนา
 *   ฐานตั้ง 0 ไว้เพื่อให้กีฬาจริงที่เพิ่มใหม่ต้องมีคนตั้งใจเปิด (ดูเหตุผลใน migration 047)
 *   แต่ "กีฬาทดสอบ" ในเทสเป็นกีฬากลาง ๆ ที่เทสส่วนใหญ่ไม่สนเรื่อง BO
 *   ⇒ ถ้าตามค่าฐาน เทสที่ตั้ง BO จะได้ 400 โดยไม่เกี่ยวกับเรื่องที่มันทดสอบ
 *   เทสที่อยากทดสอบ **ด่าน** ของมติ 7 ต.ค. ให้ส่ง supportsBestOf: false มาตรง ๆ
 */
export async function createSportType(
    o: { name?: string; minMembers?: number; maxMembers?: number; supportsBestOf?: boolean } = {}
): Promise<number> {
    return insert('sport_types', {
        name: o.name ?? `กีฬาทดสอบ ${uniq()}`,
        min_members: o.minMembers ?? 2,
        max_members: o.maxMembers ?? 10,
        supports_best_of: (o.supportsBestOf ?? true) ? 1 : 0,
    });
}

// ───────────────────────────── ผู้ใช้ ─────────────────────────────

export type TestUser = { id: number; email: string; token: string };

/**
 * ★ password_hash เป็นค่าที่ไม่ใช่ bcrypt โดยเจตนา ⇒ ล็อกอินด้วยรหัสผ่านไม่ได้
 *   เทสส่วนใหญ่ใช้ token ที่ออกตรง ๆ (เร็วกว่า bcrypt มาก) · เทสของ /auth/login ให้ใช้ createUserWithPassword
 */
export async function createUser(o: {
    fullName?: string; email?: string; facultyId?: number | null; year?: number | null;
    gender?: 'male' | 'female' | 'other'; birthDate?: string; userType?: 'student' | 'staff' | 'external';
    suspended?: boolean; suspendedUntil?: Date | null; emailVerified?: boolean;
} = {}): Promise<TestUser> {
    const email = o.email ?? `user-${uniq()}@test.local`;
    const id = await insert('users', {
        full_name: o.fullName ?? `ผู้ใช้ ${uniq()}`,
        email,
        password_hash: 'not-a-bcrypt-hash-login-disabled',
        gender: o.gender ?? 'male',
        birth_date: o.birthDate ?? '2004-01-15',
        user_type: o.userType ?? 'student',
        faculty_id: o.facultyId ?? null,
        year: o.year ?? null,
        is_suspended: o.suspended ? 1 : 0,
        suspended_until: o.suspendedUntil ?? null,
        ...(o.emailVerified === undefined ? {} : { email_verified: o.emailVerified ? 1 : 0 }),
    });
    // B1 — บัญชีที่เพิ่งสร้างอยู่ที่เลขรุ่น 0 (DEFAULT ของ migration 046) ยังไม่เคยเปลี่ยนรหัสผ่าน
    return { id, email, token: signToken(id, 0) };
}

export async function createUserWithPassword(password: string, o: Parameters<typeof createUser>[0] = {}): Promise<TestUser> {
    const { hashPassword } = await import('../../../utils/password.js');
    const user = await createUser(o);
    const { testDb } = await import('./db.js');
    await testDb().query('UPDATE users SET password_hash = ? WHERE user_id = ?', [await hashPassword(password), user.id]);
    return user;
}

/** root มีได้คนเดียวทั้งระบบ (root_singleton ใน 030) — สร้างซ้ำในเทสเดียวกันจะชน UNIQUE */
export async function makeAdmin(userId: number, scope: 'faculty' | 'university_wide' | 'root', facultyId: number | null = null): Promise<number> {
    return insert('admin_scopes', { user_id: userId, scope_type: scope, faculty_id: scope === 'faculty' ? facultyId : null });
}

// ───────────────────────────── ทัวร์นาเมนต์ ─────────────────────────────

type TournamentStatus = 'pending_approval' | 'rejected' | 'private' | 'public' | 'completed' | 'auto_deleted';

export async function createTournament(o: {
    organizer: number; sportTypeId: number; facultyId?: number | null;
    status?: TournamentStatus; registrationOpen?: boolean; name?: string;
    bracketFormat?: 'single_elimination' | 'double_elimination' | 'round_robin' | null;
    minTeams?: number; maxTeams?: number;
    genderRequirement?: 'any' | 'male' | 'female'; minAge?: number | null; maxAge?: number | null;
}): Promise<number> {
    const day = 24 * 3600 * 1000;
    const iso = (d: number) => new Date(Date.now() + d * day).toISOString().slice(0, 19).replace('T', ' ');
    return insert('tournaments', {
        name: o.name ?? `ทัวร์ทดสอบ ${uniq()}`,
        sport_type_id: o.sportTypeId,
        scope_type: 'faculty',
        organizing_faculty_id: o.facultyId ?? null,
        requested_by_user_id: o.organizer,
        tournament_status: o.status ?? 'private',
        registration_open: o.registrationOpen ? 1 : 0,
        // เปิดรับสมัคร = ธงเปิด **และ** อยู่ในช่วงเวลา (P01 เช็คทั้งสองอย่าง) ⇒ เลื่อนวันเริ่มมาอยู่ในอดีต
        registration_start: o.registrationOpen ? iso(-1) : iso(1),
        registration_end: iso(10),
        event_start_date: iso(20).slice(0, 10),
        event_end_date: iso(21).slice(0, 10),
        bracket_format: o.bracketFormat === undefined ? 'single_elimination' : o.bracketFormat,
        min_teams: o.minTeams ?? 2,
        max_teams: o.maxTeams ?? 16,
        venue: 'สนามทดสอบ',
        gender_requirement: o.genderRequirement ?? 'any',
        min_age: o.minAge ?? null,
        max_age: o.maxAge ?? null,
    });
}

/** กรรมการของทัวร์ — ค่าตั้งต้นคือ "ตอบรับแล้ว และเป็นคนใน" ⇒ active ตาม toRefereeStatus() */
export async function addTournamentReferee(o: {
    tournamentId: number; userId: number; invitedBy: number;
    invitationStatus?: 'pending' | 'accepted' | 'rejected';
}): Promise<number> {
    return insert('tournament_referees', {
        tournament_id: o.tournamentId,
        user_id: o.userId,
        invited_by: o.invitedBy,
        invitation_status: o.invitationStatus ?? 'accepted',
    });
}

// ───────────────────────────── ทีม ─────────────────────────────

export async function createTeam(o: {
    leader: number; sportTypeId: number; members?: number[]; name?: string;
    readiness?: 'Forming' | 'Ready'; official?: boolean; visibility?: 'private' | 'public';
}): Promise<number> {
    const teamId = await insert('teams', {
        name: o.name ?? `ทีมทดสอบ ${uniq()}`,
        sport_type_id: o.sportTypeId,
        leader_id: o.leader,
        readiness_status: o.readiness ?? 'Ready',
        official_status: o.official ? 'Official' : 'Unofficial',
        visibility: o.visibility ?? 'private',
    });
    for (const userId of new Set([o.leader, ...(o.members ?? [])])) {
        await insert('team_members', { team_id: teamId, user_id: userId });
    }
    return teamId;
}

// ───────────────────────────── แมตช์ ─────────────────────────────

type MatchStatus = 'scheduled' | 'checkin_open' | 'in_progress' | 'finished' | 'completed' | 'disputed' | 'result_rejected';

export async function createMatch(o: {
    tournamentId: number; teamA: number | null; teamB: number | null;
    mode?: 'onsite' | 'online'; status?: MatchStatus; round?: number;
    /** ผู้ชนะไหลไปแมตช์นี้ (สร้างแมตช์ปลายทางก่อน แล้วส่ง id มา) */
    nextMatchId?: number | null;
    /** ตั้งเวลาแข่ง (จบหลังเริ่ม 1 ชม.) — การเปลี่ยนกรรมการต้องมีเวลาในอนาคต · ไม่ส่ง = ยังไม่ตั้งเวลา */
    scheduledAt?: Date;
    /** สนาม — เปิดเช็คอิน/เริ่มแข่งต้องมีเวลาและสนามครบ (assertFixtureComplete) */
    venue?: string;
}): Promise<number> {
    return insert('matches', {
        tournament_id: o.tournamentId,
        team_a_id: o.teamA,
        team_b_id: o.teamB,
        mode: o.mode ?? 'onsite',
        match_status: o.status ?? 'scheduled',
        round_number: o.round ?? 1,
        next_match_id: o.nextMatchId ?? null,
        scheduled_time: o.scheduledAt ?? null,
        scheduled_end_time: o.scheduledAt ? new Date(o.scheduledAt.getTime() + 3600_000) : null,
        venue: o.venue ?? null,
    });
}

export async function assignMatchReferee(o: {
    matchId: number; tournamentRefereeId: number; status?: 'pending' | 'accepted' | 'declined';
}): Promise<number> {
    return insert('match_referees', {
        match_id: o.matchId,
        tournament_referee_id: o.tournamentRefereeId,
        assignment_status: o.status ?? 'accepted',
    });
}
