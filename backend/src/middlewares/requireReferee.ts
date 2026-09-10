import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { findMatchById } from '../repositories/match.repo.js';
import { findLatestTournamentReferee } from '../repositories/referee.repo.js';
import { parseId } from '../utils/parseId.js';

export async function requireReferee(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        return next(new AppError(401, "NO_TOKEN", "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
    }

    const matchId = parseId(req.params['id'], 'รหัสการแข่งขัน');
    const match = await findMatchById(matchId);

    if (!match) {
        return next(new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้"));
    }

    const referee = await findLatestTournamentReferee(match.tournament_id, req.user.user_id);

    const isAccepted = referee !== null 
        && referee.invitation_status === 'accepted'
        && (referee.is_external === 0 || referee.external_approval_status === 'approved');

    if (!isAccepted) {
        return next(new AppError(403, "NOT_REFEREE", "คุณไม่ได้เป็นกรรมการของแมตช์นี้"));
    }

    next();
}