import type { Request, Response } from 'express';
import * as TournamentService from '../services/tournament.service.js';
import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';

function userId(req: Request): number {
    if (!req.user) throw new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน');
    return req.user.user_id;
}

export async function approve(req: Request, res: Response) {
    const id = parseId(req.params['id'], 'รหัสคำขอแก้ไข');
    res.status(200).json(await TournamentService.approveAmendment(id, userId(req)));
}

export async function reject(req: Request, res: Response) {
    const id = parseId(req.params['id'], 'รหัสคำขอแก้ไข');
    res.status(200).json(await TournamentService.rejectAmendment(id, userId(req), req.body.reason));
}
