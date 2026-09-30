import pool from "../config/db.js";
import type { TeamDto, TeamMemberWithUserRef , OfficialMemberConflict } from "../mappers/team.mapper.js";
import type { TeamInput , updateTeamInput} from "../schemas/team.schema.js";
import type { TeamRow ,TeamMemberRow, TeamInvitationRow , UserRow, TeamAdminRequestRow, MatchRow} from "../types/db.js";
import type { RowDataPacket , ResultSetHeader } from "mysql2";


export async function findById(teamId : number) : Promise<TeamRow | null> {
    const [ rows ] = await pool.query<(TeamRow & RowDataPacket)[]>('SELECT * FROM teams WHERE team_id=?',[teamId]);
    const team = rows[0];
    return team ?? null;
}

/**
 * ทีมที่ผู้ใช้อยู่ — **เฉพาะทีมที่ยังไม่ถูกลบ** (เติม deleted_at IS NULL เมื่อ 30 ก.ย. 2569)
 * เดิมคืนทีมที่ TM-07 กวาดทิ้งมาด้วย คนจึงเห็นทีมค้างใน "ทีมของฉัน" ที่กดอะไรก็ 404
 * เป็นการหลุดจุดเดียว — countUnofficialTeamsByUser และ searchTeams มีเงื่อนไขนี้มาตลอด
 * ทีมที่ถูกลบยังเปิดตรง GET /teams/:id ได้ (readinessStatus: 'Inactive') ลิงก์เก่าจึงยังอธิบายตัวเองได้
 */
export async function findTeamsByUser(userId : number) : Promise<TeamRow[]>{
    const [rows] = await pool.query<(TeamRow & RowDataPacket)[]>(`SELECT t.* FROM teams t JOIN team_members tm
                                                                ON t.team_id = tm.team_id
                                                                WHERE tm.user_id = ? AND t.deleted_at IS NULL`, [userId]);
    return rows;
}

export async function findByNameAndSport(name : string , sportId : number) : Promise<TeamRow | null>{
    const [ rows ] = await pool.query<(TeamRow & RowDataPacket)[]>('SELECT * FROM teams WHERE name LIKE ? AND sport_type_id = ?',[name , sportId]);
    const team = rows[0]; 
    return team ?? null;
};

export async function countUnofficialTeamsByUser(userId : number) : Promise<number>{
    const [ rows ] = await pool.query<({ Unofficial_Team: number } & RowDataPacket)[]>(`SELECT count(*) as Unofficial_Team 
                                                                    FROM teams t JOIN team_members tm
                                                                    ON t.team_id = tm.team_id 
                                                                    WHERE tm.user_id = ? AND t.official_status = 'Unofficial' AND t.deleted_at IS NULL
                                                                    `,[userId]);
    return rows[0]!.Unofficial_Team;
};

