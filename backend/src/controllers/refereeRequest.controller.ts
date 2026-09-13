import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';
import * as RequestService from '../services/refereeRequest.service.js';

const STATUSES = ['open', 'applied', 'declined', 'cancelled'] as const;
type RequestStatus = typeof STATUSES[number];

export async function createRefRequest(req : Request, res : Response){
    res.status(201).json(await RequestService.createRefRequest(req.user!.user_id, req.body));
}

export async function createOrgAddMatch(req : Request, res : Response){
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(201).json(await RequestService.createOrgAddMatch(tournamentId, req.user!.user_id, req.body));
}

export async function createOrgSwap(req : Request, res : Response){
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(201).json(await RequestService.createOrgSwap(tournamentId, req.user!.user_id, req.body));
}

export async function listMine(req : Request, res : Response){
    res.status(200).json(await RequestService.listMyRequests(req.user!.user_id));
}

export async function listByTournament(req : Request, res : Response){
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    const raw = req.query['status'];
    let status : RequestStatus | undefined;
    if(raw !== undefined){
        if(typeof raw !== 'string' || !(STATUSES as readonly string[]).includes(raw)){
            throw new AppError(400, 'VALIDATION_FAILED', `status ต้องเป็นหนึ่งใน ${STATUSES.join(', ')}`);
        }
        status = raw as RequestStatus;
    }
    res.status(200).json(await RequestService.listTournamentRequests(tournamentId, status));
}

export async function accept(req : Request, res : Response){
    const requestId = parseId(req.params['id'], 'รหัสคำขอ');
    res.status(200).json(await RequestService.respondToRequest(requestId, req.user!.user_id, 'accepted'));
}

export async function decline(req : Request, res : Response){
    const requestId = parseId(req.params['id'], 'รหัสคำขอ');
    res.status(200).json(await RequestService.respondToRequest(requestId, req.user!.user_id, 'declined'));
}

export async function cancel(req : Request, res : Response){
    const requestId = parseId(req.params['id'], 'รหัสคำขอ');
    await RequestService.cancelRequest(requestId, req.user!.user_id);
    res.status(204).send();
}
