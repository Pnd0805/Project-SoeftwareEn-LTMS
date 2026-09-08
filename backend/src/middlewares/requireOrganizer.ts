import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { findTournamentById } from '../repositories/tournament.repo.js';
import { parseId } from '../utils/parseId.js';

export async function requireOrganizer(req: Request, res: Response, next: NextFunction) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    const tournament = await findTournamentById(tournamentId);

    if (!tournament) {
        return next(new AppError(404 , "TOURNAMENT_NOT_FOUND" , "ไม่พบทัวร์นาเมนต์นี้"));
    }

    const isOwner = tournament.requested_by_user_id === req.user?.user_id;
    const isValidStatus = tournament.tournament_status !== 'pending_approval' && tournament.tournament_status !== 'rejected';

    if (!isOwner || !isValidStatus) {
        return next(new AppError(403, "NOT_ORGANIZER", "คุณไม่ใช่ผู้จัดการแข่งขันของทัวร์นาเมนต์นี้"));
    }

    next();
}