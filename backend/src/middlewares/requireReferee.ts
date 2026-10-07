import * as MatchResRepo from '../repositories/matchResult.repo.js';
import type { Request , Response , NextFunction } from "express";
import * as RefereeRepo from '../repositories/tournamentReferee.repo.js';
import * as MatchRefereeRepo from '../repositories/matchReferee.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import * as TeamRepo from '../repositories/team.repo.js';
import * as TourRepo from '../repositories/tournament.repo.js';
import * as SportTypeRepo from '../repositories/sportType.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';

import { findActiveRefereeRow, refereesNeededPerMatch } from "../services/referee.service.js";

import { isSubmitEscalationOpen } from "../utils/escalation.js";
import { checkMatch, checkMatchResult } from "../utils/checkExist.js";
import { parseId } from "../utils/parseId.js";
import { AppError } from "../utils/AppError.js";
import type { MatchResultRow, MatchRow } from "../types/db.js";

export async function isRefereeOfMatch(matchId: number, userId: number, tournamentId: number): Promise<boolean> {
    // ★ ถามจากทุกแถวที่ active ไม่ใช่แถวล่าสุดตาม id (แก้ 1 ต.ค. 2569)
    // แถวล่าสุดอาจเป็นแถวที่แอดมินปฏิเสธตัวตน ขณะที่แถวเก่า approved ยัง active
    // — กรรมการคนนั้นมีสิทธิ์คุมแมตช์อยู่ เดิมจะตอบว่าไม่ใช่
    if (!(await findActiveRefereeRow(tournamentId, userId))) return false;

    const assignReferee = await MatchRefereeRepo.findByMatch(matchId);
    return assignReferee.some(r => r.user_id === userId); 
}

export async function isTeamLeaderOfMatch(matchId: number , userId : number):Promise<boolean>{
    const match = await checkMatch(matchId);

    if (match.team_a_id !== null) {
        const teamA = await TeamRepo.findById(match.team_a_id);
        if (teamA?.leader_id === userId) return true;
    }

    if (match.team_b_id !== null){
        const teamB = await TeamRepo.findById(match.team_b_id);
        if (teamB?.leader_id === userId) return true;
    }

    return false;
}

export async function isLeaderOfTeam(winnerTeamId : number , userId : number): Promise<boolean>{
    const team = await TeamRepo.findById(winnerTeamId);
    return team!.leader_id === userId ? true : false;
}

/**
 * BR-14 — โต้แย้งได้ 2 จังหวะ (spec 07 §6/§8): ก่อน verify (ฝ่ายที่ต้องยืนยันเลือกโต้แย้งแทน — ไม่มีกำหนดเวลา)
 * และหลัง verify ภายใน dispute_window_hours นับจาก verified_at · FE-disputing-result-yet-verified (20 ก.ย.): เดิมอ่าน verified_at ที่ NULL → 500
 */
export async function isDisputeWindow(tourId : number , matchRes : MatchResultRow): Promise<boolean>{
    if(matchRes.verified_at === null) return true;
    const tour = await TourRepo.findTournamentById(tourId);
    const deadline = new Date(matchRes.verified_at.getTime() + tour!.dispute_window_hours * 3600 * 1000)

    if( new Date() > deadline){
        return false
    }
    return true;
}

/** แมตช์นี้มีกรรมการ active ครบตามประเภทไหม — on-site+stat = 2, อื่น (รวม online) = 1 · กฎอยู่ที่ refereesNeededPerMatch */
export async function isRefereeSufficient(match : MatchRow) : Promise<boolean> {
    const tournament = await TournamentRepo.findTournamentById(match.tournament_id);
    if (!tournament) return false;

    const needed = await refereesNeededPerMatch(tournament.sport_type_id);
    const acceptedCount = await MatchRefereeRepo.countAcceptedByMatch(match.match_id);
    return acceptedCount >= needed(match.mode);
}




