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

// C3 — ลิสต์คำขอโอนหัวหน้าทีมที่รออนุมัติ
export async function getAllTransferRequest(req : Request , res : Response){
    const { newpage , newpageSize , offset} = parsePagination(req.query['page'] , req.query['pageSize']);
    res.status(200).json(await AdminService.getAllTransferRequest(offset , newpage , newpageSize));
}

// C3 — โอนหัวหน้าทีม (T20)
export async function approveTransfer(req : Request , res : Response){
    const teamReqId = parseId(req.params['id'] , 'รหัสคำร้อง' , 'id');
    res.status(200).json(await AdminService.approveTransferRequest(req.admin!.user_id , teamReqId));
}

// C3 — ปฏิเสธคำขอโอนหัวหน้าทีม
export async function rejectTransfer(req : Request , res : Response){
    const teamReqId = parseId(req.params['id'] , 'รหัสคำร้อง' , 'id');
    res.status(200).json(await AdminService.rejectTransferRequest(req.admin!.user_id , teamReqId , req.body.reason));
}

// C3 — แอดมินโอนหัวหน้าทีมแทนตอนหัวหน้าเดิมหายไป
export async function transferLeaderByAdmin(req : Request , res : Response){
    const teamId = parseId(req.params['id'] , 'รหัสทีม' , 'id');
    res.status(200).json(await AdminService.transferLeaderByAdmin(req.admin!.user_id , teamId , req.body.newLeaderId));
}