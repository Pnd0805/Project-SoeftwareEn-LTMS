import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import * as MatchHistoryService from '../services/matchHistory.service.js';

export async function getMatchHistory(req: Request, res: Response) {
    const userId = parseId(req.params['id'], 'รหัสผู้ใช้');
    res.status(200).json(await MatchHistoryService.getMatchHistory(userId));
}
