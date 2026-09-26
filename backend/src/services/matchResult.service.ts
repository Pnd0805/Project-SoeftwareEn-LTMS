import * as MatchResRepo from '../repositories/matchResult.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as SportTypeRepo from '../repositories/sportType.repo.js';


import { toDisputeResultDto, toSubmittedResultDto, toVerifiedResultDto , toResolveResultDto, toVerifiedResult , toPlayerMatchStat, toTournamentWinnerDto, toStandingDto , rankStandings } from '../mappers/matchResult.mapper.js';
import { checkMatch, checkTournament, checkTeam } from '../utils/checkExist.js';
import { AppError } from '../utils/AppError.js';
import { findTournamentById } from '../repositories/tournament.repo.js';
import { toTeamRef } from '../mappers/team.mapper.js';
import { WIN_POINTS, AUTO_VERIFY_HOURS, AUTO_VERIFY_LEAD_MINUTES, SUBMIT_ESCALATION_HOURS } from '../config/scoring.js';
import type { DisputeInput, OrganizerDecideInput, ResolveInput } from '../schemas/matchResult.schema.js';
import type { MatchRow , TournamentRow } from '../types/db.js';
import * as Walkover from './walkover.service.js';
import { isRefereeOfMatch, isTeamLeaderOfMatch } from '../middlewares/requireReferee.js';
import * as NotificationService from './notification.service.js';
import { isSubmitEscalationOpen } from '../utils/escalation.js';
import { getPresignedDownloadUrl } from './upload.service.js';

/**
 * FE-nothing-validates-keys-scoredata (19 ก.ย.) — ใช้ทั้ง S01 ส่งผล และ S04 amend
 *   a. key ของ scoreData ต้องเป็น id ของ 2 ทีมในแมตช์ครบทั้งคู่ ไม่มีอย่างอื่น
 *   b. คะแนนไม่ติดลบ (schema กันแล้ว)
 *   c. winnerTeamId ต้องเป็นฝ่ายที่คะแนนมากกว่า — กีฬาทั้ง 5 ของเราคะแนนมากกว่าชนะเสมอ · เสมอกันยังไม่รองรับ (B3)
 */
export function ensureScoreData(match : MatchRow , winnerId : number , scoreData : Record<string , number>): void{
    const teamIds = [match.team_a_id , match.team_b_id].map(String);
    const keys = Object.keys(scoreData);
    if(keys.length !== 2 || !teamIds.every(id => keys.includes(id))){
        throw new AppError(400 , "VALIDATION_FAILED" , `scoreData ต้องมี key เป็นรหัสทีมทั้งสองของแมตช์นี้ (${teamIds.join(', ')}) เท่านั้น` ,
            { fields : { scoreData : `key ต้องเป็น ${teamIds.join(' และ ')}` } , expectedKeys : teamIds });
    }
    if(winnerId !== match.team_a_id && winnerId !== match.team_b_id){
        throw new AppError(400 , "VALIDATION_FAILED" , "winnerTeamId ต้องเป็นทีมใดทีมหนึ่งในแมตช์นี้" , { fields : { winnerTeamId : 'ไม่ใช่ทีมในแมตช์' } });
    }
    const loserId = match.team_a_id === winnerId ? match.team_b_id! : match.team_a_id!;
    if(scoreData[String(winnerId)]! <= scoreData[String(loserId)]!){
        throw new AppError(400 , "VALIDATION_FAILED" , "ทีมที่ชนะต้องมีคะแนนมากกว่าอีกฝ่าย (ระบบยังไม่รองรับผลเสมอ)" ,
            { fields : { winnerTeamId : 'คะแนนไม่มากกว่าอีกฝ่าย' } });
    }
}

export async function createSubmitMatchRes(matchId : number , winnerId : number , scoreData : Record<string , number> , submitById : number , role : 'team_leader' | 'referee'){
    const match = await checkMatch(matchId);
    ensureScoreData(match , winnerId , scoreData);
    const matchResId = await MatchResRepo.submitMatchResult(matchId , winnerId , scoreData , submitById , role);

    const matchRes = await MatchResRepo.findById(matchResId);
    await NotificationService.notifyMatchResultParties(matchId, {
        type : 'result_submitted',
        title : 'มีการส่งผลการแข่งขัน',
        message : `ผลการแข่งขันแมตช์ #${matchId} ถูกส่งแล้ว รอการยืนยัน`,
        relatedEntityType : 'match', relatedEntityId : matchId,
    }, { exceptUserId : submitById });
    return toSubmittedResultDto(matchRes!);
}

