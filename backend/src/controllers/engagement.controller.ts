import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';
import * as PickemService from '../services/pickem.service.js';

function requireUserId(req: Request): number {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    return req.user.user_id;
}

// ───────── C7 Pick'em ─────────

export async function predict(req: Request, res: Response) {
    const userId = requireUserId(req);
    const matchId = parseId(req.params['id'], 'รหัสการแข่งขัน');
    const { isNew, ...result } = await PickemService.predict(matchId, userId, req.body.teamId);
    res.status(isNew ? 201 : 200).json(result);
}

export async function cancelPrediction(req: Request, res: Response) {
    const userId = requireUserId(req);
    await PickemService.cancelPrediction(parseId(req.params['id'], 'รหัสการแข่งขัน'), userId);
    res.status(204).send();
}

export async function getMyPrediction(req: Request, res: Response) {
    const userId = requireUserId(req);
    res.status(200).json(await PickemService.getMine(parseId(req.params['id'], 'รหัสการแข่งขัน'), userId));
}

export async function getPredictionSummary(req: Request, res: Response) {
    const matchId = parseId(req.params['id'], 'รหัสการแข่งขัน');
    res.status(200).json(await PickemService.getSummary(matchId, req.user?.user_id));
}

export async function getMyPickem(req: Request, res: Response) {
    res.status(200).json(await PickemService.getMyHistory(requireUserId(req)));
}

export async function getPickemLeaderboard(req: Request, res: Response) {
    res.status(200).json(await PickemService.getLeaderboard(parseId(req.params['id'], 'รหัสทัวร์นาเมนต์')));
}
