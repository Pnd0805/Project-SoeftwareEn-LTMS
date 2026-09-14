import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import * as AdminService from '../services/refereeAdmin.service.js';

export async function listPending(_req : Request, res : Response){
    res.status(200).json(await AdminService.listPendingExternalReferees());
}

export async function approve(req : Request, res : Response){
    const userId = parseId(req.params['userId'], 'รหัสผู้ใช้', 'userId');
    res.status(200).json(await AdminService.approveExternalReferee(userId, req.user!.user_id));
}

export async function requestDocs(req : Request, res : Response){
    const userId = parseId(req.params['userId'], 'รหัสผู้ใช้', 'userId');
    res.status(200).json(await AdminService.requestDocsFromExternalReferee(userId, req.user!.user_id, req.body));
}

export async function reject(req : Request, res : Response){
    const userId = parseId(req.params['userId'], 'รหัสผู้ใช้', 'userId');
    res.status(200).json(await AdminService.rejectExternalReferee(userId, req.user!.user_id, req.body));
}
