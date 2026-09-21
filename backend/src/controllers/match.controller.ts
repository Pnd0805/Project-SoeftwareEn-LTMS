import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';
import { parsePagination } from '../utils/pagination.js';
import * as MatchService from '../services/match.service.js';
import * as BracketService from '../services/bracket.service.js';

function parseOptionalString(raw: unknown): string | undefined {
    return typeof raw === 'string' && raw !== '' ? raw : undefined;
}

function parseOptionalNumber(raw: unknown): number | undefined {
    const value = parseOptionalString(raw);
    if (value === undefined) return undefined;
    const num = Number(value);
    return Number.isInteger(num) ? num : undefined;
}

export async function createBracket(req: Request, res: Response) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    const result = await BracketService.createBracket(
        tournamentId,
        req.body.seedingMethod,
        req.body.manualSeeds,
        req.body.replace === true
    );
    res.status(201).json(result);
}

export async function getBracket(req: Request, res: Response) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await BracketService.getBracket(tournamentId));
}

export async function getTournamentMatches(req: Request, res: Response) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    const { newpage, newpageSize, offset } = parsePagination(req.query['page'], req.query['pageSize']);

    const filters = {
        teamId: parseOptionalNumber(req.query['teamId']),
        status: parseOptionalString(req.query['status']),
        round: parseOptionalNumber(req.query['round']),
    };

    const result = await MatchService.getTournamentMatches(tournamentId, filters, newpage, newpageSize, offset);
    res.status(200).json(result);
}

export async function getMatchDetail(req: Request, res: Response) {
    const match_id = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.getMatchDetail(match_id, req.user?.user_id));
}

export async function setRoomCode(req: Request, res: Response) {
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.setRoomCode(matchId, req.user!.user_id, req.body.roomCode));
}

export async function listMyMatches(req: Request, res: Response) {
    const role = req.query['role'] === 'player' || req.query['role'] === 'referee' ? req.query['role'] : undefined;
    res.status(200).json(await MatchService.listMyMatches(req.user!.user_id, { role }));
}

export async function scheduleMatch(req: Request, res: Response) {
    const matchId = parseId(req.params['id'], 'รหัสการแข่งขัน');
    const result = await MatchService.scheduleMatch(matchId, req.body);
    res.status(200).json(result);
}

export async function openCheckinMatch(req: Request, res: Response){
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.openCheckinMatch(matchId));
}

export async function closeCheckinMatch(req: Request, res: Response){
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.closeCheckinMatch(matchId));
}

export async function forfeitMatch(req: Request, res: Response){
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.forfeitMatch(matchId, req.user!.user_id));
}

export async function getMyCheckin(req: Request, res: Response){
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.getMyCheckin(matchId, req.user!.user_id));
}

export async function manualCheckin(req: Request, res: Response){
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(201).json(await MatchService.manualCheckin(matchId, req.user!.user_id, req.body));
}

export async function startMatch(req: Request, res: Response){
    if(!req.user){
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.startMatch(matchId, req.user.user_id));
}

export async function getMatchLineups(req: Request, res: Response){
    const matchId = parseId(req.params['id'], 'รหัสการเเข่งขัน');
    res.status(200).json(await MatchService.getMatchLineups(matchId));
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