export async function verifyMatchResult(matchId : number , userid : number){
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);

    await MatchResRepo.verifyMatchResult(matchRes!.match_result_id , matchId , userid , WIN_POINTS);
    const ver_matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    const match = await MatchRepo.findById(matchId);

    // ทีมที่เพิ่งถูกวางลงแมตช์ถัดไป อาจเจอคู่ที่ถอนตัวไปแล้ว → แมตช์นั้นจบด้วย walkover ทันที (GUIDE/11 §10.4, มติ Q1-A)
    await Walkover.resolveIfOpponentWithdrawn(match!.next_match_id);
    await Walkover.resolveIfOpponentWithdrawn(match!.loser_next_match_id);
    await NotificationService.notifyMatchResultParties(matchId, {
        type : 'result_verified',
        title : 'ผลการแข่งขันยืนยันแล้ว',
        message : `ผลการแข่งขันแมตช์ #${matchId} ได้รับการยืนยันแล้ว`,
        relatedEntityType : 'match', relatedEntityId : matchId,
    }, { exceptUserId : userid });
    return toVerifiedResultDto(ver_matchRes! , match!);
}

/**
 * S03 โต้แย้งผล (มติ 26 ก.ย.) — เดิมรับแค่ข้อความ ผู้จัดเปิดเรื่องมาแล้วตัดสินไม่ได้
 * ตอนนี้ผู้ค้านเสนอ "ผลที่ควรจะเป็น" มาพร้อมกันได้ ตรวจด้วยกฎเดียวกับตอนส่งผล (ensureScoreData)
 * และแนบหลักฐานได้ โดย key ต้องเป็นของแมตช์นี้จริง — กันแนบ key ของแมตช์อื่นมาให้ผู้จัดเปิดดู
 */
/**
 * OD-26 ข้อ 6 ขั้นสุดท้าย (มติ 26 ก.ย.) — ผู้จัดตัดสินแมตช์ที่ไม่มีใครส่งผลเลย
 *
 * วันนี้แมตช์แบบนี้ไม่มีทางออกใด ๆ ในระบบ แม้แต่แอดมิน: forfeit ใช้ได้เฉพาะตอน checkin_open
 * ปิดเช็คอินก็ย้อนไม่ได้ จับสายใหม่ก็ติด BRACKET_IN_USE → ทัวร์นั้นปิดไม่ได้ตลอดกาล
 *
 * ใช้ได้ต่อเมื่อ: แมตช์อยู่ที่ `finished` · พ้นกำหนดแล้ว · ยังไม่มีผลที่ใช้ได้
 * (มีผลค้างอยู่ = ไปใช้ทางอื่น — ยืนยัน/โต้แย้ง/auto-verify)
 * "แพ้ทั้งคู่" เป็นทางเลือกที่สมมาตร ไม่มีใครได้ประโยชน์ จึงไม่มีประเด็นความโปร่งใส
 * ส่วน "กรอกผล" ติดป้ายถาวรผ่าน submitted_role = 'organizer' และบังคับเหตุผลลง audit
 */
