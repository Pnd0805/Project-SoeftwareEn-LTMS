import pool from "../config/db.js";
import type { TeamDto, TeamMemberWithUserRef } from "../mappers/team.mapper.js";
import type { TeamInput , updateTeamInput} from "../schemas/team.schema.js";
import type { TeamRow ,TeamMemberRow, TeamInvitationRow , UserRow} from "../types/db.js";
import type { RowDataPacket , ResultSetHeader } from "mysql2";


export async function findById(teamId : number) : Promise<TeamRow | null> {
    const [ rows ] = await pool.query<(TeamRow & RowDataPacket)[]>('SELECT * FROM teams WHERE team_id=?',[teamId]);
    const team = rows[0];
    return team ?? null;
}

export async function findTeamsByUser(userId : number) : Promise<TeamRow[]>{
    const [rows] = await pool.query<(TeamRow & RowDataPacket)[]>(`SELECT t.* FROM teams t JOIN team_members tm
                                                                ON t.team_id = tm.team_id WHERE tm.user_id = ?`, [userId]);
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

    sets.push('updated_at = NOW()');

    const [ result ] = await pool.query<ResultSetHeader>(`UPDATE teams SET ${sets.join(', ')} WHERE team_id = ?`,[...values , teamId]);
    return result.affectedRows;
}


export async function deleteTeam(teamId : number){
    const [ result ] = await pool.query<ResultSetHeader>('UPDATE teams SET deleted_at = NOW() , deleted_reason = ? WHERE team_id = ? AND deleted_at IS NULL' , ["leader_deleted" , teamId]);
    return result.affectedRows;
}



//--- Member
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
                                                                                tm.position , tm.joined_at FROM team_members tm 
                                                                                JOIN users u ON tm.user_id = u.user_id WHERE team_id = ?`,
                                                                                [teamId]);
    return rows;
}

export async function updateMember(userId : number , teamId : number, position : 'starter' | 'substitute'): Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>('UPDATE team_members SET position = ? WHERE user_id = ? AND team_id = ?' ,[position , userId , teamId]);
    return result.affectedRows;
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