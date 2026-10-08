import * as ComplaintRepo from '../repositories/matchResultComplaint.repo.js';
import * as MatchResRepo from '../repositories/matchResult.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import { findTournamentById } from '../repositories/tournament.repo.js';
import { AppError } from '../utils/AppError.js';
import { ORG_RESOLVE_HOURS, WIN_POINTS } from '../config/scoring.js';
import { isDisputeWindow, isRefereeOfMatch, isTeamLeaderOfMatch } from '../middlewares/requireReferee.js';
import { ensureScoreData, findStartedNextMatchId } from './matchResult.service.js';
import * as NotificationService from './notification.service.js';
import * as Walkover from './walkover.service.js';
import { getPresignedDownloadUrl } from './upload.service.js';
import type { FileComplaintInput, OrganizerStatementInput, DecideComplaintInput } from '../schemas/matchResultComplaint.schema.js';
import type { ComplaintDetailRow } from '../repositories/matchResultComplaint.repo.js';

/**
 * OD-26 ข้อ 8 (มติ 26–27 ก.ย. 2569) — เรื่องร้องเรียนผลแมตช์
 *
 * เส้นนี้มีไว้สำหรับกรณีที่ประตูของการโต้แย้งปิดไปแล้ว (พ้นหน้าต่างเวลา หรือเป็นผลบายที่ค้านไม่ได้เลย)
 * แต่ยังมีคนถือหลักฐานอยู่ในมือ · ต่างจากการโต้แย้งสามข้อ:
 *   1. ไม่แตะ match_status → แมตช์ถัดไปเดินต่อ ทัวร์ปิดได้ เรื่องเดียวไม่แช่ทั้งทัวร์
 *   2. ผู้จัดแนบความเห็นได้ แต่ "ปัดตกไม่ได้" — ถ้าปัดตกได้ ผู้จัดที่เป็นคู่กรณีเองก็ปัดทิ้งหมด
 *   3. ครบ ORG_RESOLVE_HOURS แล้วขึ้นแอดมินมหาวิทยาลัยเอง ไม่ว่าผู้จัดจะเขียนหรือไม่
 *      (หลัก "การนิ่งเฉยต้องไม่มีอำนาจยับยั้ง" — เงียบแล้วเรื่องต้องเดินต่อ ไม่ใช่เรื่องตาย)
 *
 * นาฬิกาเรือนเดียวคือ created_at ของเรื่อง จึงไม่มีสถานะ 'escalated' ให้ต้องเขียนและไม่ต้องมี scheduler
 */

/** เวลาที่เรื่องนี้ขึ้นถึงแอดมิน — คิดจาก created_at เสมอ ไม่ขึ้นกับว่าผู้จัดทำอะไรหรือไม่ทำ */
function escalatesAt(row : { created_at : Date }): Date {
    return new Date(row.created_at.getTime() + ORG_RESOLVE_HOURS * 3600 * 1000);
}

export function isAdminTurn(row : { created_at : Date }): boolean {
    return Date.now() >= escalatesAt(row).getTime();
}

/**
 * ผลแมตช์นี้ยังแก้ได้จริงไหม — ใช้บอกแอดมินล่วงหน้าว่ากด amend_result ได้หรือได้แค่บันทึกไว้
 * แก้ได้ต่อเมื่อ: ผลอยู่ที่ verified (ผลบายไม่มีสกอร์จริงให้แก้) · ทัวร์ยังไม่ปิด · แมตช์ถัดไปยังไม่ขยับ
 */
async function amendability(matchId : number): Promise<{ canAmend : boolean , blockedBy : string | null }>{
    const match = await MatchRepo.findById(matchId);
    if(!match) return { canAmend : false , blockedBy : 'MATCH_NOT_FOUND' };

    const res = await MatchResRepo.findmatchResultByMatchId(matchId);
    if(!res || res.match_result_status !== 'verified') return { canAmend : false , blockedBy : 'RESULT_NOT_AMENDABLE' };

    const tour = await findTournamentById(match.tournament_id);
    if(tour?.tournament_status === 'completed') return { canAmend : false , blockedBy : 'TOURNAMENT_COMPLETED' };

    const startedId = await findStartedNextMatchId(match);
    if(startedId !== null) return { canAmend : false , blockedBy : 'NEXT_MATCH_STARTED' };

    return { canAmend : true , blockedBy : null };
}

