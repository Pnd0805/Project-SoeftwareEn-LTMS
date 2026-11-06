import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import { parsePagination } from '../utils/pagination.js';
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
    const { isNew, ...result } = await PickemService.predict(matchId, userId, req.body.scoreData);
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

/** E29 — แต้ม + อันดับของตัวเองในทัวร์นี้ */
export async function getMyTournamentPickem(req: Request, res: Response) {
    res.status(200).json(await PickemService.getMyStanding(
        parseId(req.params['id'], 'รหัสทัวร์นาเมนต์'), req.user!.user_id));
}

/**
 * E28 — ตารางอันดับ pick'em
 * 🔴 B3 ② (8 ต.ค. 2569) — แบ่งหน้าแล้ว ค่าตั้งต้น 20 คน (เพดาน 100 ตาม `parsePagination`)
 *   เดิมคืนทุกคน = 477 KB ต่อคำขอที่ 4,000 คน
 */
export async function getPickemLeaderboard(req: Request, res: Response) {
    const { newpage , newpageSize , offset } = parsePagination(req.query['page'] , req.query['pageSize']);
    res.status(200).json(await PickemService.getLeaderboard(
        parseId(req.params['id'], 'รหัสทัวร์นาเมนต์') , offset , newpage , newpageSize));
}