export async function createTeam(input : TeamInput , leaderId : number) : Promise<number>{
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [ result ] = await conn.query<ResultSetHeader>(`INSERT INTO teams(name ,sport_type_id , leader_id)
            VALUES(? , ? , ?)`,[input.name , input.sportTypeId , leaderId]);

        await conn.query('INSERT INTO team_members(team_id , user_id) VALUES(? , ?)',[result.insertId , leaderId]);

        await conn.commit();
        return result.insertId;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

export async function update(teamId : number , newTeam : updateTeamInput){
    const sets : string[] = [];
    const values : unknown[] = [];

    if(newTeam.name !== undefined){
        sets.push('name = ?');
        values.push(newTeam.name);
    }
    if(newTeam.visibility !== undefined){
        sets.push('visibility = ?');
        values.push(newTeam.visibility);
    }
    if(newTeam.logoKey !== undefined){   // null ผ่านเข้ามาได้ (ล้างโลโก้) — เช็ค !== undefined ไม่ใช่ truthy
        sets.push('logo_key = ?');
        values.push(newTeam.logoKey);
    }

    sets.push('updated_at = NOW()');

    const [ result ] = await pool.query<ResultSetHeader>(`UPDATE teams SET ${sets.join(', ')} WHERE team_id = ?`,[...values , teamId]);
    return result.affectedRows;
}


export async function deleteTeam(teamId : number){
    const [ result ] = await pool.query<ResultSetHeader>('UPDATE teams SET deleted_at = NOW() , deleted_reason = ? WHERE team_id = ? AND deleted_at IS NULL' , ["leader_deleted" , teamId]);
    return result.affectedRows;
}

// TM-07 / BR-06 — กวาดทีมไม่ใช้งานแบบ lazy (ไม่มี cron) เรียกก่อน query จริงใน T02/T03 (GUIDE/12)
// เปลี่ยนชื่อทีมตอนลบด้วย เพื่อปล่อย UNIQUE(name, sport_type_id) ให้ตั้งชื่อซ้ำได้ (มติ GUIDE/12 ข้อ "ฟื้นทีมที่ถูกปิดได้ไหม")
// เช็ค "เคยแข่ง" ผ่าน MAX(matches.updated_at) แทนการเขียน teams.last_competed_at ตรงๆ — เลี่ยงไม่ต้องแก้โค้ดฝั่ง Matches/Results
const SWEEP_RULES = {
    // สร้างมาเกิน 14 วันแล้วไม่เคยสมัครทัวร์ไหนเลย
    no_registration : `t.deleted_at IS NULL
            AND t.created_at < NOW() - INTERVAL 14 DAY
            AND NOT EXISTS (SELECT 1 FROM tournament_applications a WHERE a.team_id = t.team_id)`,
    // ไม่มีแมตช์ที่จบมาเกิน 6 เดือน และไม่มีใบสมัครที่ยังเดินอยู่
    inactive_6_months : `t.deleted_at IS NULL
            AND (SELECT MAX(m.updated_at) FROM matches m
                  WHERE (m.team_a_id = t.team_id OR m.team_b_id = t.team_id) AND m.match_status = 'completed'
                ) < NOW() - INTERVAL 6 MONTH
            AND NOT EXISTS (SELECT 1 FROM tournament_applications a
                             WHERE a.team_id = t.team_id
                               AND a.tournament_application_status IN ('pending','approved')
                               AND a.applied_at > NOW() - INTERVAL 6 MONTH)`
} as const;

export type SweptTeam = { teamId : number , name : string , reason : keyof typeof SWEEP_RULES };

/**
 * คืนทีมที่ "การเรียกครั้งนี้" กวาดจริง พร้อมชื่อเดิม — service เอาไปแจ้งลูกทีม (มติ 30 ก.ย. 2569)
 *
 * เดิมเป็น UPDATE ก้อนเดียวแล้วคืนแค่จำนวนแถว ซึ่งบอกไม่ได้ว่าทีมไหนโดนกวาด
 * จึงแยกเป็น SELECT แล้ว UPDATE ทีละทีม โดยยังมี deleted_at IS NULL อยู่ใน WHERE —
 * ถ้ามีสอง request กวาดพร้อมกัน มีแค่ตัวที่ affectedRows = 1 ที่ได้แจ้ง ลูกทีมจึงไม่ได้แจ้งเตือนซ้ำ
 * ชื่อที่คืนคือชื่อก่อนต่อท้าย '(deleted #id)' — ข้อความแจ้งต้องเป็นชื่อที่ลูกทีมรู้จัก
 */
export async function sweepInactiveTeams() : Promise<SweptTeam[]>{
    const swept : SweptTeam[] = [];

    for(const reason of Object.keys(SWEEP_RULES) as (keyof typeof SWEEP_RULES)[]){
        const [ candidates ] = await pool.query<({ team_id : number , name : string } & RowDataPacket)[]>(
            `SELECT t.team_id , t.name FROM teams t WHERE ${SWEEP_RULES[reason]}`);

        for(const team of candidates){
            const [ result ] = await pool.query<ResultSetHeader>(
                `UPDATE teams
                    SET deleted_at = NOW(), deleted_reason = ?, name = CONCAT(name, ' (deleted #', team_id, ')')
                  WHERE team_id = ? AND deleted_at IS NULL`, [reason , team.team_id]);

            if(result.affectedRows === 1){
                swept.push({ teamId : team.team_id , name : team.name , reason });
            }
        }
    }

    return swept;
}



//--- Member
/**
 * T19 — ค้นหาทีมสาธารณะ (มติ 20 ก.ย. 2569): เฉพาะทีมที่ยังอยู่ (deleted_at IS NULL — ทีม Inactive/ถูกลบไม่โชว์ ดูได้ผ่านทัวร์เก่าเท่านั้น)
 * คืนพร้อม member_count และหัวหน้า — ไม่คืน roster
 */
export type TeamSearchRow = TeamRow & { member_count : number; max_members : number; leader_full_name : string; leader_profile_image_key : string | null };

export async function searchTeams(filters : { q? : string | undefined; sportTypeId? : number | undefined; visibility? : 'private' | 'public' | undefined },
                                  offset : number , pageSize : number): Promise<{ rows : TeamSearchRow[]; totalItems : number }>{
    const where = ['t.deleted_at IS NULL'];
    const params : unknown[] = [];
    if(filters.q){ where.push('t.name LIKE ?'); params.push(`%${filters.q}%`); }
    if(filters.sportTypeId !== undefined){ where.push('t.sport_type_id = ?'); params.push(filters.sportTypeId); }
    if(filters.visibility !== undefined){ where.push('t.visibility = ?'); params.push(filters.visibility); }
    const whereSql = where.join(' AND ');
    const [rows] = await pool.query<(TeamSearchRow & RowDataPacket)[]>(
        `SELECT t.*, u.full_name AS leader_full_name, u.profile_image_key AS leader_profile_image_key, s.max_members,
                (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.team_id) AS member_count
         FROM teams t JOIN users u ON u.user_id = t.leader_id JOIN sport_types s ON s.sport_type_id = t.sport_type_id
         WHERE ${whereSql}
         ORDER BY t.name, t.team_id LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
    const [count] = await pool.query<({ totalItems : number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS totalItems FROM teams t WHERE ${whereSql}`, params);
    return { rows , totalItems : Number(count[0]?.totalItems ?? 0) };
}

export async function countMemberByTeamId(teamId : number) : Promise<number>{
    const [ rows ] = await pool.query<({ TeamMember : number } & RowDataPacket)[]>(`SELECT count(tm.user_id) AS TeamMember
                                                                                    FROM team_members tm WHERE tm.team_id = ?` , teamId);
    return rows[0]!.TeamMember;
}

export async function isMemberOf(teamId : number , userId : number) :Promise<TeamMemberRow | null>{
    const [ rows ] = await pool.query<(TeamMemberRow & RowDataPacket)[]>('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?',[teamId ,userId]);
    return rows[0] ?? null;
}


export async function findTeamMemberById(teamId : number) : Promise<TeamMemberWithUserRef[]>{
    const [ rows ] = await pool.query<(TeamMemberWithUserRef & RowDataPacket)[]>(`SELECT u.user_id , u.full_name , u.profile_image_key ,
                                                                                tm.joined_at FROM team_members tm 
                                                                                JOIN users u ON tm.user_id = u.user_id WHERE team_id = ?`,
                                                                                [teamId]);
    return rows;
}


/** ทีมของผู้เล่นในแมตช์ — ดูจากรายชื่อลงแข่ง (application_players ของใบสมัคร approved) ไม่ใช่คลังทีม — OD-17 (แก้ 20 ก.ย.) */
export async function findTeamIdOfUserInMatch(userId : number , matchId : number): Promise<{teamId : number}| null>{
    const [ rows ] = await pool.query<({teamId : number} & RowDataPacket)[]>(`SELECT ta.team_id as teamId
                                                                              FROM matches m
                                                                              JOIN tournament_applications ta ON ta.tournament_id = m.tournament_id
                                                                                   AND ta.team_id IN (m.team_a_id, m.team_b_id)
                                                                                   AND ta.tournament_application_status = 'approved'
                                                                              JOIN application_players ap ON ap.tournament_application_id = ta.tournament_application_id
                                                                                   AND ap.user_id = ?
                                                                              WHERE m.match_id = ?
                                                                              LIMIT 1`,[userId , matchId])
    return rows[0] ?? null;
}

export async function deleteMember(userId : number , teamId : number): Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>('DELETE FROM team_members WHERE user_id = ? AND team_id = ?',[userId , teamId]);
    return result.affectedRows;
}


