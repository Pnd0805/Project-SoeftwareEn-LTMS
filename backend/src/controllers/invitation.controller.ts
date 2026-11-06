import * as InvitationService from '../services/invitation.service.js';
import type { Request , Response } from 'express';
import { parseId } from '../utils/parseId.js';

export async function acceptInvitation(req : Request , res : Response){
    const invitedId = parseId(req.params['id'] , 'รหัสคำเชิญ' , 'id');
    return res.status(200).json(await InvitationService.acceptInvitation(invitedId , req.user!.user_id));
}

export async function rejectInvitation(req : Request , res : Response){
    const invitedId = parseId(req.params['id'] , 'รหัสคำเชิญ' , 'id');
    await InvitationService.rejectInvitation(invitedId , req.user!.user_id);
    return res.status(204).send();
}