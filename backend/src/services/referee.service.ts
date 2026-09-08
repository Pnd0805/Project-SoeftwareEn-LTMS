import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import { AppError } from '../utils/AppError.js';
import type { InviteRefereeInput } from '../schemas/referee.schema.js';

export async function inviteReferee(tournamentId : number, invitedBy : number, input : InviteRefereeInput){
    // 1. คนที่ถูกเชิญมีตัวตนจริงไหม
    const user = await UserRepo.findById(input.userId);
    if(!user){
        throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้นี้ในระบบ');
    }

    // 2. กันเชิญทับสถานะเดิม 
    const latest = await RefRepo.findLatestByTournamentAndUser(tournamentId, input.userId);
    if(latest && latest.removed_at === null){
        if(latest.invitation_status === 'pending'){
            throw new AppError(409, 'REFEREE_INVITATION_PENDING', 'ผู้ใช้นี้มีคำเชิญที่ยังไม่ได้ตอบอยู่แล้ว');
        }
        if(latest.invitation_status === 'accepted'){
            throw new AppError(409, 'REFEREE_ALREADY_ACCEPTED', 'ผู้ใช้นี้เป็นกรรมการของทัวร์นาเมนต์นี้อยู่แล้ว');
        }
    }

    // 3. เขียน
    const newId = await RefRepo.create({
        tournamentId, userId : input.userId, invitedBy, isExternal : input.isExternal
    });

    return { id : newId, userId : input.userId, invitationStatus : 'pending', isExternal : input.isExternal };
}