export async function organizerDecideMatch(matchId : number , orgUserId : number , input : OrganizerDecideInput){
    const match = await MatchRepo.findById(matchId);
    if(!match){
        throw new AppError(404 , "MATCH_NOT_FOUND" , "ไม่พบแมตช์นี้");
    }
    if(match.match_status !== 'finished'){
        throw new AppError(409 , "MATCH_NOT_FINISHED" ,
            "ผู้จัดตัดสินผลได้เฉพาะแมตช์ที่แข่งจบแล้วและยังไม่มีผล" , { status : match.match_status });
    }
    if(!isSubmitEscalationOpen(match)){
        throw new AppError(409 , "ESCALATION_NOT_OPEN" ,
            `ยังไม่ถึงกำหนด — ผู้จัดตัดสินเองได้เมื่อพ้น ${SUBMIT_ESCALATION_HOURS} ชั่วโมงหลังแมตช์จบและยังไม่มีใครส่งผล` ,
            { availableAt : new Date(match.actual_end_time!.getTime() + SUBMIT_ESCALATION_HOURS * 3600 * 1000).toISOString() });
    }
    const existing = await MatchResRepo.findmatchResultByMatchId(matchId);
    if(existing && existing.match_result_status !== 'rejected'){
        throw new AppError(409 , "MATCH_RESULT_EXISTS" ,
            "แมตช์นี้มีผลอยู่แล้ว ให้ใช้การยืนยันหรือการโต้แย้งแทน" , { status : existing.match_result_status });
    }

    /**
     * มติ 27 ก.ย. — "แพ้ทั้งคู่" ใช้ได้เฉพาะโหมด online
     *   onsite : มีกรรมการที่ผู้จัดแต่งตั้งและอยู่หน้างาน (BR-10 บังคับว่าต้องมีก่อนเริ่มแข่ง)
     *            ไม่มีผลส่ง = ความบกพร่องของฝั่งผู้จัด/กรรมการ ไม่ใช่ของทีม — ทีมลงแข่งครบแล้ว
     *            จะเอาความผิดของตัวเองไปปรับแพ้ทั้งสองทีมไม่ได้ ต้องกรอกผลตามที่เกิดขึ้นจริง
     *            ถ้ากรอกผิด ทีมยังโต้แย้งได้ตามปกติ (หน้าต่างค้านเปิดอยู่)
     *   online : คนส่งผลคือหัวหน้าทีม และกรรมการก็ส่งแทนได้แล้วตั้งแต่ขั้นแรก
     *            เงียบทั้งสองฝ่าย = ความบกพร่องของทีมเอง การนับแพ้ทั้งคู่จึงได้สัดส่วน
     */
    if(input.outcome === 'double_forfeit' && match.mode === 'onsite'){
        throw new AppError(409 , "FORFEIT_NOT_ALLOWED_ONSITE" ,
            "แมตช์หน้างานมีกรรมการที่ผู้จัดแต่งตั้งอยู่แล้ว การไม่มีผลส่งเป็นความรับผิดชอบของฝั่งผู้จัด จึงปรับแพ้ทั้งสองทีมไม่ได้ — ให้บันทึกผลตามที่แข่งจริง",
            { mode : match.mode });
    }

    if(input.outcome === 'result'){
        ensureScoreData(match , input.winnerTeamId! , input.scoreData!);
    }
    const ok = await MatchResRepo.organizerDecideMatch(match , orgUserId , input.reason , WIN_POINTS,
        input.outcome === 'result'
            ? { kind : 'result' , winnerId : input.winnerTeamId! , score : input.scoreData! }
            : { kind : 'double_forfeit' });
    if(!ok){
        throw new AppError(409 , "MATCH_NOT_FINISHED" , "สถานะแมตช์เปลี่ยนไปแล้ว");
    }

    // ช่องว่างในสายที่เกิดจากการแพ้ทั้งคู่ — ทีมที่รออยู่ผ่านรอบ หรือแมตช์นั้นกลายเป็นแมตช์ตาย
    await Walkover.resolveIfOpponentWithdrawn(match.next_match_id);
    await Walkover.resolveIfOpponentWithdrawn(match.loser_next_match_id);

    await NotificationService.notifyMatchResultParties(matchId, {
        type : 'result_decided_by_organizer',
        title : input.outcome === 'result' ? 'ผู้จัดบันทึกผลการแข่งขันให้' : 'ผู้จัดตัดสินให้แพ้ทั้งสองทีม',
        message : `แมตช์ #${matchId}: ผู้จัดตัดสินเพราะไม่มีการส่งผลภายในกำหนด — เหตุผล: ${input.reason}`,
        relatedEntityType : 'match', relatedEntityId : matchId,
    }, { includeOrganizer : false });

    return { matchId , outcome : input.outcome , decidedBy : 'organizer' as const };
}

/**
 * OD-26 ข้อ 7 (มติ 26 ก.ย.) — ผลที่ส่งแล้วไม่มีใครค้าน ระบบยืนยันให้เอง
 *
 * ทำไมต้องมี: คนที่ต้องกด verify ในโหมด onsite คือหัวหน้าทีมที่ "ชนะ" ซึ่งรู้อยู่แล้วว่าชนะ
 * กดหรือไม่กดก็ไม่ได้อะไรเพิ่ม สายจึงค้างที่ขั้นที่ไม่มีใครเดือดร้อน · กฎนี้พลิกจาก
 * "ทีมแพ้ต้องกดยอมรับ" เป็น "ทีมแพ้ต้องกดค้าน" — ช่องทางค้านเปิดไม่จำกัดเวลาตั้งแต่วินาทีที่ส่งผล
 * และมีแจ้งเตือนไปหาทุกฝ่ายแล้ว การเงียบจึงถือเป็นการยอมรับได้
 *
 * ★ ใช้เฉพาะแมตช์ที่ "กรรมการ" เป็นคนส่งผล (onsite) — โหมด online คนส่งคือหัวหน้าทีมซึ่งเป็นคู่กรณี
 *   ถ้า auto-verify ให้ด้วยจะเท่ากับรับรองคำอ้างของฝ่ายหนึ่งโดยไม่เคยมีคนกลางรับรองเลย
 *   โหมด online ให้ไปใช้บันไดของข้อ 6 (กรรมการ → ผู้จัด) แทน
 *
 * ไม่มี scheduler ในระบบ จึงเช็คแบบ lazy ตอนมีคนมาเคาะประตูอยู่แล้ว (เปิดเช็คอิน/เริ่มแมตช์ถัดไป · ปิดทัวร์)
 */