/**
 * ยื่นเรื่อง — เปิดให้เฉพาะเมื่อ "ช่องทางปกติปิดแล้ว" เพื่อไม่ให้มีสองประตูซ้อนกัน
 * คนยื่นได้ = หัวหน้าทีมสองฝ่าย + กรรมการของแมตช์ (ชุดเดียวกับผู้ที่โต้แย้งได้ · มติ 27 ก.ย.)
 * ยื่นได้เฉพาะก่อนทัวร์ปิด — บังคับโดย lockCompletedTournament ที่ prefix `/matches/:id` อยู่แล้ว
 */
export async function fileComplaint(matchId : number , userId : number , input : FileComplaintInput){
    const match = await MatchRepo.findById(matchId);
    if(!match){
        throw new AppError(404 , "MATCH_NOT_FOUND" , "ไม่พบแมตช์นี้");
    }

    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    if(!matchRes){
        throw new AppError(404 , "MATCH_RESULT_NOT_FOUND" , "แมตช์นี้ยังไม่มีผลการแข่งขัน");
    }
    // ร้องเรียนได้เฉพาะผลที่ "มีผลบังคับอยู่" — ผลที่ยังรอยืนยันหรือถูกปฏิเสธไปแล้วใช้ช่องทางปกติได้
    if(matchRes.match_result_status !== 'verified' && matchRes.match_result_status !== 'walkover'){
        throw new AppError(409 , "RESULT_NOT_FINAL" ,
            "ร้องเรียนได้เฉพาะผลที่ยืนยันแล้ว — ผลที่ยังรอยืนยันหรือมีข้อโต้แย้งค้างให้ใช้การโต้แย้งผลตามปกติ" ,
            { status : matchRes.match_result_status });
    }
    // ผลบายค้านด้วยกลไกปกติไม่ได้เลย จึงข้ามด่านนี้ไป — เหลือเส้นนี้เป็นทางเดียวที่มี
    if(matchRes.match_result_status === 'verified' && await isDisputeWindow(match.tournament_id , matchRes)){
        throw new AppError(409 , "USE_DISPUTE_INSTEAD" ,
            "ยังอยู่ในระยะเวลาที่โต้แย้งผลได้ตามปกติ ให้ใช้การโต้แย้งผลแทนการร้องเรียน");
    }

    if(!(await isTeamLeaderOfMatch(matchId , userId)) && !(await isRefereeOfMatch(matchId , userId , match.tournament_id))){
        throw new AppError(403 , "NOT_COMPLAINT_PARTY" ,
            "ร้องเรียนผลแมตช์ได้เฉพาะหัวหน้าทีมที่ลงแข่งแมตช์นี้หรือกรรมการของแมตช์นี้");
    }

    if(input.claimedWinnerTeamId !== undefined && input.claimedScoreData !== undefined){
        ensureScoreData(match , input.claimedWinnerTeamId , input.claimedScoreData);
    }
    const evidenceKeys = input.evidenceKeys ?? null;
    if(evidenceKeys !== null && evidenceKeys.some(k => !k.startsWith(`dispute_evidence/${matchId}/`))){
        throw new AppError(400 , "VALIDATION_FAILED" , "ไฟล์หลักฐานไม่ใช่ของแมตช์นี้" ,
            { fields : { evidenceKeys : 'ต้องเป็นไฟล์ที่อัปโหลดไว้สำหรับแมตช์นี้' } });
    }

    // ยื่นซ้ำของคนเดิมต่อผลเดิม = แก้ของเดิม แต่ห้ามรีเซ็ตเรื่องที่ตัดสินไปแล้ว
    const existing = await ComplaintRepo.findOpenByResultAndFiler(matchRes.match_result_id , userId);
    if(existing && existing.complaint_status !== 'open'){
        throw new AppError(409 , "COMPLAINT_ALREADY_DECIDED" ,
            "เรื่องที่คุณยื่นไว้ถูกตัดสินแล้ว ยื่นซ้ำเรื่องเดิมไม่ได้" ,
            { complaintId : existing.match_result_complaint_id , status : existing.complaint_status });
    }

    const complaintId = await ComplaintRepo.fileComplaint(matchId , matchRes.match_result_id , userId , {
        reason : input.reason,
        claimedWinnerTeamId : input.claimedWinnerTeamId ?? null,
        claimedScore : input.claimedScoreData ?? null,
        evidenceKeys,
    });

    await NotificationService.notifyMatchResultParties(matchId , {
        type : 'match_result_complaint_filed',
        title : 'มีการร้องเรียนผลการแข่งขัน',
        message : `ผลแมตช์ #${matchId} ถูกร้องเรียน — ผู้จัดมีเวลา ${ORG_RESOLVE_HOURS} ชั่วโมงในการแนบความเห็น ` +
                  `หลังจากนั้นเรื่องจะขึ้นถึงแอดมินมหาวิทยาลัยเอง`,
        relatedEntityType : 'match', relatedEntityId : matchId,
    } , { exceptUserId : userId , includeOrganizer : true });

    return withDetail(complaintId);
}

