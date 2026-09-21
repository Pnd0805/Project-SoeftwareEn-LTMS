import * as FollowRepo from '../repositories/follow.repo.js';
import type { FollowTarget } from '../repositories/follow.repo.js';
import * as ProfileRepo from '../repositories/profile.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import { toCareerItemDto, toFollowerDto, toFollowingTeamDto } from '../mappers/follow.mapper.js';
import { AppError } from '../utils/AppError.js';
import { checkUser } from '../utils/checkExist.js';
import { buildPagination } from '../utils/pagination.js';

/**
 * C8 — Follows + career + ตัวเลขรวมในโปรไฟล์ (มติทีม 21 ก.ย. 2569 · OD-24)
 *   1. ติดตามได้ทั้งผู้เล่นและทีม (migration 024)
 *   2. ติดตาม = นับ + รายการเท่านั้น (ยังไม่มีแจ้งเตือน)
 *   3. career เป็นสาธารณะ
 *   4. แต้ม Pick'em ส่งจาก users.total_points (0 จนกว่า C7 จะทำ)
 */

async function assertTarget(target: FollowTarget): Promise<void> {
    if (target.kind === 'user') {
        await checkUser(target.id);
        return;
    }
    const team = await TeamRepo.findById(target.id);
    if (!team || team.deleted_at !== null) {
        throw new AppError(404, 'TEAM_NOT_FOUND', 'ไม่พบทีมนี้ในระบบ');
    }
}

/** กดติดตาม — กดซ้ำได้ผลเดิม (idempotent) · ติดตามตัวเองไม่ได้ */
export async function follow(followerId: number, target: FollowTarget) {
    if (target.kind === 'user' && target.id === followerId) {
        throw new AppError(400, 'CANNOT_FOLLOW_SELF', 'ติดตามตัวเองไม่ได้');
    }
    await assertTarget(target);
    await FollowRepo.follow(followerId, target);
    return { following: true, followerCount: await FollowRepo.countFollowers(target) };
}

/** เลิกติดตาม — ไม่ได้ติดตามอยู่ก็ตอบผลเดิม (idempotent) */
export async function unfollow(followerId: number, target: FollowTarget) {
    await assertTarget(target);
    await FollowRepo.unfollow(followerId, target);
    return { following: false, followerCount: await FollowRepo.countFollowers(target) };
}

/** คนที่ติดตามผู้ใช้/ทีมนี้ + isFollowing ของคนที่ดูอยู่ (ถ้าล็อกอิน) */
export async function getFollowers(target: FollowTarget, viewerId: number | undefined, page: number, pageSize: number, offset: number) {
    await assertTarget(target);
    const total = await FollowRepo.countFollowers(target);
    const rows = await FollowRepo.findFollowers(target, offset, pageSize);
    return {
        total,
        isFollowing: viewerId === undefined ? false : await FollowRepo.isFollowing(viewerId, target),
        items: rows.map(toFollowerDto),
        pagination: buildPagination(page, pageSize, total),
    };
}

/** ผู้ใช้และทีมที่คนนี้ติดตาม (ใช้ทั้ง GET /users/:id/following และ GET /me/following) */
export async function getFollowing(userId: number) {
    await checkUser(userId);
    const [users, teams] = await Promise.all([FollowRepo.findFollowingUsers(userId), FollowRepo.findFollowingTeams(userId)]);
    return { users: users.map(toFollowerDto), teams: teams.map(toFollowingTeamDto) };
}

export async function getCareer(userId: number) {
    await checkUser(userId);
    return { items: (await ProfileRepo.findCareer(userId)).map(toCareerItemDto) };
}

/** ตัวเลขที่ต่อท้ายโปรไฟล์ — ใช้ใน GET /users/:id และ GET /users/:id/stats */
export async function getProfileCounts(userId: number, viewerId?: number) {
    const target: FollowTarget = { kind: 'user', id: userId };
    const [followerCount, followingCount, isFollowing] = await Promise.all([
        FollowRepo.countFollowers(target),
        FollowRepo.countFollowing(userId),
        viewerId === undefined || viewerId === userId ? Promise.resolve(false) : FollowRepo.isFollowing(viewerId, target),
    ]);
    return { followerCount, followingCount, isFollowing };
}

export async function getMvpVotesReceived(userId: number): Promise<number> {
    return ProfileRepo.countMvpVotesReceived(userId);
}
