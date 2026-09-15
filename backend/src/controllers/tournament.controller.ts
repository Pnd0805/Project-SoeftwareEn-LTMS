import type { Request, Response } from 'express';
import * as TournamentService from '../services/tournament.service.js';
import { parseId } from '../utils/parseId.js';
import { parsePagination } from '../utils/pagination.js';
import { AppError } from '../utils/AppError.js';

function userId(req: Request): number {
    if (!req.user) throw new AppError(401, 'NO_TOKEN', 'กรุณาเข้าสู่ระบบก่อนใช้งาน');
    return req.user.user_id;
}

function optionalPositiveInt(value: unknown, field: string): number | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1) {
        throw new AppError(400, 'VALIDATION_FAILED', 'พารามิเตอร์ไม่ถูกต้อง', { fields: { [field]: 'ต้องเป็นจำนวนเต็มบวก' } });
    }
    return Number(value);
}

function optionalQuery(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export async function createTournament(req: Request, res: Response) {
    res.status(201).json(await TournamentService.createTournament(req.body, userId(req)));
}

export async function getMyTournamentRequests(req: Request, res: Response) {
    const { newpage, newpageSize, offset } = parsePagination(req.query['page'], req.query['pageSize']);
    res.status(200).json(await TournamentService.getMyTournamentRequests(userId(req), offset, newpage, newpageSize));
}

export async function getPendingTournamentRequests(req: Request, res: Response) {
    const { newpage, newpageSize, offset } = parsePagination(req.query['page'], req.query['pageSize']);
    res.status(200).json(await TournamentService.getPendingTournamentRequests(userId(req), offset, newpage, newpageSize));
}

export async function getPendingAmendments(req: Request, res: Response) {
    const { newpage, newpageSize, offset } = parsePagination(req.query['page'], req.query['pageSize']);
    res.status(200).json(await TournamentService.getPendingAmendments(userId(req), offset, newpage, newpageSize));
}

export async function approveTournament(req: Request, res: Response) {
    const id = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await TournamentService.approveTournament(id, userId(req)));
}

export async function rejectTournament(req: Request, res: Response) {
    const id = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) throw new AppError(400, 'TOURNAMENT_REJECT_REASON_REQUIRED', 'กรุณาระบุเหตุผลที่ปฏิเสธคำขอ');
    res.status(200).json(await TournamentService.rejectTournament(id, userId(req), reason));
}

export async function getPublicTournaments(req: Request, res: Response) {
    const { newpage, newpageSize, offset } = parsePagination(req.query['page'], req.query['pageSize']);
    const filters = {
        sportTypeId: optionalPositiveInt(req.query['sportTypeId'], 'sportTypeId'),
        facultyId: optionalPositiveInt(req.query['facultyId'], 'facultyId'),
        query: optionalQuery(req.query['q'])
    };
    res.status(200).json(await TournamentService.getPublicTournaments(filters, offset, newpage, newpageSize));
}

export async function getTournament(req: Request, res: Response) {
    const id = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await TournamentService.getTournament(id, req.user?.user_id));
}

export async function updateTournament(req: Request, res: Response) {
    const id = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await TournamentService.updateTournament(id, userId(req), req.body));
}

export async function requestAmendment(req: Request, res: Response) {
    const id = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(201).json(await TournamentService.requestAmendment(id, userId(req), req.body));
}

export async function publishTournament(req: Request, res: Response) {
    res.status(200).json(await TournamentService.publishTournament(req.tournament!, userId(req)));
}

export async function unpublishTournament(req: Request, res: Response) {
    res.status(200).json(await TournamentService.unpublishTournament(req.tournament!, userId(req)));
}

export async function openRegistration(req: Request, res: Response) {
    res.status(200).json(await TournamentService.openRegistration(req.tournament!, userId(req)));
}

export async function closeRegistration(req: Request, res: Response) {
    res.status(200).json(await TournamentService.closeRegistration(req.tournament!, userId(req)));
}

export async function getEligibilityRules(req: Request, res: Response) {
    const id = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await TournamentService.getEligibilityRules(id, req.user?.user_id));
}
