import pool from '../config/db.js';
import type { RowDataPacket } from 'mysql2';

import type { PlayerMatchStatRow, PlayerProfileStatRow , SportTypeRow } from '../types/db.js';

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


export type UserProfileTotalsRow = {
    mvp_votes: number;
    pickem_points: number;
    follower_count: number;
};

export async function findProfileTotals(userId: number): Promise<UserProfileTotalsRow> {
    const [rows] = await pool.query<(UserProfileTotalsRow & RowDataPacket)[]>(
        `SELECT
            u.total_points AS pickem_points,
            (SELECT COUNT(*) FROM tournament_feedback tf
             WHERE tf.voted_for_user_id = u.user_id
               AND tf.feedback_type = 'mvp_vote'
               AND tf.removed_at IS NULL) AS mvp_votes,
            (SELECT COUNT(*) FROM follows f
             WHERE f.followed_user_id = u.user_id) AS follower_count
         FROM users u
         WHERE u.user_id = ?`,
        [userId]
    );
    return rows[0] ?? { mvp_votes: 0, pickem_points: 0, follower_count: 0 };
}


export async function findPlayerMatchStatByMatchAndUserId(matchId : number , userId : number) : Promise<PlayerMatchStatRow | null>{
    const [ rows ] = await pool.query<(PlayerMatchStatRow & RowDataPacket)[]>(`SELECT * FROM player_match_stats WHERE match_id = ? AND user_id = ?`,[matchId , userId]);
    return rows[0] ?? null;
}