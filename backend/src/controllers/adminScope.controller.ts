import * as AdminService from '../services/adminScope.service.js';
import { parsePagination } from '../utils/pagination.js';
import type { Request , Response} from 'express';
import { parseId } from '../utils/parseId.js';

export async function getAllOfficialRequest(req : Request , res : Response){
    const { newpage , newpageSize , offset} = parsePagination(req.query['page'] , req.query['pageSize']);
    res.status(200).json(await AdminService.getAllOfficialRequest(offset , newpage , newpageSize));
}


export async function approveTeamOfficial(req : Request , res : Response){
    const teamReqId = parseId(req.params['id'] , 'รหัสคำร้อง' , 'id');
    res.status(200).json(await AdminService.approveTeamRequest(req.admin!.user_id , teamReqId));
}

export async function rejectTeamOfficial(req : Request , res : Response){
    const teamReqId = parseId(req.params['id'] , 'รหัสคำร้อง' , 'id');
    res.status(200).json(await AdminService.rejectTeamOfficial(req.admin!.user_id , teamReqId , req.body.reason));
}