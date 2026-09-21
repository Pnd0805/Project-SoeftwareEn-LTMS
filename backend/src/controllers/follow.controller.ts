import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';
import { parsePagination } from '../utils/pagination.js';
import * as FollowService from '../services/follow.service.js';
import type { FollowTarget } from '../repositories/follow.repo.js';

function requireUserId(req: Request): number {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    return req.user.user_id;
}

const userTarget = (req: Request): FollowTarget => ({ kind: 'user', id: parseId(req.params['id'], 'รหัสผู้ใช้') });
const teamTarget = (req: Request): FollowTarget => ({ kind: 'team', id: parseId(req.params['id'], 'รหัสทีม') });

export async function followUser(req: Request, res: Response) {
    const followerId = requireUserId(req);
    res.status(200).json(await FollowService.follow(followerId, userTarget(req)));
}
export async function unfollowUser(req: Request, res: Response) {
    const followerId = requireUserId(req);
    res.status(200).json(await FollowService.unfollow(followerId, userTarget(req)));
}
export async function followTeam(req: Request, res: Response) {
    const followerId = requireUserId(req);
    res.status(200).json(await FollowService.follow(followerId, teamTarget(req)));
}
export async function unfollowTeam(req: Request, res: Response) {
    const followerId = requireUserId(req);
    res.status(200).json(await FollowService.unfollow(followerId, teamTarget(req)));
}

async function followers(req: Request, res: Response, target: FollowTarget) {
    const { newpage, newpageSize, offset } = parsePagination(req.query['page'], req.query['pageSize']);
    res.status(200).json(await FollowService.getFollowers(target, req.user?.user_id, newpage, newpageSize, offset));
}
export async function getUserFollowers(req: Request, res: Response) { await followers(req, res, userTarget(req)); }
export async function getTeamFollowers(req: Request, res: Response) { await followers(req, res, teamTarget(req)); }

export async function getUserFollowing(req: Request, res: Response) {
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await FollowService.getFollowing(userId));
}
export async function getMyFollowing(req: Request, res: Response) {
    res.status(200).json(await FollowService.getFollowing(requireUserId(req)));
}

export async function getUserCareer(req: Request, res: Response) {
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await FollowService.getCareer(userId));
}