export async function autoVerifyDue(matchIds : number[]): Promise<number[]>{
    const verified : number[] = [];
    for(const matchId of matchIds){
        const res = await MatchResRepo.findmatchResultByMatchId(matchId);
        if(!res || res.match_result_status !== 'submitted' || res.submitted_role !== 'referee' || res.submitted_at === null) continue;

        const match = await MatchRepo.findById(matchId);
        if(!match) continue;
        if(Date.now() < (await autoVerifyDeadline(match, res.submitted_at)).getTime()) continue;

        await MatchResRepo.verifyMatchResult(res.match_result_id , matchId , null , WIN_POINTS);
        await Walkover.resolveIfOpponentWithdrawn(match.next_match_id);
        await Walkover.resolveIfOpponentWithdrawn(match.loser_next_match_id);
        await NotificationService.notifyMatchResultParties(matchId, {
            type : 'result_auto_verified',
            title : 'ผลการแข่งขันถูกยืนยันอัตโนมัติ',
            message : `ไม่มีผู้โต้แย้งผลแมตช์ #${matchId} ระบบจึงยืนยันผลให้แล้ว หากไม่ถูกต้องยังโต้แย้งได้ตามกำหนดของทัวร์นาเมนต์`,
            relatedEntityType : 'match', relatedEntityId : matchId,
        });
        verified.push(matchId);
    }
    return verified;
}

/** เส้นตาย = อันไหนถึงก่อนระหว่าง "ก่อนแมตช์ถัดไปเริ่ม 15 นาที" กับ "X ชม.หลังส่งผล" */
async function autoVerifyDeadline(match : MatchRow , submittedAt : Date): Promise<Date>{
    const cap = new Date(submittedAt.getTime() + AUTO_VERIFY_HOURS * 3600 * 1000);
    let earliest = cap;
    for(const nextId of [match.next_match_id, match.loser_next_match_id]){
        if(nextId === null) continue;
        const next = await MatchRepo.findById(nextId);
        if(!next?.scheduled_time) continue;
        const lead = new Date(next.scheduled_time.getTime() - AUTO_VERIFY_LEAD_MINUTES * 60 * 1000);
        if(lead < earliest) earliest = lead;
    }
    return earliest;
}

export async function disputeMatchResult(matchId : number , userId : number , input : DisputeInput){
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    const match = (await MatchRepo.findById(matchId))!;

    if(input.claimedWinnerTeamId !== undefined && input.claimedScoreData !== undefined){
        ensureScoreData(match , input.claimedWinnerTeamId , input.claimedScoreData);
    }
    const evidenceKeys = input.evidenceKeys ?? null;
    if(evidenceKeys !== null && evidenceKeys.some(k => !k.startsWith(`dispute_evidence/${matchId}/`))){
        throw new AppError(400 , "VALIDATION_FAILED" , "ไฟล์หลักฐานไม่ใช่ของแมตช์นี้" ,
            { fields : { evidenceKeys : 'ต้องเป็นไฟล์ที่อัปโหลดไว้สำหรับแมตช์นี้' } });
    }

    await MatchResRepo.disputeMatchResult(matchRes!.match_result_id , matchId , userId , {
        reason : input.reason,
        claimedWinnerTeamId : input.claimedWinnerTeamId ?? null,
        claimedScore : input.claimedScoreData ?? null,
        evidenceKeys,
    });

    const disputeMatchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    await NotificationService.notifyMatchResultParties(matchId, {
        type : 'result_disputed',
        title : 'มีการโต้แย้งผลการแข่งขัน',
        message : `ผลการแข่งขันแมตช์ #${matchId} ถูกโต้แย้ง — เหตุผล: ${input.reason}`,
        relatedEntityType : 'match', relatedEntityId : matchId,
    }, { exceptUserId : userId, includeOrganizer : true });
    return toDisputeResultDto(disputeMatchRes!);
}


/**
 * S04 — ORG ตัดสินข้อโต้แย้ง (B4, 19 ก.ย.)
 *   uphold : ผลเดิมถูก ปิดเรื่อง
 *   reject : ถอนผลที่ verify ไปแล้ว (สาย/standings/stats) → แมตช์ result_rejected รอส่งใหม่ S01→S02
 *   amend  : ถอนผลเดิม + ใส่ผู้ชนะ/สกอร์ที่ ORG แก้ → verified ทันที (isAmended)
 * reject/amend ทำได้เฉพาะเมื่อแมตช์ถัดไป (next/loser_next) ยัง scheduled — ไม่งั้นทีมที่ต้องถอนออกอาจแข่ง/บายไปแล้ว
 */
