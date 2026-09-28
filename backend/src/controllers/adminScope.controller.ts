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

// ============================= C2 — Admin user surface =============================

export async function listUsers(req : Request , res : Response){
    const { newpage , newpageSize , offset } = parsePagination(req.query['page'] , req.query['pageSize']);
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
    const facultyId = typeof req.query['facultyId'] === 'string' ? Number(req.query['facultyId']) : undefined;
    const suspendedRaw = req.query['suspended'];
    const suspended = suspendedRaw === 'true' ? true : suspendedRaw === 'false' ? false : undefined;

    res.status(200).json(await AdminService.listUsers(req.admin! , { q , facultyId , suspended } , offset , newpage , newpageSize));
}

export async function suspendUser(req : Request , res : Response){
    const userId = parseId(req.params['id'] , 'รหัสผู้ใช้' , 'id');
    res.status(200).json(await AdminService.suspendUser(req.admin! , userId , req.body.suspended , req.body.reason));
}

export async function listScopes(req : Request , res : Response){
    const { newpage , newpageSize , offset } = parsePagination(req.query['page'] , req.query['pageSize']);
    const facultyId = typeof req.query['facultyId'] === 'string' ? Number(req.query['facultyId']) : undefined;

    res.status(200).json(await AdminService.listScopes(req.admin! , { facultyId } , offset , newpage , newpageSize));
}

export async function grantScope(req : Request , res : Response){
    res.status(201).json(await AdminService.grantScope(req.admin! , req.body.userId , req.body.scopeType , req.body.facultyId));
}

export async function revokeScope(req : Request , res : Response){
    const scopeId = parseId(req.params['id'] , 'รหัส admin scope' , 'id');
    res.status(200).json(await AdminService.revokeScope(req.admin! , scopeId));
}

export async function listAuditLogs(req : Request , res : Response){
    const { newpage , newpageSize , offset } = parsePagination(req.query['page'] , req.query['pageSize']);
    const entityType = typeof req.query['entityType'] === 'string' ? req.query['entityType'] : undefined;
    const entityId = typeof req.query['entityId'] === 'string' ? Number(req.query['entityId']) : undefined;
    const userId = typeof req.query['userId'] === 'string' ? Number(req.query['userId']) : undefined;
    const actionType = typeof req.query['actionType'] === 'string' ? req.query['actionType'] : undefined;

    res.status(200).json(await AdminService.listAuditLogs(req.admin! , { entityType , entityId , userId , actionType } , offset , newpage , newpageSize));
}

// C2 — user_reports
export async function listUserReports(req : Request , res : Response){
    const { newpage , newpageSize , offset } = parsePagination(req.query['page'] , req.query['pageSize']);
    res.status(200).json(await AdminService.listUserReports(req.admin! , offset , newpage , newpageSize));
}

export async function approveUserReport(req : Request , res : Response){
    const reportId = parseId(req.params['id'] , 'รหัสคำร้อง' , 'id');
    res.status(200).json(await AdminService.approveUserReport(req.admin! , reportId));
}

export async function rejectUserReport(req : Request , res : Response){
    const reportId = parseId(req.params['id'] , 'รหัสคำร้อง' , 'id');
    res.status(200).json(await AdminService.rejectUserReport(req.admin! , reportId , req.body.reason));
}