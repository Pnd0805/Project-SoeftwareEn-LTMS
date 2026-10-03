import pool from "../config/db.js";
import { notSuspendedSql , suspendedSql } from '../utils/suspension.js';
import type { SuspensionCategory } from '../utils/suspension.js';
import type { RowDataPacket , ResultSetHeader} from 'mysql2';

import type { TeamInvitationRow, TeamRow, UserRow } from "../types/db.js";
import type { UpdateMeInput } from "../schemas/user.schema.js";
import type { UserRefDto } from "../mappers/user.mapper.js";
import type { TeamRef } from "../mappers/team.mapper.js";

export async function findByEmail(email : string): Promise<UserRow | null>{
    const [rows] = await pool.query<(UserRow & RowDataPacket)[]>('SELECT * FROM users WHERE email = ?',[email]);
    const user = rows[0];

    return user ?? null;
}

export async function findById(userId : number): Promise<UserRow | null>{
    const [ rows ] = await pool.query<(UserRow & RowDataPacket)[]>('SELECT * FROM users WHERE user_id = ?',[userId]);
    const user = rows[0];

    return user ?? null;
}


type NewUser = {
  fullName: string;
  email: string;
  passwordHash: string;
  gender: 'male' | 'female' | 'other';
  birthDate: string;
  facultyId: number;
  departmentId: number;
  year: number;
};

export async function create(data: NewUser): Promise<number>{
    const [ result ] = await pool.query<(ResultSetHeader)>(`INSERT INTO users(full_name , email , 
        password_hash , gender , birth_date , user_type , faculty_id , department_id , year) VALUES (? , ? , ? ,? ,? , 'student' , ? ,? ,?)`,
       [data.fullName , data.email , data.passwordHash , data.gender , data.birthDate , data.facultyId , data.departmentId ,data.year]); 
    
    return result.insertId;
}

/** U06 — ค้นจากชื่อ (บางส่วน) หรืออีเมล (ขึ้นต้น) · ไม่คืนอีเมลใน response จึงเดาอีเมลคนอื่นจากผลลัพธ์ไม่ได้ */
export async function searchByName(userName : string) : Promise<Pick<UserRow , 'user_id' | 'full_name' | 'profile_image_key'>[]>{
    const [ rows ] = await pool.query<(UserRow & RowDataPacket)[]>(`SELECT user_id , full_name , profile_image_key FROM users
                                                                    WHERE (full_name LIKE ? OR email LIKE ?) AND ${notSuspendedSql('users')}
                                                                    ORDER BY full_name LIMIT 20` , [`%${userName}%`, `${userName}%`]);
    return rows;
}; 

export async function updatePassword(userId : number , passwordHash : string) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `UPDATE users SET password_hash = ? WHERE user_id = ?`, [passwordHash , userId]);
    return result.affectedRows;
}

// OD-53 — ไม่รวมกับ update() ข้างล่าง เพราะนั่นเป็นข้อมูลที่ "เจ้าตัวแก้เองได้"
// ส่วนธงนี้เป็นข้อสรุปของระบบ ขึ้นได้ทางเดียวคือกรอก OTP ที่ระบบส่งไปถูก — ห้ามมีทางให้ตั้งเอง
// ไม่เซ็ต updated_at — คอลัมน์นั้นหมายถึง "เจ้าตัวแก้โปรไฟล์เมื่อไหร่" การยืนยันอีเมลไม่ใช่การแก้โปรไฟล์
export async function markEmailVerified(userId : number) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `UPDATE users SET email_verified = 1 WHERE user_id = ?`, [userId]);
    return result.affectedRows;
}

export async function update(userId : number , input : UpdateMeInput) : Promise<number> {
    const sets:string[] = [];
    const values: unknown[] = [];

    if(input.avatarUrl !== undefined){
        sets.push('profile_image_key = ?');
        values.push(input.avatarUrl);
    }

    if(input.contactInfo !== undefined){
        sets.push('contact_info = ?');
        values.push(input.contactInfo);
    }

    if(input.address !== undefined){
        sets.push('address = ?');
        values.push(input.address);
    }

    if(input.showProfileStats !== undefined){
        sets.push('show_profile_stats = ?');
        values.push(input.showProfileStats ? 1 : 0);
    }

    sets.push('updated_at = NOW()');

    const [ result ] = await pool.query<ResultSetHeader>(`UPDATE users SET ${sets.join(', ')} WHERE user_id = ?`
                                                        ,[ ...values , userId]);

    return result.affectedRows;
}

// OD-43 — ตั้งค่าแจ้งเตือนรายหมวด · คอลัมน์ `notification_prefs` มีอยู่ใน schema แล้ว จึงไม่มี migration
// เก็บเป็น JSON object ของหมวดที่ "ปิด" เท่านั้นก็พอ แต่เก็บครบทุกคีย์ให้อ่านง่ายกว่าเวลา debug

/** อ่านเฉพาะคอลัมน์เดียว — ไม่ใช้ findById เพราะมันเป็น SELECT * ทั้งแถวเพื่อค่าตัวเดียว */
export async function findNotificationPrefs(userId : number) : Promise<unknown>{
    const [ rows ] = await pool.query<({ notification_prefs : unknown } & RowDataPacket)[]>(
        'SELECT notification_prefs FROM users WHERE user_id = ?' , [userId]);

    return rows[0]?.notification_prefs ?? null;
}

