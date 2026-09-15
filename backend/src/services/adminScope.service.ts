import { toGetOfficialRequest, toRequestApproveDto, toRequestRejectDto } from '../mappers/adminScope.mapper.js';
import * as AdminRepo from '../repositories/adminScope.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import { toOfficialMemberConflictDto } from '../mappers/team.mapper.js';

import { buildPagination } from '../utils/pagination.js';
import { AppError } from '../utils/AppError.js';

export async function getAllOfficialRequest(offset : number , page : number , pageSize : number){
    const { rows , totalItems } = await AdminRepo.findAllOfficialRequests(offset , pageSize);

    const pagination = buildPagination(page , pageSize , totalItems)
    const data = rows.map(toGetOfficialRequest);
    return { items : data , pagination}
}



export async function approveTeamRequest(adminId : number ,teamReqId : number){
    const teamReq = await TeamRepo.findOfficialRequestById(teamReqId);
    if(!teamReq){
        throw new AppError(404 , "TEAM_REQUEST_NOT_FOUND", "ไม่พบคำร้องขอทีม Official");
    }

    const status = teamReq['team_admin_request_status'];
    if(status !== 'pending'){
        throw new AppError(409 , "ALREADY_DECIDED" , "คําขอนี้ถูกพิจารณาไปแล้ว");
    }

    const teamId = teamReq['team_id'];
    const team = await TeamRepo.findById(teamId);
    const isMemberConflict = await TeamRepo.findOfficialMemberConflict(teamId , team!['sport_type_id']);

    if(isMemberConflict.length > 0 ){
        const extra = {conflictingMembers : isMemberConflict.map(toOfficialMemberConflictDto)};
        throw new AppError(422 , "MEMBER_CONFLICT" , "สมาชิกบางคนสังกัดทีม Official อื่นในกีฬาเดียวกันแล้ว" , extra );
    }

    await AdminRepo.approveTeamOfficial(adminId , teamReqId , teamId);
    const official_team = await TeamRepo.findById(teamId);
    return toRequestApproveDto(official_team!);
}

export async function rejectTeamOfficial(adminId : number , teamReqId : number , reason : string){

    const teamReq = await TeamRepo.findOfficialRequestById(teamReqId);
    if(!teamReq){
        throw new AppError(404 , "TEAM_REQUEST_NOT_FOUND", "ไม่พบคำร้องขอทีม Official");
    }

    const status = teamReq['team_admin_request_status'];
    if(status !== 'pending'){
        throw new AppError(409 , "ALREADY_DECIDED" , "คําขอนี้ถูกพิจารณาไปแล้ว");
    }

    if(reason === ""){
        throw new AppError(400 , 'TEAM_REJECT_REASON_REQUIRED' , "กรุณาระบุเหตุผลที่ปฏิเสธคำร้อง");
    }

    await AdminRepo.rejectTeamOfficial(adminId , teamReqId , reason);
    const reject_request = await TeamRepo.findOfficialRequestById(teamReqId);

    return toRequestRejectDto(reject_request!);
}