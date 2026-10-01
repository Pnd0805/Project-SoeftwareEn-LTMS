import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import * as TournamentPlayerService from '../services/tournamentPlayer.service.js';

// RW06 — GET /tournaments/:id/players/:userId/stats
export async function getTournamentPlayerStats(req : Request , res : Response){
    const tournamentId = parseId(req.params['id'] , 'รหัสทัวร์นาเมนต์');
    const userId = parseId(req.params['userId'] , 'รหัสผู้ใช้' , 'userId');
    res.status(200).json(await TournamentPlayerService.getTournamentPlayerStats(tournamentId , userId));
}
