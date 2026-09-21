import pool from '../config/db.js';
import type { RowDataPacket } from 'mysql2';

// C8 — follows (migration 024): แถวหนึ่งชี้ผู้ใช้ (followed_user_id) หรือทีม (followed_team_id) อย่างใดอย่างหนึ่ง
export type FollowTarget = { kind: 'user'; id: number } | { kind: 'team'; id: number };

const col = (t: FollowTarget) => (t.kind === 'user' ? 'followed_user_id' : 'followed_team_id');

/** กดซ้ำไม่ error (INSERT IGNORE ชน UNIQUE เดิม) */
export async function follow(followerId: number, target: FollowTarget): Promise<void> {
    await pool.query(
        `INSERT IGNORE INTO follows (follower_user_id, ${col(target)}) VALUES (?, ?)`,
        [followerId, target.id]
    );
}

/** เลิกติดตามที่ไม่ได้ติดตามอยู่ = ไม่มีอะไรเกิดขึ้น */
export async function unfollow(followerId: number, target: FollowTarget): Promise<void> {
    await pool.query(
        `DELETE FROM follows WHERE follower_user_id = ? AND ${col(target)} = ?`,
        [followerId, target.id]
    );
}

export async function isFollowing(followerId: number, target: FollowTarget): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM follows WHERE follower_user_id = ? AND ${col(target)} = ? LIMIT 1`,
        [followerId, target.id]
    );
    return rows.length > 0;
}

export async function countFollowers(target: FollowTarget): Promise<number> {
    const [rows] = await pool.query<({ cnt: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS cnt FROM follows WHERE ${col(target)} = ?`,
        [target.id]
    );
    return Number(rows[0]?.cnt ?? 0);
}

/** จำนวนที่คนนี้ติดตามอยู่ (นับทั้งผู้ใช้และทีมที่ยังไม่ถูกลบ) */
export async function countFollowing(userId: number): Promise<number> {
    const [rows] = await pool.query<({ cnt: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS cnt FROM follows f
         LEFT JOIN teams t ON t.team_id = f.followed_team_id
         WHERE f.follower_user_id = ? AND (f.followed_team_id IS NULL OR t.deleted_at IS NULL)`,
        [userId]
    );
    return Number(rows[0]?.cnt ?? 0);
}

export type FollowerRow = { user_id: number; full_name: string; profile_image_key: string | null; followed_at: Date };

/** คนที่ติดตามผู้ใช้/ทีมนี้ — ใหม่สุดก่อน */
export async function findFollowers(target: FollowTarget, offset: number, pageSize: number): Promise<FollowerRow[]> {
    const [rows] = await pool.query<(FollowerRow & RowDataPacket)[]>(
        `SELECT u.user_id, u.full_name, u.profile_image_key, f.created_at AS followed_at
         FROM follows f JOIN users u ON u.user_id = f.follower_user_id
         WHERE f.${col(target)} = ?
         ORDER BY f.created_at DESC, f.follow_id DESC
         LIMIT ? OFFSET ?`,
        [target.id, pageSize, offset]
    );
    return rows;
}

export type FollowingUserRow = { user_id: number; full_name: string; profile_image_key: string | null; followed_at: Date };
export type FollowingTeamRow = { team_id: number; name: string; sport_type_id: number; followed_at: Date };

/** ผู้ใช้ที่คนนี้ติดตาม */
export async function findFollowingUsers(userId: number): Promise<FollowingUserRow[]> {
    const [rows] = await pool.query<(FollowingUserRow & RowDataPacket)[]>(
        `SELECT u.user_id, u.full_name, u.profile_image_key, f.created_at AS followed_at
         FROM follows f JOIN users u ON u.user_id = f.followed_user_id
         WHERE f.follower_user_id = ?
         ORDER BY f.created_at DESC, f.follow_id DESC`,
        [userId]
    );
    return rows;
}

/** ทีมที่คนนี้ติดตาม — ไม่แสดงทีมที่ถูกลบแล้ว */
export async function findFollowingTeams(userId: number): Promise<FollowingTeamRow[]> {
    const [rows] = await pool.query<(FollowingTeamRow & RowDataPacket)[]>(
        `SELECT t.team_id, t.name, t.sport_type_id, f.created_at AS followed_at
         FROM follows f JOIN teams t ON t.team_id = f.followed_team_id
         WHERE f.follower_user_id = ? AND t.deleted_at IS NULL
         ORDER BY f.created_at DESC, f.follow_id DESC`,
        [userId]
    );
    return rows;
}