/** ผู้จัดแนบความเห็น — ทำได้แม้ทัวร์ปิดแล้ว (route อยู่นอก prefix ที่ lockCompletedTournament คุม) */
export async function attachOrganizerStatement(complaintId : number , userId : number , input : OrganizerStatementInput){
    const row = await ComplaintRepo.findById(complaintId);
    if(!row){
        throw new AppError(404 , "COMPLAINT_NOT_FOUND" , "ไม่พบเรื่องร้องเรียนนี้");
    }
    if(row.complaint_status !== 'open'){
        throw new AppError(409 , "COMPLAINT_ALREADY_DECIDED" , "เรื่องนี้ถูกตัดสินแล้ว แนบความเห็นเพิ่มไม่ได้" ,
            { status : row.complaint_status });
    }

    const ok = await ComplaintRepo.attachOrganizerStatement(complaintId , userId , input.statement);
    if(!ok){
        throw new AppError(409 , "COMPLAINT_ALREADY_DECIDED" , "เรื่องนี้ถูกตัดสินแล้ว แนบความเห็นเพิ่มไม่ได้");
    }

    return withDetail(complaintId);
}

/**
 * แอดมินมหาวิทยาลัยตัดสิน (ผู้จัดตัดสินเองไม่ได้ — เป็นคู่กรณีที่อาจถูกร้องเรียน)
 *   upheld + record_only  : มีมูล บันทึกเป็นหลักฐานไว้ ไม่แก้ผล (สายเดินไปแล้วแก้ย้อนพังกว่า)
 *   upheld + amend_result : มีมูล และผลยังแก้ได้จริง → แก้ผู้ชนะ/สกอร์ผ่านเส้นทาง amend เดิม
 *   no_merit              : ไม่มีมูล → ติดชื่อผู้ยื่นไว้ (filer_flagged) ไม่ติดใครอื่น
 */
export async function decideComplaint(complaintId : number , userId : number , input : DecideComplaintInput){
    const row = await ComplaintRepo.findById(complaintId);
    if(!row){
        throw new AppError(404 , "COMPLAINT_NOT_FOUND" , "ไม่พบเรื่องร้องเรียนนี้");
    }
    if(row.complaint_status !== 'open'){
        throw new AppError(409 , "COMPLAINT_ALREADY_DECIDED" , "เรื่องนี้ถูกตัดสินแล้ว" , { status : row.complaint_status });
    }
    if(!isAdminTurn(row)){
        throw new AppError(403 , "ORGANIZER_STILL_HAS_TIME" ,
            `ผู้จัดยังมีเวลาแนบความเห็นถึง ${escalatesAt(row).toISOString()} — แอดมินตัดสินได้หลังจากนั้น` ,
            { availableAt : escalatesAt(row).toISOString() });
    }

    if(input.remedy === 'amend_result'){
        const { canAmend , blockedBy } = await amendability(row.match_id);
        if(!canAmend){
            throw new AppError(409 , "RESULT_NOT_CHANGEABLE" ,
                "ผลแมตช์นี้แก้ไม่ได้อีกแล้ว — ตัดสินได้แต่ต้องเลือกบันทึกไว้เป็นหลักฐาน (record_only)" ,
                { blockedBy });
        }
        await amendFromComplaint(row , userId , input);
    }

    const ok = await ComplaintRepo.decideComplaint(complaintId , row.match_id , userId , {
        outcome : input.outcome,
        remedy : input.remedy,
        note : input.note,
    });
    if(!ok){
        throw new AppError(409 , "COMPLAINT_ALREADY_DECIDED" , "เรื่องนี้ถูกตัดสินแล้ว");
    }

    await NotificationService.notifyMatchResultParties(row.match_id , {
        type : 'match_result_complaint_decided',
        title : input.outcome === 'upheld' ? 'แอดมินวินิจฉัยว่าเรื่องร้องเรียนมีมูล' : 'แอดมินวินิจฉัยว่าเรื่องร้องเรียนไม่มีมูล',
        message : `เรื่องร้องเรียนผลแมตช์ #${row.match_id} ได้ข้อยุติแล้ว` +
                  (input.remedy === 'amend_result' ? ' — ผลการแข่งขันถูกแก้ตามคำวินิจฉัย' : ' — ผลการแข่งขันคงเดิม') +
                  ` · คำวินิจฉัย: ${input.note}`,
        relatedEntityType : 'match', relatedEntityId : row.match_id,
    } , { includeOrganizer : true });

    return withDetail(complaintId);
}

