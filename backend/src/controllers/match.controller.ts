import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';
import * as MatchService from '../services/match.service.js';
import * as BracketService from '../services/bracket.service.js';

export async function createBracket(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    const result = await BracketService.createBracket(
        tournamentId,
        req.user.user_id,
        req.body.seedingMethod,
        req.body.manualSeeds
    );
    res.status(201).json(result);
}

export async function getBracket(req: Request, res: Response) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await BracketService.getBracket(tournamentId));
}

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

export async function startMatch(req: Request, res: Response){
    if(!req.user){
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.startMatch(matchId, req.user.user_id));
}

export async function getMatchCheckins(req: Request, res: Response){
    if(!req.user){
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.getMatchCheckins(matchId, req.user.user_id));
}

export async function verifyCheckin(req: Request, res: Response){
    if(!req.user){
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const checkinId = parseId(req.params['cid'], 'รหัสการเช็คอิน');
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.verifyCheckin(checkinId, matchId , req.user.user_id));
}

export async function rejectCheckin(req: Request, res: Response){
    if(!req.user){
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const checkinId = parseId(req.params['cid'], 'รหัสการเช็คอิน');
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.rejectCheckin(checkinId, matchId, req.user.user_id, req.body.reason));
}

export async function getCheckinQr(req: Request, res: Response){
    if(!req.user){
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.getCheckinQr(matchId, req.user.user_id));
}

export async function submitCheckin(req: Request, res: Response){
    if(!req.user){
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    const { isNew, data } = await MatchService.submitCheckin(matchId, req.user.user_id, req.body);
    res.status(isNew ? 201 : 200).json(data);
}