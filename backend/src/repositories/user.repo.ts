import pool from "../config/db.js";
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

export async function searchByName(userName : string) : Promise<Pick<UserRow , 'user_id' | 'full_name' | 'profile_image_key'>[]>{
    const [ rows ] = await pool.query<(UserRow & RowDataPacket)[]>(`SELECT user_id , full_name , profile_image_key FROM users
                                                                    WHERE full_name LIKE ? AND is_suspended = 0
                                                                    ORDER BY full_name LIMIT 20` , [`%${userName}%`]);
    return rows;
}; 

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

    sets.push('updated_at = NOW()');

    const [ result ] = await pool.query<ResultSetHeader>(`UPDATE users SET ${sets.join(', ')} WHERE user_id = ?`
                                                        ,[ ...values , userId]);

    return result.affectedRows;
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