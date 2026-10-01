import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import * as RewardService from '../services/reward.service.js';

export async function listRewards(_req: Request, res: Response) {
    res.status(200).json(await RewardService.listRewards());
}

export async function listPublicUserRewards(req: Request, res: Response) {
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await RewardService.listPublicUserRewards(userId));
}

export async function listMyRewards(req: Request, res: Response) {
    res.status(200).json(await RewardService.listMyRewards(req.user!.user_id));
}

export async function setMyRewardDisplayed(req: Request, res: Response) {
    const rewardId = parseId(req.params['id'], 'รหัสรางวัล');
    res.status(200).json(await RewardService.setMyRewardDisplayed(req.user!.user_id, rewardId, req.body.isDisplayed));
}
