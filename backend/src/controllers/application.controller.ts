import type { Request, Response } from 'express';
import * as ApplicationService from '../services/application.service.js';
import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';

export async function getTournamentTeams(req: Request, res: Response) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await ApplicationService.getApprovedTeams(tournamentId));
}

export async function getMyappication(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    res.status(200).json(await ApplicationService.getMyappication(req.user.user_id));
}

export async function getTournamentApplications(req: Request, res: Response) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await ApplicationService.getTournamentApplications(tournamentId));
}

export async function getApplicationDetail(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const applicationId = parseId(req.params['id'], 'รหัสใบสมัคร');
    res.status(200).json(await ApplicationService.getApplicationDetail(applicationId, req.user.user_id));
}

export async function cancelApplication(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const applicationId = parseId(req.params['id'], 'รหัสใบสมัคร');
    res.status(200).json(await ApplicationService.cancelApplication(applicationId, req.user.user_id));
}

export async function withdrawApplication(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const applicationId = parseId(req.params['id'], 'รหัสใบสมัคร');
    res.status(200).json(await ApplicationService.withdrawApplication(applicationId, req.user.user_id));
}

export async function approveApplication(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const applicationId = parseId(req.params['id'], 'รหัสใบสมัคร');
    res.status(200).json(await ApplicationService.approveApplication(applicationId, req.user.user_id));
}
    
export async function rejectApplication(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const applicationId = parseId(req.params['id'], 'รหัสใบสมัคร');
    res.status(200).json(await ApplicationService.rejectApplication(applicationId, req.user.user_id , req.body.reason));
}

export async function applyTournament(req: Request, res: Response) {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    const result = await ApplicationService.applyTournament(tournamentId, req.body.teamId, req.user.user_id);
    res.status(201).json(result);
}