export async function resolveMatchResult(matchId : number, input : ResolveInput, userId : number){
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    if(!matchRes || matchRes.match_result_status !== 'disputed'){
        throw new AppError(409 , "NO_ACTIVE_DISPUTE" , "แมตช์นี้ไม่มีข้อโต้แย้งที่รอตัดสิน");
    }
    const { resolution, resolutionNote } = input;
    const match = (await MatchRepo.findById(matchId))!;
    const tour = (await findTournamentById(match.tournament_id))!;
    const oldWinnerId = matchRes.winner_team_id!;
    // โต้แย้ง "ก่อน verify" (BR-14 จังหวะแรก) → ยังไม่มีอะไรในสาย/standings ให้ถอน · uphold ในเคสนี้ = verify แทน
    const wasVerified = matchRes.verified_at !== null;

    if(resolution === 'uphold'){
        await MatchResRepo.upholdMatchResult(matchRes.match_result_id, match, userId, resolutionNote,
            wasVerified ? null : { winnerId : oldWinnerId, sportId : tour.sport_type_id, point : WIN_POINTS });
        if(!wasVerified){
            await Walkover.resolveIfOpponentWithdrawn(match.next_match_id);
            await Walkover.resolveIfOpponentWithdrawn(match.loser_next_match_id);
        }
        await NotificationService.notifyMatchResultParties(matchId, {
            type : 'result_resolved', title : 'ผู้จัดยืนยันผลเดิม',
            message : `ผู้จัดตัดสินข้อโต้แย้งแมตช์ #${matchId} แล้ว — ยืนยันผลเดิม`,
            relatedEntityType : 'match', relatedEntityId : matchId,
        }, { exceptUserId : userId });
        return toResolveResultDto({ match_id : matchId, match_result_status : 'verified' });
    }

    if(wasVerified){
        const startedId = await findStartedNextMatchId(match);
        if(startedId !== null){
            throw new AppError(409 , "NEXT_MATCH_STARTED" ,
                `แมตช์ถัดไป #${startedId} เปิดเช็คอิน/เริ่ม/จบไปแล้ว ถอนหรือแก้ผลแมตช์นี้ไม่ได้อีก` , { nextMatchId : startedId });
        }
    }

    if(resolution === 'reject'){
        await MatchResRepo.rejectMatchResult(matchRes.match_result_id, match, oldWinnerId, tour.sport_type_id, WIN_POINTS, userId, resolutionNote, wasVerified);
        await NotificationService.notifyMatchResultParties(matchId, {
            type : 'result_resolved', title : 'ผู้จัดยกเลิกผลการแข่งขัน',
            message : `ผู้จัดตัดสินข้อโต้แย้งแมตช์ #${matchId} แล้ว — ยกเลิกผลเดิม ต้องส่งผลใหม่`,
            relatedEntityType : 'match', relatedEntityId : matchId,
        }, { exceptUserId : userId });
        return toResolveResultDto({ match_id : matchId, match_result_status : 'rejected' });
    }

    // amend — schema รับประกันว่ามี winnerTeamId/scoreData · กฎ key/ผู้ชนะ/คะแนนเดียวกับ S01
    const newWinnerId = input.winnerTeamId!;
    ensureScoreData(match , newWinnerId , input.scoreData!);
    await MatchResRepo.amendMatchResult(matchRes.match_result_id, match, oldWinnerId, newWinnerId, input.scoreData!, tour.sport_type_id, WIN_POINTS, userId, resolutionNote, wasVerified);
    if(!wasVerified || oldWinnerId !== newWinnerId){
        // ทีมที่เพิ่งถูกวางใหม่อาจเจอคู่ที่ถอนไปแล้ว — เหมือนหลัง verify
        await Walkover.resolveIfOpponentWithdrawn(match.next_match_id);
        await Walkover.resolveIfOpponentWithdrawn(match.loser_next_match_id);
    }
    await NotificationService.notifyMatchResultParties(matchId, {
        type : 'result_resolved', title : 'ผู้จัดแก้ผลการแข่งขัน',
        message : `ผู้จัดตัดสินข้อโต้แย้งแมตช์ #${matchId} แล้ว — แก้ผลการแข่งขันใหม่`,
        relatedEntityType : 'match', relatedEntityId : matchId,
    }, { exceptUserId : userId });
    return toResolveResultDto({ match_id : matchId, match_result_status : 'verified', amended : true });
}