/** แก้ผลตามคำวินิจฉัย — เดินเส้นทาง amend เดิมทั้งเส้น (ถอน/ใส่สาย · standings · stats · audit) */
async function amendFromComplaint(row : ComplaintDetailRow , userId : number , input : DecideComplaintInput){
    const match = (await MatchRepo.findById(row.match_id))!;
    const tour = (await findTournamentById(match.tournament_id))!;
    const matchRes = (await MatchResRepo.findmatchResultByMatchId(row.match_id))!;
    const newWinnerId = input.winnerTeamId!;

    ensureScoreData(match , newWinnerId , input.scoreData!);
    await MatchResRepo.amendMatchResult(matchRes.match_result_id , match , matchRes.winner_team_id! , newWinnerId ,
        input.scoreData! , tour.sport_type_id , WIN_POINTS , userId ,
        `[คำวินิจฉัยเรื่องร้องเรียน #${row.match_result_complaint_id}] ${input.note}` , true);

    if(matchRes.winner_team_id !== newWinnerId){
        await Walkover.resolveIfOpponentWithdrawn(match.next_match_id);
        await Walkover.resolveIfOpponentWithdrawn(match.loser_next_match_id);
    }
}

/** เรื่องทั้งหมดของแมตช์หนึ่ง — ผู้จัด/แอดมินอ่านก่อนตัดสิน · ผู้ยื่นตามเรื่องของตัวเอง */
export async function listComplaintsOfMatch(matchId : number){
    const rows = await ComplaintRepo.findByMatchId(matchId);
    const amend = await amendability(matchId);
    return {
        matchId,
        canAmendResult : amend.canAmend,
        amendBlockedBy : amend.blockedBy,
        complaints : await Promise.all(rows.map(r => toComplaintDto(r , amend , true))),
    };
}

export async function getComplaint(complaintId : number){
    const row = await ComplaintRepo.findById(complaintId);
    if(!row){
        throw new AppError(404 , "COMPLAINT_NOT_FOUND" , "ไม่พบเรื่องร้องเรียนนี้");
    }
    return withDetail(complaintId);
}

async function withDetail(complaintId : number){
    const row = (await ComplaintRepo.findById(complaintId))!;
    return toComplaintDto(row , await amendability(row.match_id) , true);
}

/**
 * `stage` บอก FE ว่าลูกอยู่ในมือใคร โดยคิดจากเวลาอย่างเดียว — ไม่มีสถานะในตารางให้ใครลืมอัปเดต
 * `filerFlagged` ส่งออกตรง ๆ ได้ เพราะติดเฉพาะเมื่อแอดมินวินิจฉัยว่าไม่มีมูลแล้ว (ไม่ใช่ข้อกล่าวหาลอย ๆ)
 */
async function toComplaintDto(row : ComplaintDetailRow , amend : { canAmend : boolean , blockedBy : string | null } , withEvidence : boolean){
    return {
        complaintId : row.match_result_complaint_id,
        matchId : row.match_id,
        tournamentId : row.tournament_id,
        status : row.complaint_status,
        stage : row.complaint_status !== 'open' ? 'decided' as const
              : isAdminTurn(row) ? 'admin' as const : 'organizer' as const,
        escalatesAt : escalatesAt(row).toISOString(),
        filedBy : { id : row.filed_by , fullName : row.filed_by_name },
        filedAt : row.created_at.toISOString(),
        reason : row.reason,
        claimedWinnerTeamId : row.claimed_winner_team_id,
        claimedScoreData : row.claimed_score,
        evidence : withEvidence ? await Promise.all((row.evidence ?? []).map(key => getPresignedDownloadUrl(key))) : [],
        organizerStatement : row.organizer_statement === null ? null : {
            statement : row.organizer_statement,
            by : { id : row.organizer_statement_by , fullName : row.statement_by_name },
            at : row.organizer_statement_at?.toISOString() ?? null,
            // ผู้จัดเขียนหลังหมดเวลาได้ แต่บันทึกไว้ให้เห็นว่ามาช้า — ความเห็นที่มาช้ายังมีประโยชน์กว่าไม่มี
            late : row.organizer_statement_at !== null && row.organizer_statement_at.getTime() > escalatesAt(row).getTime(),
        },
        decision : row.decided_at === null ? null : {
            outcome : row.complaint_status,
            remedy : row.remedy,
            note : row.decision_note,
            by : { id : row.decided_by , fullName : row.decided_by_name },
            at : row.decided_at.toISOString(),
        },
        filerFlagged : Boolean(row.filer_flagged),
        canAmendResult : amend.canAmend,
        amendBlockedBy : amend.blockedBy,
    };
}
