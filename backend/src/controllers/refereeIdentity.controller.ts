import type { Request, Response } from 'express';
import * as IdentityService from '../services/refereeIdentity.service.js';

export async function getMine(req : Request, res : Response){
    res.status(200).json(await IdentityService.getMyIdentity(req.user!.user_id));
}

export async function submitDocs(req : Request, res : Response){
    res.status(200).json(await IdentityService.submitMyDocs(req.user!.user_id, req.body));
}