/** เขียนทับทั้งก้อน (ฝั่ง service รวมค่าเดิมกับค่าใหม่มาให้แล้ว) · คืน affectedRows ไว้ให้ service เช็คว่ามี user จริง */
export async function updateNotificationPrefs(userId : number , prefs : Record<string , boolean>) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        'UPDATE users SET notification_prefs = ? , updated_at = NOW() WHERE user_id = ?' ,
        [ JSON.stringify(prefs) , userId ]);

    return result.affectedRows;
}

// C2 — GET /admin/users · LEFT JOIN admin_scopes เพื่อคืน adminScope ติดมาด้วย (ไม่ SELECT * เพราะ users/admin_scopes มี faculty_id ชื่อชนกัน)
export type AdminUserRow = Pick<UserRow , 'user_id' | 'full_name' | 'email' | 'user_type' | 'faculty_id' | 'is_suspended' | 'suspended_reason' | 'suspended_until' | 'suspended_category'> & {
    admin_scope_id : number | null , admin_scope_type : 'faculty' | 'university_wide' | 'root' | null , admin_scope_faculty_id : number | null
};

export async function searchUsersAdmin(filters : { q? : string | undefined; facultyId? : number | undefined; suspended? : boolean | undefined },
                                        offset : number , pageSize : number) : Promise<{ rows : AdminUserRow[]; totalItems : number }>{
    const where : string[] = [];
    const params : unknown[] = [];
    if(filters.q){ where.push('(u.full_name LIKE ? OR u.email LIKE ?)'); params.push(`%${filters.q}%` , `%${filters.q}%`); }
    if(filters.facultyId !== undefined){ where.push('u.faculty_id = ?'); params.push(filters.facultyId); }
    // filters.suspended ถามถึงสถานะ *ตอนนี้* — คนที่หมดกำหนดแล้วต้องไม่โผล่ในลิสต์ "ถูกระงับ" ทั้งที่ธงยังค้างเป็น 1
    if(filters.suspended !== undefined){ where.push(filters.suspended ? suspendedSql('u') : notSuspendedSql('u')); }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [ rows ] = await pool.query<(AdminUserRow & RowDataPacket)[]>(
        `SELECT u.user_id , u.full_name , u.email , u.user_type , u.faculty_id , u.is_suspended , u.suspended_reason , u.suspended_until , u.suspended_category,
                s.admin_scope_id , s.scope_type AS admin_scope_type , s.faculty_id AS admin_scope_faculty_id
           FROM users u LEFT JOIN admin_scopes s ON s.user_id = u.user_id
          ${whereSql}
          ORDER BY u.user_id LIMIT ? OFFSET ?` , [...params , pageSize , offset]);
    const [ count ] = await pool.query<({ totalItems : number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems FROM users u ${whereSql}` , params);

    return { rows , totalItems : Number(count[0]?.totalItems ?? 0) };
}

// ตอนปลด (suspended = false) ล้างทุกอย่างที่เกี่ยวกับโทษ — ไม่ปล่อยค้างให้โทษรอบหน้าสืบทอดกำหนด/ประเภทเก่ามาเงียบๆ
export async function suspendUser(userId : number , suspended : boolean , reason : string | null ,
                                   until : Date | null = null , category : SuspensionCategory | null = null) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(
        `UPDATE users SET is_suspended = ? , suspended_reason = ? , suspended_until = ? , suspended_category = ? WHERE user_id = ?`,
        [suspended ? 1 : 0 , reason , suspended ? until : null , suspended ? category : null , userId]);
    return result.affectedRows;
}

// C2 ข้อ 3 — ห้ามระงับ ORG ที่มีทัวร์ public ค้างอยู่
export async function hasActivePublicTournamentAsOrganizer(userId : number) : Promise<boolean>{
    const [ rows ] = await pool.query<(RowDataPacket)[]>(
        `SELECT 1 FROM tournaments WHERE requested_by_user_id = ? AND tournament_status = 'public' LIMIT 1`,[userId]);
    return rows.length > 0;
}

// C2 ข้อ 3 — ห้ามระงับหัวหน้าทีมที่มีใบสมัคร approved ค้างอยู่ในทัวร์ public
export async function hasApprovedApplicationAsLeader(userId : number) : Promise<boolean>{
    const [ rows ] = await pool.query<(RowDataPacket)[]>(
        `SELECT 1 FROM teams t
           JOIN tournament_applications a ON a.team_id = t.team_id
           JOIN tournaments tour ON tour.tournament_id = a.tournament_id
          WHERE t.leader_id = ? AND a.tournament_application_status = 'approved' AND tour.tournament_status = 'public'
          LIMIT 1`,[userId]);
    return rows.length > 0;
}

export type MyInvitationRow = Pick<TeamInvitationRow , 'team_invitation_id' | 'expires_at'> &
                              Pick<UserRow , 'user_id' | 'full_name' | 'profile_image_key'> &
                              Pick<TeamRow , 'team_id' | 'name' | 'sport_type_id' >;

export async function getMyInvitation(invitedUserId : number) : Promise<MyInvitationRow[]>{
    const [ rows ] = await pool.query<(MyInvitationRow & RowDataPacket)[]>(`SELECT inv.team_invitation_id , inv.expires_at ,
                                                                            u.user_id , u.full_name , u.profile_image_key  ,
                                                                            t.team_id , t.name , t.sport_type_id
                                                                            FROM team_invitations inv JOIN teams t ON inv.team_id = t.team_id
                                                                            JOIN users u ON u.user_id = inv.invited_by_user_id

                                                                            WHERE inv.invited_user_id = ? AND inv.team_invitation_status = ? AND inv.expires_at > NOW()`
                                                                            ,[invitedUserId , 'pending']);
    return rows;
}