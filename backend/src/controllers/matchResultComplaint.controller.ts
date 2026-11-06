import type { Request , Response } from 'express';
import * as ComplaintService from '../services/matchResultComplaint.service.js';
import { parseId } from '../utils/parseId.js';

/** S13 — ยื่นเรื่องร้องเรียนผลแมตช์ (OD-26 ข้อ 8) */
export async function fileComplaint(req : Request , res : Response){
    const matchId = parseId(req.params['id'] , 'รหัสแมตช์' , 'id');
    return res.status(201).json(await ComplaintService.fileComplaint(matchId , req.user!.user_id , req.body));
}

/** S13b — เรื่องร้องเรียนทั้งหมดของแมตช์หนึ่ง */
export async function listComplaintsOfMatch(req : Request , res : Response){
    const matchId = parseId(req.params['id'] , 'รหัสแมตช์' , 'id');
    return res.status(200).json(await ComplaintService.listComplaintsOfMatch(matchId));
}

/** S13c — รายละเอียดเรื่องเดียว */
export async function getComplaint(req : Request , res : Response){
    const complaintId = parseId(req.params['id'] , 'รหัสเรื่องร้องเรียน' , 'id');
    return res.status(200).json(await ComplaintService.getComplaint(complaintId));
}

/** S13d — ผู้จัดแนบความเห็น (ปัดตกไม่ได้) */
export async function attachOrganizerStatement(req : Request , res : Response){
    const complaintId = parseId(req.params['id'] , 'รหัสเรื่องร้องเรียน' , 'id');
    return res.status(200).json(await ComplaintService.attachOrganizerStatement(complaintId , req.user!.user_id , req.body));
}

/** S13e — แอดมินมหาวิทยาลัยวินิจฉัย */
export async function decideComplaint(req : Request , res : Response){
    const complaintId = parseId(req.params['id'] , 'รหัสเรื่องร้องเรียน' , 'id');
    return res.status(200).json(await ComplaintService.decideComplaint(complaintId , req.user!.user_id , req.body));
}
