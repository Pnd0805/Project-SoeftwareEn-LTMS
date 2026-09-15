import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import * as RefereeService from '../services/referee.service.js';

export async function invite(req : Request, res : Response){
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(201).json(await RefereeService.inviteReferee(tournamentId, req.user!.user_id, req.body));
}

export async function list(req : Request, res : Response){
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await RefereeService.listTournamentReferees(tournamentId));
}

export async function listMyInvitations(req : Request, res : Response){
    res.status(200).json(await RefereeService.listMyRefereeInvitations(req.user!.user_id));
}

export async function accept(req : Request, res : Response){
    const invitationId = parseId(req.params['id'], 'รหัสคำเชิญ');
    res.status(200).json(await RefereeService.acceptRefereeInvitation(invitationId, req.user!.user_id));
}

export async function decline(req : Request, res : Response){
    const invitationId = parseId(req.params['id'], 'รหัสคำเชิญ');
    await RefereeService.declineRefereeInvitation(invitationId, req.user!.user_id);
    res.status(204).send();
}