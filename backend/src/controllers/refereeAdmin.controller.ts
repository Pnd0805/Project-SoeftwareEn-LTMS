import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import * as AdminService from '../services/refereeAdmin.service.js';

export async function listPending(_req : Request, res : Response){
    res.status(200).json(await AdminService.listPendingExternalReferees());
}

export async function approve(req : Request, res : Response){
    const id = parseId(req.params['id'], 'รหัสคำขอ');
    res.status(200).json(await AdminService.approveExternalReferee(id, req.user!.user_id));
}

export async function reject(req : Request, res : Response){
    const id = parseId(req.params['id'], 'รหัสคำขอ');
    res.status(200).json(await AdminService.rejectExternalReferee(id, req.user!.user_id, req.body));
}
