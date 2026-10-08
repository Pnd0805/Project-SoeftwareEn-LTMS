import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export type FollowUserRow = {
    user_id: number;
    full_name: string;
    profile_image_key: string | null;
    followed_at: Date;
};

export async function followUser(followerUserId: number, followedUserId: number): Promise<void> {
    await pool.query<ResultSetHeader>(
        `INSERT IGNORE INTO follows (follower_user_id, followed_user_id) VALUES (?, ?)`,
        [followerUserId, followedUserId]
    );
}

export async function unfollowUser(followerUserId: number, followedUserId: number): Promise<void> {
    await pool.query<ResultSetHeader>(
        `DELETE FROM follows WHERE follower_user_id = ? AND followed_user_id = ?`,
        [followerUserId, followedUserId]
    );
}

export async function isFollowing(followerUserId: number, followedUserId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM follows WHERE follower_user_id = ? AND followed_user_id = ? LIMIT 1`,
        [followerUserId, followedUserId]
    );
    return rows.length > 0;
}

export async function countFollowers(userId: number): Promise<number> {
    const [rows] = await pool.query<({ count: number } & RowDataPacket)[]>(
        `SELECT COUNT(*) AS count FROM follows WHERE followed_user_id = ?`,
        [userId]
    );
    return Number(rows[0]?.count ?? 0);
}

export async function findFollowers(userId: number): Promise<FollowUserRow[]> {
    const [rows] = await pool.query<(FollowUserRow & RowDataPacket)[]>(
        `SELECT u.user_id, u.full_name, u.profile_image_key, f.created_at AS followed_at
         FROM follows f
         JOIN users u ON u.user_id = f.follower_user_id
         WHERE f.followed_user_id = ?
         ORDER BY f.created_at DESC, f.follow_id DESC`,
        [userId]
    );
    return rows;
}

export async function findFollowing(userId: number): Promise<FollowUserRow[]> {
    const [rows] = await pool.query<(FollowUserRow & RowDataPacket)[]>(
        `SELECT u.user_id, u.full_name, u.profile_image_key, f.created_at AS followed_at
         FROM follows f
         JOIN users u ON u.user_id = f.followed_user_id
         WHERE f.follower_user_id = ?
         ORDER BY f.created_at DESC, f.follow_id DESC`,
        [userId]
    );
    return rows;
}
