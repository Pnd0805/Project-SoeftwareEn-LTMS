import pool from '../config/db.js';
import type { SportTypeRow } from '../types/db.js'; 
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function createAcceptInvite(invitedId : number , teamId : number , userId : number) : Promise<number>{
    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();

        await conn.query<ResultSetHeader>(`UPDATE team_invitations SET team_invitation_status = ? , responded_at = NOW()
                                           WHERE team_invitation_id = ? AND expires_at > NOW() AND team_invitation_status = ?`
                                           ,['accepted' , invitedId , 'pending']);

        const [result] = await conn.query<ResultSetHeader>('INSERT INTO team_members(team_id , user_id) VALUES( ? , ? )',[teamId , userId]);
        
        const [count] = await conn.query<({memberCount : number} & RowDataPacket)[]>('SELECT count(*) as memberCount FROM team_members WHERE team_id = ?',
                                                                                [teamId]);
        const [ minMember ] = await conn.query<(Pick<SportTypeRow , 'min_members'> & RowDataPacket)[]>(`SELECT s.min_members
                                                                                                        FROM sport_types s JOIN teams t ON t.sport_type_id = s.sport_type_id
                                                                                                        WHERE t.team_id = ? AND t.deleted_at IS NULL` , [teamId]);
        
        if(count[0]!.memberCount >= minMember[0]!.min_members){
            await conn.query<ResultSetHeader>('UPDATE teams SET readiness_status = ? , updated_at = NOW() WHERE team_id = ?',['Ready' , teamId]);
        }

        await conn.commit();
        return result.insertId
    }catch(err){
        await conn.rollback();
        throw err;

    }finally{
        conn.release();
    }
}

export async function createRejectInvite(invitedId : number , userId : number) :Promise<number>{
    const [ result ] = await pool.query<ResultSetHeader>(`UPDATE team_invitations SET team_invitation_status = ? , responded_at = NOW()
                                                          WHERE team_invitation_id = ? AND invited_user_id = ?`, ['rejected' , invitedId , userId]);
    return result.affectedRows;
}
