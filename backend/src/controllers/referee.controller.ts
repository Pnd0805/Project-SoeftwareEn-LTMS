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

export async function assignToMatch(req : Request, res : Response){
    const matchId = parseId(req.params['id'], 'รหัสแมตช์');
    res.status(201).json(
        await RefereeService.assignRefereeToMatch(matchId, req.tournament!.tournament_id, req.body));
}

export async function listByMatch(req : Request, res : Response){
    const matchId = parseId(req.params['id'], 'รหัสแมตช์');
    res.status(200).json(await RefereeService.listMatchReferees(matchId));
}

export async function unassignFromMatch(req : Request, res : Response){
    const matchId = parseId(req.params['id'], 'รหัสแมตช์');
    const tournamentRefereeId = parseId(req.params['rid'], 'รหัสกรรมการ', 'rid');
    await RefereeService.unassignRefereeFromMatch(matchId, tournamentRefereeId);
    res.status(204).send();
}

export async function removeFromTournament(req : Request, res : Response){
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    const tournamentRefereeId = parseId(req.params['rid'], 'รหัสกรรมการ', 'rid');
    await RefereeService.removeTournamentReferee(
        tournamentId, tournamentRefereeId, req.user!.user_id, req.tournament!.tournament_status);
    res.status(204).send();
}