export async function updateStatus(teamId : number , status : 'Forming' | 'Ready') : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>('UPDATE teams SET readiness_status = ? , updated_at = NOW() WHERE team_id = ?',[status , teamId]);
    return result.affectedRows;
}



//Invitations
export async function findInvitationsById(invitedId : number): Promise<TeamInvitationRow|null>{
    const [ rows ] = await pool.query<(TeamInvitationRow & RowDataPacket)[]>('SELECT * FROM team_invitations WHERE team_invitation_id = ?', [invitedId]);
    return rows[0] ?? null;
}


export async function findInvitationsByIdAndTeam(teamId : number , invitedId : number) : Promise<TeamInvitationRow | null>{
    const [ rows ] = await pool.query<(TeamInvitationRow & RowDataPacket)[]>('SELECT * FROM team_invitations WHERE team_invitation_id = ? AND team_id = ?', [invitedId , teamId]);
    return rows[0] ?? null;
}



export type getInvitation = Pick<TeamInvitationRow , 'team_invitation_id' | 'team_invitation_status' | 'created_at'> &
                            Pick<UserRow , 'user_id' | 'full_name' | 'profile_image_key'>;

export async function findAllInvitationOfTeam(teamId : number) : Promise<getInvitation[]>{
    const [ rows ] = await pool.query<(getInvitation & RowDataPacket)[]>(`SELECT inv.team_invitation_id , inv.team_invitation_status , inv.created_at ,
                                                                          u.user_id , u.full_name , u.profile_image_key
                                                                          FROM users u JOIN team_invitations inv ON inv.invited_user_id = u.user_id 
                                                                          WHERE inv.team_id = ?` , [teamId]);
    return rows
}