export async function requireCanSubmitResult(req : Request , res : Response , next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
        }

        const matchId = parseId(req.params['id'] , "รหัสการแข่งขัน" , "id");
        const match = await checkMatch(matchId);

        if(match.team_a_id === null || match.team_b_id === null){
            return next(new AppError(409, "MATCH_TEAMS_INCOMPLETE", "แมตช์นี้ยังไม่มีทีมครบทั้งสองฝั่ง ยังไม่สามารถส่งผลการแข่งขันได้"));
        }

        // OD-26 ข้อ 2+4 (มติ 26 ก.ย.) — ต้องกด "จบการแข่งขัน" ก่อนถึงส่งผลได้
        // เดิมด่านนี้ไม่เช็ค match_status เลย ส่งผลแมตช์ที่ยัง scheduled (ยังไม่เปิดเช็คอินด้วยซ้ำ) ก็ยังได้
        // result_rejected = ผลถูก ORG ถอน แมตช์แข่งจบไปแล้วจริง จึงส่งใหม่ได้โดยไม่ต้องกดจบซ้ำ
        if(match.match_status !== 'finished' && match.match_status !== 'result_rejected'){
            return next(new AppError(409, "MATCH_NOT_FINISHED",
                "ต้องกดจบการแข่งขันก่อนถึงจะส่งผลได้", { status : match.match_status }));
        }

        // B4: ส่งซ้ำได้เฉพาะตอนยังไม่ถูก verify หรือถูก reject แล้ว — ผลที่ verified/disputed/walkover แก้ผ่าน S04 เท่านั้น
        const existing = await MatchResRepo.findmatchResultByMatchId(matchId);
        if(existing && existing.match_result_status !== 'submitted' && existing.match_result_status !== 'rejected'){
            return next(new AppError(409, "MATCH_RESULT_ALREADY_VERIFIED", "ผลแมตช์นี้ถูกยืนยันแล้ว แก้ไขได้ผ่านการโต้แย้ง (S03) เท่านั้น"));
        }

        if (match.mode === 'onsite') {
            if (!(await isRefereeOfMatch(matchId, req.user.user_id, match.tournament_id))) {
                return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้")); 
            }
            req.submitrole = 'referee';

        } else if(match.mode === 'online') {
            if (await isTeamLeaderOfMatch(matchId, req.user.user_id)) {
                req.submitrole = 'team_leader';
            } else if (isSubmitEscalationOpen(match) && await isRefereeOfMatch(matchId, req.user.user_id, match.tournament_id)) {
                // OD-26 ข้อ 6 ขั้นแรก (มติ 26 ก.ย.) — โหมด online ปกติมีแต่หัวหน้าทีมที่ส่งผลได้
                // ถ้าทั้งสองฝ่ายเงียบจนพ้นกำหนด ให้กรรมการของแมตช์ (คนกลางที่ดูเกมอยู่) ส่งแทนได้
                // ยังเป็นกรรมการส่ง–อีกฝ่ายยืนยัน จึงไม่เสียหลัก "คนส่ง ≠ คนยืนยัน"
                req.submitrole = 'referee';
            } else {
                return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้"));
            }
        }

        next();

    }catch (err){
        next(err);
    }
}