/**
 * S05 — ผลที่ verified/walkover ใครก็อ่านได้ · ผลที่ยัง submitted/disputed/rejected อ่านได้เฉพาะ ORG / กรรมการของแมตช์ / หัวหน้า 2 ทีม
 * (ORG ตัดสิน dispute ต้องเห็นสกอร์ที่ถูกโต้แย้ง — FE gaps 19 ก.ย.) · คนอื่นได้ 404 เหมือนเดิม ไม่เผยว่ามีผลค้าง
 */
/**
 * แมตช์ถัดไปที่ขยับพ้น `scheduled` ไปแล้ว (แค่เปิดเช็คอินก็นับ) — คืน id แรกที่เจอ ไม่มี = null
 * ผลของมันคือ "ถอน/แก้ผลแมตช์นี้ไม่ได้อีก" เพราะทีมที่ต้องเอาออกอาจลงแข่งหรือได้บายไปแล้ว
 * ใช้ทั้งตอน S04 กันการแก้ผล และตอน S05 บอก FE ว่าเส้นตายจริงของการค้านคือเมื่อไร (มติ 25 ก.ย. ข้อ 3)
 */
async function findStartedNextMatchId(match : MatchRow): Promise<number | null>{
    for(const nextId of [match.next_match_id, match.loser_next_match_id]){
        if(nextId === null) continue;
        const next = await MatchRepo.findById(nextId);
        if(next && next.match_status !== 'scheduled') return nextId;
    }
    return null;
}

export async function getVerifiedResult(matchId : number , userId? : number){
    const matchRes = await MatchResRepo.findmatchResultByMatchId(matchId);
    if(!matchRes){
        throw new AppError(404 , "NOT_FOUND" , "ไม่พบข้อมูลที่ต้องการ");
    }

    const isFinal = matchRes.match_result_status === 'verified' || matchRes.match_result_status === 'walkover';
    if(!isFinal){
        if(userId === undefined || !(await canSeeUnfinishedResult(matchId , userId))){
            throw new AppError(404 , "NOT_FOUND" , "ไม่พบข้อมูลที่ต้องการ");
        }
    }

    return { ...toVerifiedResult(matchRes), ...await disputeWindowOf(matchRes) };
}

/**
 * ข้อ 3 (มติ 25 ก.ย.) — บอกเส้นตายการค้านที่ "เป็นความจริง" ไม่ใช่ 24 ชม.ลอย ๆ
 *   disputeClosesAt   เวลาที่พ้นแล้วกดค้านไม่ได้อีก · null = ยังไม่ verify (ค้านได้ไม่จำกัดเวลา) หรือค้านไม่ได้เลย (บาย/ถูกปฏิเสธ)
 *   resultChangeable  ตอนนี้ค้านแล้ว "แก้ผลได้จริง" ไหม — false เมื่อแมตช์ถัดไปขยับไปแล้ว
 *                     ยังยื่นเรื่องได้ แต่กลายเป็นการร้องเรียนที่ไม่เปลี่ยนผล (มติ 26 ก.ย. ข้อ 8) FE ต้องเปลี่ยนคำบนปุ่มตามค่านี้
 */
async function disputeWindowOf(matchRes : { match_id : number; match_result_status : string; verified_at : Date | null }){
    if(matchRes.match_result_status === 'walkover' || matchRes.match_result_status === 'rejected'){
        return { disputeClosesAt : null , resultChangeable : false };
    }
    const match = await MatchRepo.findById(matchRes.match_id);
    const resultChangeable = match !== null && (await findStartedNextMatchId(match)) === null;
    if(matchRes.verified_at === null){
        return { disputeClosesAt : null , resultChangeable };
    }
    const tour = match === null ? null : await findTournamentById(match.tournament_id);
    const hours = tour?.dispute_window_hours ?? 24;
    return { disputeClosesAt : new Date(matchRes.verified_at.getTime() + hours * 3600 * 1000).toISOString() , resultChangeable };
}

/**
 * S03b (มติ 26 ก.ย.) — ผู้จัดต้องอ่านเรื่องที่ถูกค้านได้ก่อนตัดสิน
 * เดิมข้อมูลนี้ถูกเก็บลงฐานข้อมูลแต่ไม่มี endpoint ไหนคืนออกมาเลย ผู้จัดเห็นแค่ข้อความในแจ้งเตือน
 * หลักฐานคืนเป็น presigned URL เสมอ ไม่ส่ง S3 key ดิบ (กฎรวม Part 3 ข้อ 11)
 */