export async function createInvitation(teamId : number , invitedUserId : number , invitedByUserId : number , expireAt : Date) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(`INSERT INTO team_invitations(team_id , invited_user_id , invited_by_user_id , team_invitation_status , expires_at)
                                                        VALUES(? , ? , ? , ? , ?)` , [teamId , invitedUserId , invitedByUserId , 'pending' , expireAt]);
    return result.insertId;
}



export async function deletePendingInvite(teamId : number , invitedId : number){
    const [ result ] = await pool.query<ResultSetHeader>(`DELETE FROM team_invitations WHERE team_id = ? AND team_invitation_id = ? AND team_invitation_status = ?`
                                                         ,[teamId , invitedId , 'pending']);
    return result.affectedRows;
};




//Team request
export async function findOfficialRequestById(requestId : number) : Promise<TeamAdminRequestRow | null>{
    const [ rows ] = await pool.query<(TeamAdminRequestRow & RowDataPacket)[]>(`SELECT * FROM team_admin_requests WHERE team_admin_request_id = ? AND request_type =?`,
                                                                                [requestId , 'official_status']);
    return rows[0] ?? null;
}


export async function findOfficialRequestByIdAndStatus(requestId : number , status : 'pending' | 'approved' | 'rejected') : Promise<TeamAdminRequestRow | null>{
    const [ rows ] = await pool.query<(TeamAdminRequestRow & RowDataPacket)[]>(`SELECT * FROM team_admin_requests WHERE team_admin_request_id = ? AND request_type =? AND team_admin_request_status = ?`,
                                                                                [requestId , 'official_status' , status]);
    return rows[0] ?? null;
}



export async function createOfficialRequest(teamId : number , userId : number , docs : string[]) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(`INSERT INTO team_admin_requests(team_id , request_type , requested_by , team_admin_request_status , supporting_docs)
                                                          VALUES(? , ? , ? , ? , ? )`,[teamId , 'official_status' , userId , 'pending', JSON.stringify(docs)]);
    return result.insertId
}


// C3 — โอนหัวหน้าทีม (T19/T20)
export async function findTransferRequestById(requestId : number) : Promise<TeamAdminRequestRow | null>{
    const [ rows ] = await pool.query<(TeamAdminRequestRow & RowDataPacket)[]>(`SELECT * FROM team_admin_requests WHERE team_admin_request_id = ? AND request_type = ?`,
                                                                                [requestId , 'leader_transfer']);
    return rows[0] ?? null;
}

export async function createTransferRequest(teamId : number , requestedBy : number , targetUserId : number) : Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(`INSERT INTO team_admin_requests(team_id , request_type , requested_by , target_user_id , team_admin_request_status)
                                                          VALUES(? , ? , ? , ? , ?)`,[teamId , 'leader_transfer' , requestedBy , targetUserId , 'pending']);
    return result.insertId;
}

export async function findOfficialMemberConflict(teamId : number , sportId : number) : Promise<OfficialMemberConflict[]>{
    const [ rows ] = await pool.query<(OfficialMemberConflict & RowDataPacket)[]>(`SELECT u.user_id , u.full_name , t2.name as conflictingTeamName
                                                          FROM team_members tm1 JOIN team_members tm2 ON tm1.user_id = tm2.user_id
                                                          JOIN teams t2 ON t2.team_id = tm2.team_id
                                                          JOIN users u ON tm1.user_id = u.user_id
                                                          WHERE tm1.team_id != tm2.team_id
                                                          AND tm1.team_id = ? AND t2.sport_type_id = ? AND t2.official_status = ?`
                                                          ,[ teamId , sportId , 'Official']);
    return rows;
}