export async function requireCanVerifyResult(req : Request , res : Response , next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
        }


        const matchId = parseId(req.params['id'] , "รหัสการแข่งขัน" , "id");

        const match = await checkMatch(matchId);
        const matchRes = await checkMatchResult(matchId);

        if(matchRes.match_result_status !== 'submitted'){
            return next(new AppError(409 , "MATCH_RESULT_ALREADY_VERIFIED" , "การแข่งขันถูก verify แล้ว"));
        }

        if(req.user.user_id ===  matchRes!.submitted_by_user_id){
            return next(new AppError(403 , "SAME_PERSON_CANNOT_VERIFY" , "ผู้ยืนยันต้องไม่ใช่คนเดียวกับผู้ส่งผล"));
        }

        if(match.mode === 'online'){
            /**
             * OD-55 (4 ต.ค.) — ผู้ยืนยันคือ **ฝ่ายที่ไม่ได้เขียนผล** ไม่ใช่ "ต้องเป็นกรรมการ" เสมอ
             *
             * ★ เดิมบรรทัดนี้บังคับ isRefereeOfMatch ตายตัว เพราะเขียนไว้ตอนที่สมมติฐานคือ
             *   "โหมด online ทีมเป็นคนส่งผลเสมอ" ⇒ ผู้ยืนยันก็ต้องเป็นกรรมการเสมอ
             *   แต่หลังมี S02b (กรรมการเขียนทับ) และบันไดข้อ 6 (กรรมการส่งแทนเมื่อทีมเงียบ)
             *   สมมติฐานนั้นไม่จริงแล้ว — ถ้ายังบังคับกรรมการ จะไม่มีใครกดยืนยันได้เลย
             *   (กรรมการคนที่ส่งติด SAME_PERSON ข้างบน · online ต้องการกรรมการแค่ 1 คน)
             *   ⇒ ผลค้างรอ auto-verify อย่างเดียว ปิดเร็วไม่ได้แม้ทั้งสองทีมเห็นด้วย
             *
             * กฎที่ถูกคือกฎเดียวกับ onsite: ใครเขียน อีกฝ่ายรับรอง
             *   submitted_role = 'team_leader'  →  กรรมการของแมตช์รับรอง
             *   submitted_role = 'referee'      →  หัวหน้าทีมรับรอง
             *
             * ★ "หัวหน้าทีมฝ่ายไหนก็ได้" (มติ 4 ต.ค.) ต่างจาก onsite ที่บังคับฝ่ายที่ชนะ
             *   เพราะที่นี่ผลที่รอรับรองมาจากคนกลาง ไม่ใช่จากคู่กรณี ⇒ ฝ่ายที่แพ้กดรับรอง
             *   ก็คือการยอมรับผลที่ตัวเองเสียเปรียบ ซึ่งไม่มีเหตุให้ต้องกันไว้
             *   และถ้าไม่ยอมก็ไม่ต้องกด — ไปโต้แย้ง (S03) ได้ตามปกติ
             */
            const verifierMustBeTeamLeader = matchRes.submitted_role === 'referee';
            const ok = verifierMustBeTeamLeader
                     ? await isTeamLeaderOfMatch(matchId, req.user.user_id)
                     : await isRefereeOfMatch(matchId, req.user.user_id, match.tournament_id);

            if(!ok){
                return next(new AppError(403, "WRONG_SUBMITTER_ROLE",
                    verifierMustBeTeamLeader
                        ? "ผลนี้กรรมการเป็นผู้ส่ง ผู้ยืนยันต้องเป็นหัวหน้าทีมที่ลงแข่งในแมตช์นี้"
                        : "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้"));
            }
            req.match = match
            req.matchResult = matchRes!

        } else if(match.mode === 'onsite'){
            if(!(await isLeaderOfTeam(matchRes!.winner_team_id!, req.user.user_id))){
                return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้"));
            }
            req.match = match
            req.matchResult = matchRes!

        }

        next();

    }catch(err){
        next(err);
    }
}


/**
 * S02b (OD-55 · 4 ต.ค.) — กรรมการเขียนผลทับในโหมด online
 *
 * ★ เฉพาะ online: ที่นั่นคนส่งผลคือหัวหน้าทีมซึ่งเป็น **คู่กรณี** และกรรมการเป็นคนกลาง
 *   ⇒ ให้คนกลางแก้ไม่ใช่การเอื้อประโยชน์ตัวเอง และเป็นอำนาจเดียวกับที่กรรมการมีใน onsite อยู่แล้ว
 *   โหมด onsite ห้ามใช้เส้นนี้ — ที่นั่นกรรมการเป็นคนเขียนผลเองตั้งแต่ต้น (S01)
 *   ถ้าเขียนผิดก็แก้ด้วยการส่งใหม่ได้เลยตอนยังไม่ถูก verify ไม่ต้องมีเส้นพิเศษ
 *
 * ★ เฉพาะ `submitted` (มติ 4 ต.ค. ข้อ ①) — ที่ verified แล้วห้ามแตะ
 *   เพราะสาย (next_match_id) และตารางคะแนนขยับไปแล้ว การถอนต้องผ่าน S03/S04
 *   ที่มีกลไกถอนผลครบ (undoOutcomeTx) และมีด่าน NEXT_MATCH_STARTED กันของที่ถอนไม่ได้
 */
