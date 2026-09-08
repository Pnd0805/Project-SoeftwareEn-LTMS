import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import * as RefereeService from '../services/referee.service.js';

export async function invite(req : Request, res : Response){
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(201).json(await RefereeService.inviteReferee(tournamentId, req.user!.user_id, req.body));
}