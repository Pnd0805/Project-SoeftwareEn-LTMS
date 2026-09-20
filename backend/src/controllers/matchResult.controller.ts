import type { Request , Response } from 'express';
import * as MatchResService from '../services/matchResult.service.js';

import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';


export async function createSubmitMatchRes(req : Request , res : Response){
    const matchId = parseId(req.params['id'] , 'รหัสผลการแข่งขัน' , 'id');
    const winnerId = req.body['winnerTeamId'];
    const score = req.body['scoreData'];
    const userId = req.user!.user_id;
    const submitrole = req.submitrole;

    if (!submitrole) {
        throw new AppError(500, 'INTERNAL_ERROR', 'ไม่พบบทบาทผู้ส่งผล');   // ไม่ควรเกิดขึ้นได้ถ้า route ต่อ middleware ถูก
    }
    return res.status(201).json(await MatchResService.createSubmitMatchRes(matchId , winnerId , score , userId , submitrole));
}

export async function updateVerifyMatchResult(req : Request , res : Response){
    const matchId = parseId(req.params['id'] , 'รหัสผลการแข่งขัน' , 'id');
    const userId = req.user!.user_id
    return res.status(200).json(await MatchResService.verifyMatchResult(matchId , userId));
}

export async function updateDisputeMatchResult(req : Request , res : Response){
    const matchId = parseId(req.params['id'] , 'รหัสผลการแข่งขัน' , 'id');
    const userId = req.user!.user_id
    const reason = req.body['reason'];
    return res.status(200).json(await MatchResService.disputeMatchResult(matchId , userId , reason));
}

export async function updateResolveMatchResult(req : Request , res : Response){
    const matchId = parseId(req.params['id'] , 'รหัสผลการแข่งขัน' , 'id');
    const userId = req.user!.user_id
    return res.status(200).json(await MatchResService.resolveMatchResult(matchId , req.body , userId));
}

export async function getVerifiedResult(req : Request , res : Response){
    const matchId = parseId(req.params['id'] , 'รหัสผลการแข่งขัน' , 'id');
    return res.status(200).json(await MatchResService.getVerifiedResult(matchId , req.user?.user_id));
}

export async function updatePlayerStat(req : Request , res : Response){
    const matchId = parseId(req.params['id'] , 'รหัสผลการแข่งขัน' , 'id');
    const userId = req.user!.user_id;
    const playerStats = req.body['playerStats'];
    return res.status(201).json(await MatchResService.updatePlayerStat(matchId , userId , playerStats));
}

export async function getPlayerMatchStat(req : Request , res : Response){
    const matchId = parseId(req.params['id'] , 'รหัสผลการแข่งขัน' , 'id');
    return res.status(200).json(await MatchResService.getPlayerMatchStat(matchId));
}

export async function getChampion(req : Request , res : Response){
    const tournamentId = parseId(req.params['id'] , 'รหัสทัวร์นาเมนต์' , 'id');
    return res.status(200).json(await MatchResService.getChampion(tournamentId));
}

export async function getDashboard(req : Request , res : Response){
    const tournamentId = parseId(req.params['id'] , 'รหัสทัวร์นาเมนต์' , 'id');
    return res.status(200).json(await MatchResService.getDashboard(tournamentId));
}

export async function getStandings(req : Request , res : Response){
    const tournamentId = parseId(req.params['id'] , 'รหัสทัวร์นาเมนต์' , 'id');
    return res.status(200).json(await MatchResService.getStandings(tournamentId));
}

export async function updateLivestream(req : Request , res : Response){
    const matchId = parseId(req.params['id'] , 'รหัสแมตช์' , 'id');
    const youtubeUrl = req.body['youtubeUrl'];
    return res.status(200).json(await MatchResService.updateLivestream(matchId , youtubeUrl));
}