export async function requireCanOverrideResult(req : Request , res : Response , next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
        }

        const matchId = parseId(req.params['id'] , "รหัสการแข่งขัน" , "id");
        const match = await checkMatch(matchId);

        if(match.mode !== 'online'){
            return next(new AppError(409 , "OVERRIDE_ONSITE_NOT_ALLOWED" ,
                "โหมด on-site กรรมการเป็นผู้ส่งผลเองอยู่แล้ว ถ้าผลยังไม่ถูกยืนยันให้ส่งผลใหม่ทับได้เลย" ,
                { mode : match.mode }));
        }

        const matchRes = await checkMatchResult(matchId);
        if(matchRes.match_result_status !== 'submitted'){
            return next(new AppError(409 , "RESULT_NOT_OVERRIDABLE" ,
                "แก้ผลทับได้เฉพาะผลที่ยังรอการยืนยัน — ผลที่ยืนยันแล้วต้องใช้การโต้แย้ง (S03)" ,
                { status : matchRes.match_result_status }));
        }

        if(!(await isRefereeOfMatch(matchId , req.user.user_id , match.tournament_id))){
            return next(new AppError(403 , "WRONG_SUBMITTER_ROLE" , "เฉพาะกรรมการของแมตช์นี้เท่านั้นที่แก้ผลทับได้"));
        }

        req.match = match;
        req.matchResult = matchRes;
        next();

    }catch(err){
        next(err);
    }
}

/**
 * ★ กรรมการค้านได้ด้วย — **ไม่ซ้ำซ้อนกับ S02b (override) อ่าน OD-55 ก่อนลบ**
 *
 * สองเส้นทับกันแค่สถานะ `submitted` + online เท่านั้น · นอกจากนั้น override ทำไม่ได้เลย:
 *   `verified` (รวมที่ auto-verify ปิดให้) → 409 RESULT_NOT_OVERRIDABLE
 *   onsite ทุกสถานะ                     → 409 OVERRIDE_ONSITE_NOT_ALLOWED
 *
 * และในช่องที่ทับกันก็ยังคนละงาน: override บังคับ winnerTeamId + scoreData
 * ⇒ ทำได้เมื่อรู้ผลที่ถูกเท่านั้น · ส่วน dispute สกอร์เป็น optional และแนบหลักฐานได้ 5 ไฟล์
 * ⇒ เคส "รู้ว่าผิดแต่ไม่รู้ว่าอะไรคือสิ่งที่ถูก" (ผู้เล่นไม่มีสิทธิ์ · สงสัยโกง · ควรแข่งใหม่)
 *   มีเส้นนี้เส้นเดียว — รายละเอียดอยู่ใน OD-55 หัวข้อ "dispute ของกรรมการยังต้องมีอยู่"
 */
