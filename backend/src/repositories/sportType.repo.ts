import pool from '../config/db.js'; 
import type { SportTypeRow , SportStatDefinitionRow } from '../types/db.js';
import type { RowDataPacket } from 'mysql2';

export async function findAllSportTypes() : Promise<SportTypeRow[]>{
    const [ rows ] = await pool.query<(SportTypeRow & RowDataPacket)[]>('SELECT * FROM sport_types ORDER BY sport_type_id');
    return rows;
};

export async function findSportTypeById(sportTypeId : number) : Promise<SportTypeRow | null>{
    const [rows] = await pool.query<(SportTypeRow & RowDataPacket)[]>('SELECT * FROM sport_types WHERE sport_type_id = ?',[sportTypeId]);
    const sport = rows[0];
    return sport ?? null;
};

export async function findStatDefinitionsBySportType(sportTypeId : number) : Promise<SportStatDefinitionRow[]>{
    const [ rows ] = await pool.query<(SportStatDefinitionRow & RowDataPacket)[]>('SELECT * FROM sport_stat_definitions WHERE sport_type_id = ? ORDER BY display_order',[sportTypeId]); 
    return rows;
}