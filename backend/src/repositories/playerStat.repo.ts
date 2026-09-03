import pool from '../config/db.js';
import type { RowDataPacket } from 'mysql2';

import type { PlayerProfileStatRow , SportTypeRow } from '../types/db.js';

export type UserSportStatRow =
    Pick<PlayerProfileStatRow , 'sport_type_id' | 'matches_played' | 'wins' | 'losses' | 'championships'> 
    & { sport_name : SportTypeRow['name']};

export async function findStatsByUser(userId : number) : Promise<UserSportStatRow[]>{
    const [rows] = await pool.query<(UserSportStatRow & RowDataPacket)[]>(`SELECT 
        s.sport_type_id , s.matches_played , s.wins , s.losses , s.championships , st.name AS sport_name 
        FROM player_profile_stats s 
        JOIN sport_types st
        ON s.sport_type_id = st.sport_type_id
        WHERE s.user_id = ? ORDER BY st.sport_type_id` , [userId]);

    return rows;
}