export async function requireCanDisputeResult(req : Request , res : Response , next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
        }

        const matchId = parseId(req.params['id'] , "รหัสการแข่งขัน" , "id");
        const match = await checkMatch(matchId)
        const matchRes = await checkMatchResult(matchId);

        if(matchRes.match_result_status === 'disputed'){
            return next(new AppError(409 , "DISPUTE_ALREADY_ACTIVE" , "มีข้อโต้แย้งที่ยังไม่ได้ข้อยุติอยู่แล้ว"));
        }
        // ผลบาย (ทีมถอน/ไม่มาแข่ง) ไม่มีสกอร์จริงให้เถียง — GUIDE/11 §10.4
        if(matchRes.match_result_status === 'walkover'){
            return next(new AppError(409 , "RESULT_IS_WALKOVER" , "ผลนี้เป็นการชนะบาย ไม่สามารถโต้แย้งได้"));
        }
        // ผลที่ถูก reject ไปแล้วไม่มีอะไรให้โต้แย้ง — รอผู้ส่งส่งใหม่ (S01)
        if(matchRes.match_result_status === 'rejected'){
            return next(new AppError(409 , "RESULT_REJECTED" , "ผลนี้ถูกปฏิเสธไปแล้ว รอการส่งผลใหม่"));
        }

        if(!(await isDisputeWindow(match!.tournament_id , matchRes))){
            return next(new AppError(409 , "DISPUTE_WINDOW_CLOSED" , "พ้นระยะเวลาที่เปิดให้โต้แย้งผลแล้ว"));
        }

        if (!(await isRefereeOfMatch(matchId, req.user.user_id, match.tournament_id)) && !(await isTeamLeaderOfMatch(matchId, req.user.user_id))) {
            return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้")); 
        }

        /**
         * 🔴 BE-17 (แก้ 7 ต.ค. 2569 · มติ ⑤ ก) — คนที่ส่งผลเอง โต้แย้งผลของตัวเองได้
         *
         * QA: กรรมการส่งผล → หัวหน้าทีมยืนยัน → **กรรมการคนเดิม** กดโต้แย้ง ได้ 200
         * สถานะกลับเป็น `disputed` ทั้งที่ผลผ่านการตรวจสอบครบวงจรแล้ว
         * ⇒ ขัดกับหลักที่ระบบบังคับทุกที่ว่า **คนส่งผล ≠ คนยืนยัน**: ถ้าคนส่งค้านเองได้
         *   เท่ากับเขาพลิกผลที่คนอื่นยืนยันแล้วได้ฝ่ายเดียว โดยข้ามกลไกตรวจสอบ
         *
         * ★ ปิดแค่ "คนที่ส่งผลนั้น" ไม่ใช่กรรมการทั้งหมด — กรรมการคนที่สองต้องค้านผลของ
         *   คนแรกได้ (เป็นเหตุผลที่แมตช์ on-site ใช้กรรมการ 2 คน)
         * ★ ทางที่ถูกสำหรับกรรมการที่กรอกผลผิดเองคือแก้ผลทับ (S02b) ซึ่งบังคับ `reason`
         *   และยิงแจ้งเตือนให้ทีมที่ถูกเขียนทับรู้ตัว — ไม่ใช่การค้านผลตัวเอง
         *
         * ═══ 🔴 แก้ข้อความ 7 ต.ค. 2569 (FE ทักมา · มติ ② ก) ═══
         * ข้อความเดิมเขียนลอย ๆ ว่า "ให้แก้ผลทับพร้อมระบุเหตุผล" ซึ่ง**ใช้ได้เฉพาะตอน
         * ผลยังไม่ถูกยืนยัน** · แต่ฉากของ BE-17 คือผลถูกยืนยันไปแล้ว ตอนนั้น
         *   ส่งผลใหม่ทับ → 409 MATCH_RESULT_ALREADY_VERIFIED
         *   override     → 409 RESULT_NOT_OVERRIDABLE (และ onsite ยังติด OVERRIDE_ONSITE_NOT_ALLOWED)
         * ⇒ คำแนะนำเดิมพาไปทางตัน ซึ่งแย่กว่าไม่แนะนำอะไรเลย
         *
         * ★ FE ขอให้ทำข้อความ "ตามโหมด" แต่ตัวแยกจริงคือ **สถานะของผล** ไม่ใช่โหมด:
         *   ยังไม่ยืนยัน → แก้เองได้ (onsite ส่งทับ · online override) ⇒ โหมดบอกแค่ว่าไปจอไหน
         *   ยืนยันแล้ว   → แก้เองไม่ได้ทั้งสองโหมด ⇒ ต้องให้คนอื่นเป็นผู้โต้แย้ง
         * ★ ถึงบรรทัดนี้สถานะเหลือได้แค่ submitted / verified เท่านั้น
         *   (disputed · walkover · rejected ถูกตอบกลับไปข้างบนแล้ว)
         * ★ คืน `resultStatus` + `mode` ใน extra เพื่อให้ FE พาไปหน้าที่ถูกได้ตรง ๆ
         *   ไม่ต้องเดาจากข้อความ
         */
        if(matchRes.submitted_by_user_id === req.user.user_id){
            const stillEditable = matchRes.match_result_status === 'submitted';
            const how = stillEditable
                ? (match.mode === 'online'
                    ? "ผลนี้ยังไม่ถูกยืนยัน — ถ้ากรอกผิด ให้แก้ผลทับพร้อมระบุเหตุผล"
                    : "ผลนี้ยังไม่ถูกยืนยัน — ถ้ากรอกผิด ให้ส่งผลใหม่ทับได้เลย")
                : "ผลนี้ถูกยืนยันแล้ว แก้เองไม่ได้ — ให้หัวหน้าทีมหรือกรรมการอีกคนเป็นผู้โต้แย้ง หรือยื่นเรื่องร้องเรียนผลเมื่อพ้นระยะโต้แย้ง";
            return next(new AppError(403, "CANNOT_DISPUTE_OWN_RESULT",
                `คุณเป็นผู้ส่งผลนี้เอง จึงโต้แย้งผลของตัวเองไม่ได้ — ${how}`,
                { resultStatus : matchRes.match_result_status , mode : match.mode }));
        }

        next();

    } catch(err){
        next(err);
    }
}

