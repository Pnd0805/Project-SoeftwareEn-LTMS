import pool from "../config/db.js";
import type { TeamRow } from "../types/db.js";
import type { RowDataPacket } from "mysql2";

export async function findTeamsByUser(userId : number) : Promise<Pick<TeamRow , 'team_id' | 'name' | 'sport_type_id'>[]>{
    const [rows] = await pool.query<(TeamRow & RowDataPacket)[]>(`SELECT t.team_id , t.name , t.sport_type_id FROM teams t JOIN team_members tm
                                                                ON t.team_id = tm.team_id WHERE tm.user_id = ? AND t.deleted_at is NULL`, [userId]);
    return rows;
}