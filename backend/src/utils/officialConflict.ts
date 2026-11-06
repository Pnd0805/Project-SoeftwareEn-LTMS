import * as TeamRepo from '../repositories/team.repo.js';
import { AppError } from './AppError.js';
import type { TeamRow } from '../types/db.js';

/**
 * 🔴 QA 30 ต.ค. 2569 (C1 · BR-05) — ทีม Official ได้ทีมเดียวต่อกีฬา ต้องตรวจทุกประตูที่คนเข้าทีม
 *
 * เดิมตรวจแค่ตอนแอดมินอนุมัติคำขอเป็นทีม Official (`adminScope.service`) ⇒ หลังอนุมัติแล้วคนในทีม Official A
 * เข้าทีม Official B กีฬาเดียวกันได้ผ่านคำเชิญหรือคำขอเข้าร่วม · ประตูที่ใช้ตัวนี้:
 *   `team.service.createInvitation` (บอกเร็ว) · `invitation.service.acceptInvitation` (🔴 ด่านจริง)
 *   `joinRequest.service` ensureCanJoin — ทั้งตอนขอ (บอกเร็ว) และตอนหัวหน้าอนุมัติ (🔴 ด่านจริง)
 * ★ ตรวจเฉพาะเมื่อทีมปลายทางเป็น Official — ทีมธรรมดาไม่ติดกฎนี้ ห้ามทำให้เข้าทีมทั่วไปยากขึ้น
 * ★ code เดียวกับตอนแอดมินอนุมัติ (`MEMBER_CONFLICT`) + ชื่อทีมที่ชน ⇒ ผู้ใช้รู้ว่าต้องออกจากทีมไหนก่อน
 */
export async function assertNoOfficialConflict(
    team : Pick<TeamRow , 'team_id' | 'sport_type_id' | 'official_status'> , userId : number , subject : 'you' | 'invitee'
): Promise<void>{
    if(team.official_status !== 'Official') return;
    const conflict = await TeamRepo.findOfficialConflictForUser(userId , team.sport_type_id , team.team_id);
    if(conflict){
        const who = subject === 'you' ? 'คุณ' : 'ผู้ใช้นี้';
        throw new AppError(422 , 'MEMBER_CONFLICT' ,
            `${who}เป็นสมาชิกทีม Official "${conflict.teamName}" ในกีฬาเดียวกันอยู่แล้ว — ทีม Official ได้ทีมเดียวต่อกีฬา ต้องออกจากทีมนั้นก่อน` ,
            { conflictingTeam : { id : conflict.teamId , name : conflict.teamName } });
    }
}