export async function requireCanRecordStats(req : Request , res : Response , next : NextFunction){
    try{
        if(!req.user){
            return next(new AppError(401 , "NO_TOKEN" , "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
        }

        const matchId = parseId(req.params['id'] , "รหัสการแข่งขัน" , "id");
        const match = await checkMatch(matchId)

        if(match.mode === 'onsite'){
            if(!(await isRefereeSufficient(match))){
                return next(new AppError(409 , "INSUFFICIENT_REFEREES" , "ต้องมีกรรมการยืนยันแล้วอย่างน้อย 2 คนสําหรับการแข่งแบบ on-site ที่บันทึกสถิติ"));
            }
        }

        if (!(await isRefereeOfMatch(matchId , req.user.user_id , match.tournament_id))){
                        return next(new AppError(403, "WRONG_SUBMITTER_ROLE", "ตามโหมดการแข่งขันนี้ คุณไม่ใช่ผู้ที่ส่งผลได้")); 
        }

        next();
    }catch(err){
        next(err);
    }
}

/**
 * กรรมการของแมตช์ (ใช้กับ start / verify / reject check-in ใน match.routes)
 * = active ในทัวร์ (isActiveReferee) + รับมอบหมายแมตช์นี้แล้ว (match_referees accepted) — ผ่าน isRefereeOfMatch
 * ★ กฎเดียวกับ F12/S01-S03 (GUIDE/11) — กรรมการของทัวร์ที่ไม่ได้รับแมตช์นี้ ทำไม่ได้
 */
export async function requireReferee(req : Request, res : Response, next : NextFunction){
    if(!req.user){
        return next(new AppError(401, "NO_TOKEN", "กรุณาเข้าสู่ระบบก่อนใช้งาน"));
    }

    const matchId = parseId(req.params['id'], 'รหัสการแข่งขัน');
    const match = await MatchRepo.findById(matchId);
    if(!match){
        return next(new AppError(404, "MATCH_NOT_FOUND", "ไม่พบแมตช์นี้"));
    }

    if(!(await isRefereeOfMatch(matchId, req.user.user_id, match.tournament_id))){
        return next(new AppError(403, "NOT_REFEREE", "คุณไม่ได้เป็นกรรมการของแมตช์นี้"));
    }

    req.match = match;
    next();
}