export async function getDispute(matchId : number , userId : number){
    const row = await MatchResRepo.findDisputeByMatchId(matchId);
    if(!row || row.dispute_raised_at === null){
        throw new AppError(404 , "NO_ACTIVE_DISPUTE" , "แมตช์นี้ไม่มีข้อโต้แย้ง");
    }
    if(!(await canSeeUnfinishedResult(matchId , userId))){
        throw new AppError(403 , "WRONG_SUBMITTER_ROLE" , "คุณไม่มีสิทธิ์ดูข้อโต้แย้งของแมตช์นี้");
    }

    const evidence = await Promise.all((row.dispute_evidence ?? []).map(key => getPresignedDownloadUrl(key)));
    return {
        matchId,
        status : row.match_result_status,
        reason : row.dispute_reason,
        raisedBy : row.dispute_raised_by === null ? null : { id : row.dispute_raised_by , fullName : row.raised_by_name },
        raisedAt : row.dispute_raised_at.toISOString(),
        claimedWinnerTeamId : row.dispute_claimed_winner_team_id,
        claimedScoreData : row.dispute_claimed_score,
        evidence,
        resolution : row.dispute_resolution,
        resolvedAt : row.dispute_resolved_at?.toISOString() ?? null,
    };
}

async function canSeeUnfinishedResult(matchId : number , userId : number): Promise<boolean>{
    const match = await checkMatch(matchId);
    const tour = await findTournamentById(match.tournament_id);
    if(tour?.requested_by_user_id === userId) return true;
    if(await isRefereeOfMatch(matchId , userId , match.tournament_id)) return true;
    return isTeamLeaderOfMatch(matchId , userId);
}

export type recordStat = {userId : number,
                          values : {
                            statDefinitionId : number,
                            value : number
                          }[]
                        }[]


export async function updatePlayerStat(matchId: number, refId: number, playerStats: recordStat) {
    const match = await checkMatch(matchId);
    const tour = await checkTournament(match.tournament_id);
    const statDefs = await SportTypeRepo.findStatDefinitionsBySportType(tour.sport_type_id);
    const validIds = new Set(statDefs.map(d => d.sport_stat_definition_id));

    // รอบที่ 1 — validate ทุกคนให้ครบก่อน ยังไม่เขียนอะไรเลย
    for (const s of playerStats) {
        for (const v of s.values) {
            if (!validIds.has(v.statDefinitionId)) {
                throw new AppError(400, "UNKNOWN_STAT_DEFINITION", "มีรายการสถิติที่ไม่ตรงกับประเภทกีฬานี้");
            }
        }
    }

    // รอบที่ 2 — validate ว่าทุกคนอยู่ทีมจริง เก็บ teamId ไว้ใช้ต่อเลย
    const teamIdByUser = new Map<number, number>();
    for (const s of playerStats) {
        const teamResult = await TeamRepo.findTeamIdOfUserInMatch(s.userId, matchId);
        if (!teamResult) {
            throw new AppError(404, "USER_NOT_IN_MATCH", "ผู้เล่นคนนี้ไม่ได้อยู่ในทีมที่แข่งขันแมตช์นี้");
        }
        teamIdByUser.set(s.userId, teamResult.teamId);
    }

    // รอบที่ 3 — เขียน ใช้ teamId ที่เก็บไว้แล้ว ไม่ query ซ้ำ
    let recordedCount = 0;
    for (const s of playerStats) {
        recordedCount += s.values.length;
        await MatchResRepo.recordPlayerStat(matchId, s.userId, teamIdByUser.get(s.userId)!, refId, s.values);
    }
    return { matchId, recordedCount };

}

export async function getPlayerMatchStat(matchId : number){
    const allPlayer = await MatchResRepo.allPlayerInMatch(matchId);

    const items = [];
    for(const u of allPlayer){
        const stat = await MatchResRepo.showPlayerStat(matchId , u.userId)// ! ขอให้เชื่อเพราะว่าไปเอา userId ที่อยู่ใน Player match stat มา
        items.push(toPlayerMatchStat({userId : u.userId , fullName : u.fullName} , stat));
    }

    return { items : items};
}

/**
 * B1 — หาแชมป์ตอน ORG ปิดทัวร์ (ทุกแมตช์ completed แล้ว)
 *   round_robin: อันดับ 1 ของตาราง · เสมออันดับ 1 ทุกเกณฑ์ → null (ไม่ตัดสินแทน ORG)
 *   elimination: ผู้ชนะแมตช์ที่ไม่มี next_match_id · รอบชิงแพ้ทั้งคู่ → null
 */
