import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';
import * as MatchService from '../services/match.service.js';

export async function getTournamentMatches(req: Request, res: Response) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await MatchService.getTournamentMatches(tournamentId));
}

export async function getMatchDetail(req: Request, res: Response) {
    const match_id = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.getMatchDetail(match_id));
}

export async function scheduleMatch(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const matchId = parseId(req.params['id'], 'รหัสการแข่งขัน');
    const result = await MatchService.scheduleMatch(matchId, req.user.user_id, req.body.scheduledTime, req.body.venue);
    res.status(200).json(result);
}

export async function openCheckinMatch(req: Request, res: Response){
    if(!req.user){
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.openCheckinMatch(matchId, req.user.user_id));
}