export async function resolveChampionTeamId(tour : TournamentRow) : Promise<number | null>{
    if(tour.bracket_format === 'round_robin'){
        const items = rankStandings(await MatchResRepo.findStandings(tour.tournament_id));
        if(items.length === 0) return null;
        if(items.length > 1 && items[1]!.rank === 1) return null;
        return items[0]!.team.id;
    }
    const finalResult = await MatchResRepo.findFinalMatchResult(tour.tournament_id);
    return finalResult?.winner_team_id ?? null;
}

export async function getChampion(tourId : number){
    const tour = await checkTournament(tourId);
    if(tour.tournament_status !== 'completed'){
        throw new AppError(404 , "NOT_FOUND" , "ทัวร์นาเมนต์นี้ยังไม่จบการแข่งขัน");
    }
    const completedAt = tour.completed_at ? tour.completed_at.toISOString() : tour.event_end_date;

    // round robin — แชมป์/รองแชมป์จากตาราง ไม่มี "รอบชิง"
    if(tour.bracket_format === 'round_robin'){
        const items = rankStandings(await MatchResRepo.findStandings(tourId));
        const champion = tour.champion_team_id === null ? null : items.find(i => i.team.id === tour.champion_team_id) ?? null;
        const runnerUp = champion ? items.find(i => i.team.id !== champion.team.id) ?? null : null;
        return toTournamentWinnerDto(champion?.team ?? null, runnerUp?.team ?? null, null, completedAt, false);
    }

    const finalResult = await MatchResRepo.findFinalMatchResult(tourId);
    if(!finalResult){
        throw new AppError(404 , "NOT_FOUND" , "ไม่พบแมตช์สุดท้ายของทัวร์นาเมนต์นี้");
    }

    const isWalkover = finalResult.match_result_status === 'walkover';

    // รอบชิงแพ้ทั้งคู่ (M17 ไม่มาตามนัดทั้งสองทีม) → ไม่มีแชมป์/รองแชมป์ (GUIDE/11 §10.5) · แชมป์ที่เก็บไว้ตอนปิดทัวร์เป็นหลัก
    const championTeamId = tour.champion_team_id ?? finalResult.winner_team_id;
    if(championTeamId === null){
        return toTournamentWinnerDto(null, null, null, completedAt, isWalkover);
    }

    const runnerUpTeamId = finalResult.team_a_id === championTeamId
        ? finalResult.team_b_id
        : finalResult.team_a_id;

    const championRow = await checkTeam(championTeamId);
    // รอบชิงที่คู่แข่งว่างถาวร (dead slot) ไม่มีรองแชมป์
    const runnerUpRow = runnerUpTeamId === null ? null : await TeamRepo.findById(runnerUpTeamId);

    return toTournamentWinnerDto(
        toTeamRef(championRow),
        runnerUpRow ? toTeamRef(runnerUpRow) : null,
        finalResult.score_data,
        completedAt,
        isWalkover
    );
}

export async function getDashboard(tourId : number){
    await checkTournament(tourId);

    const teamCount = await MatchResRepo.countApprovedTeams(tourId);
    const playerCount = await MatchResRepo.countApprovedPlayers(tourId);
    const { matchCount, matchesCompleted } = await MatchResRepo.countMatches(tourId);

    return { teamCount, playerCount, matchCount, matchesCompleted };
}

/**
 * ข้อ 1 (มติ 26 ก.ย.) — ตารางคะแนนต้องบอกด้วยว่าตัวเลขนี้ยังเปลี่ยนได้ไหม
 * round robin ทุกแมตช์ป้อนตารางเดียวกัน แมตช์เดียวที่ถูกค้างไว้จึงสลับอันดับได้ทั้งตาราง
 * isProvisional = false เมื่อไม่มีแมตช์ค้างแล้ว (ซึ่งคือเงื่อนไขเดียวกับที่ปิดทัวร์ได้) จึงใช้เป็นสัญญาณ "อันดับเป็นทางการ" ได้เลย
 */
export async function getStandings(tourId : number){
    await checkTournament(tourId);

    const rows = await MatchResRepo.findStandings(tourId);
    const items = rankStandings(rows);
    const pending = await TournamentRepo.findUnfinishedMatchIds(tourId);

    return {
        items,
        isProvisional : pending.length > 0,
        pendingMatches : pending.map(m => ({ id : m.match_id , status : m.match_status })),
    };
}

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+)/;

export async function updateLivestream(matchId : number , youtubeUrl : string | null){
    await checkMatch(matchId);

    if(youtubeUrl !== null && !YOUTUBE_URL_REGEX.test(youtubeUrl)){
        throw new AppError(400 , "INVALID_YOUTUBE_URL" , "ลิงก์ YouTube ไม่ถูกต้อง");
    }

    await MatchRepo.updateLivestreamUrl(matchId , youtubeUrl);
    return { matchId , youtubeUrl };
}