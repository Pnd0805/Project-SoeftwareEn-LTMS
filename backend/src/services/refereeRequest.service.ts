import * as ReqRepo from '../repositories/refereeChangeRequest.repo.js';
import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import * as MatchRefRepo from '../repositories/matchReferee.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import { AppError } from '../utils/AppError.js';
import { assertSchedulable, isActiveReferee } from './referee.service.js';
import type { Schedulable } from './referee.service.js';
import { toRefereeRequestDto } from '../mappers/refereeRequest.mapper.js';
import type { RefRequestInput, OrgAddMatchInput, OrgSwapInput } from '../schemas/refereeRequest.schema.js';
import type { MatchRow, RefereeChangeRequestRow, TournamentRefereeRow } from '../types/db.js';
import * as NotificationService from './notification.service.js';

// ───────────────────────────── helpers ─────────────────────────────

/** กรรมการต้องอยู่ทัวร์นี้และ active (ตอบรับแล้ว + admin อนุมัติแล้วถ้าเป็นคนนอก) */
async function loadActiveReferee(tournamentRefereeId : number, tournamentId : number): Promise<TournamentRefereeRow>{
    const tr = await RefRepo.findById(tournamentRefereeId);
    if(!tr || tr.tournament_id !== tournamentId || tr.removed_at !== null){
        throw new AppError(404, 'REFEREE_NOT_FOUND', 'ไม่พบกรรมการคนนี้ในทัวร์นาเมนต์นี้');
    }
    if(!isActiveReferee(tr)){
        throw new AppError(409, 'REFEREE_NOT_ACTIVE', 'กรรมการคนนี้ยังไม่พร้อมรับแมตช์ (ยังไม่ตอบรับ หรือรอผู้ดูแลระบบอนุมัติ)');
    }
    return tr;
}

async function loadMatchInTournament(matchId : number, tournamentId : number): Promise<MatchRow>{
    const match = await MatchRepo.findById(matchId);
    if(!match || match.tournament_id !== tournamentId){
        throw new AppError(404, 'MATCH_NOT_FOUND', 'ไม่พบแมตช์นี้ในทัวร์นาเมนต์นี้');
    }
    return match;
}

/** เปลี่ยนกรรมการได้เฉพาะแมตช์ที่ยังไม่เริ่ม (§5.3) */
function assertMatchChangeable(match : MatchRow): void {
    if(match.match_status !== 'scheduled' || !match.scheduled_time || !match.scheduled_end_time){
        throw new AppError(409, 'MATCH_NOT_CHANGEABLE', `แมตช์ #${match.match_id} เริ่มไปแล้วหรือยังไม่ได้กำหนดเวลา เปลี่ยนกรรมการไม่ได้`);
    }
    if(match.scheduled_time.getTime() <= Date.now()){
        throw new AppError(409, 'MATCH_NOT_CHANGEABLE', `แมตช์ #${match.match_id} ถึงเวลาแข่งแล้ว เปลี่ยนกรรมการไม่ได้`);
    }
}

/** แมตช์ที่กรรมการคนนี้รับอยู่ตอนนี้ */
async function acceptedMatchesOf(tournamentRefereeId : number): Promise<Schedulable[]>{
    const rows = await MatchRefRepo.findByTournamentReferees([tournamentRefereeId]);
    return rows.filter(r => r.assignment_status === 'accepted');
}

function assertAssigned(accepted : Schedulable[], matchId : number, who : string): void {
    if(!accepted.some(m => m.match_id === matchId)){
        throw new AppError(409, 'REFEREE_NOT_ASSIGNED', `${who}ไม่ได้รับผิดชอบแมตช์ #${matchId} อยู่`);
    }
}

/** ตารางของกรรมการหลังเปลี่ยน (ตัดที่จะให้ออก เพิ่มที่จะรับ) ต้องไม่ซ้อนเวลา */
async function assertNoConflictAfter(tournamentRefereeId : number, gain : Schedulable[], loseIds : number[]): Promise<void>{
    const current = await acceptedMatchesOf(tournamentRefereeId);
    assertSchedulable([...current.filter(m => !loseIds.includes(m.match_id)), ...gain]);
}

async function assertNoOpenDuplicate(matchAId : number, refereeAId : number): Promise<void>{
    if(await ReqRepo.existsOpenFor(matchAId, refereeAId)){
        throw new AppError(409, 'REQUEST_ALREADY_OPEN', 'มีคำขอเกี่ยวกับแมตช์นี้ของกรรมการคนนี้ที่ยังรอตอบอยู่แล้ว');
    }
}

async function dtoOf(requestId : number){
    const row = await ReqRepo.findListRowById(requestId);
    if(!row) throw new AppError(404, 'REQUEST_NOT_FOUND', 'ไม่พบคำขอนี้');
    return toRefereeRequestDto(row);
}

// ───────────────────────────── FR01 · REF โอน/แลก ─────────────────────────────

export async function createRefRequest(userId : number, input : RefRequestInput){
    const myMatch = await MatchRepo.findById(input.myMatchId);
    if(!myMatch) throw new AppError(404, 'MATCH_NOT_FOUND', 'ไม่พบแมตช์นี้');
    const tournamentId = myMatch.tournament_id;

    // A = ตัวเรา (แถวล่าสุดในทัวร์นี้ ต้อง active)
    const a = await RefRepo.findLatestByTournamentAndUser(tournamentId, userId);
    if(!a || a.removed_at !== null || !isActiveReferee(a)){
        throw new AppError(403, 'NOT_TOURNAMENT_REFEREE', 'คุณไม่ได้เป็นกรรมการของทัวร์นาเมนต์นี้');
    }
    const b = await loadActiveReferee(input.toTournamentRefereeId, tournamentId);
    if(b.tournament_referee_id === a.tournament_referee_id){
        throw new AppError(400, 'SAME_REFEREE', 'โอน/แลกกับตัวเองไม่ได้');
    }

    const myAccepted = await acceptedMatchesOf(a.tournament_referee_id);
    assertAssigned(myAccepted, myMatch.match_id, 'คุณ');
    assertMatchChangeable(myMatch);

    let theirMatch : MatchRow | null = null;
    if(input.theirMatchId !== undefined){
        if(input.theirMatchId === myMatch.match_id){
            throw new AppError(400, 'SAME_MATCH', 'แลกแมตช์เดียวกันไม่ได้');
        }
        theirMatch = await loadMatchInTournament(input.theirMatchId, tournamentId);
        assertAssigned(await acceptedMatchesOf(b.tournament_referee_id), theirMatch.match_id, 'อีกฝ่าย');
        assertMatchChangeable(theirMatch);
    }

    await assertNoOpenDuplicate(myMatch.match_id, a.tournament_referee_id);

    // หลังโอน/แลก ตารางของทั้งคู่ต้องไม่ซ้อน
    await assertNoConflictAfter(b.tournament_referee_id, [myMatch], theirMatch ? [theirMatch.match_id] : []);
    if(theirMatch){
        await assertNoConflictAfter(a.tournament_referee_id, [theirMatch], [myMatch.match_id]);
    }

    const id = await ReqRepo.create({
        tournamentId, type : theirMatch ? 'ref_swap' : 'ref_transfer', requestedBy : userId,
        refereeAId : a.tournament_referee_id, refereeBId : b.tournament_referee_id,
        matchAId : myMatch.match_id, matchBId : theirMatch?.match_id ?? null,
        aStatus : 'accepted',      // คนขอถือว่าตกลงแล้ว
        bStatus : 'pending'
    });
    await NotificationService.notify({
        userId : b.user_id, type : 'referee_change_request',
        title : theirMatch ? 'มีคำขอแลกแมตช์กรรมการ' : 'มีคำขอโอนแมตช์กรรมการ',
        message : theirMatch
            ? `กรรมการอีกคนขอแลกแมตช์ #${myMatch.match_id} กับแมตช์ #${theirMatch.match_id} ของคุณ`
            : `กรรมการอีกคนขอโอนแมตช์ #${myMatch.match_id} ให้คุณ`,
        relatedEntityType : 'match', relatedEntityId : myMatch.match_id,
    });
    return dtoOf(id);
}

// ───────────────────────────── FR02 · ORG ขอเพิ่มแมตช์ ─────────────────────────────

export async function createOrgAddMatch(tournamentId : number, userId : number, input : OrgAddMatchInput){
    const a = await loadActiveReferee(input.tournamentRefereeId, tournamentId);
    const match = await loadMatchInTournament(input.matchId, tournamentId);
    assertMatchChangeable(match);

    const accepted = await acceptedMatchesOf(a.tournament_referee_id);
    if(accepted.some(m => m.match_id === match.match_id)){
        throw new AppError(409, 'REFEREE_ALREADY_ASSIGNED', 'กรรมการคนนี้รับผิดชอบแมตช์นี้อยู่แล้ว');
    }
    await assertNoOpenDuplicate(match.match_id, a.tournament_referee_id);
    await assertNoConflictAfter(a.tournament_referee_id, [match], []);

    const id = await ReqRepo.create({
        tournamentId, type : 'org_add_match', requestedBy : userId,
        refereeAId : a.tournament_referee_id, refereeBId : null,
        matchAId : match.match_id, matchBId : null,
        aStatus : 'pending', bStatus : 'not_required'
    });
    await NotificationService.notify({
        userId : a.user_id, type : 'referee_change_request',
        title : 'ผู้จัดขอให้คุณคุมแมตช์เพิ่ม',
        message : `ผู้จัดขอให้คุณเป็นกรรมการแมตช์ #${match.match_id} เพิ่ม`,
        relatedEntityType : 'match', relatedEntityId : match.match_id,
    });
    return dtoOf(id);
}

// ───────────────────────────── FR03 · ORG ขอสลับ 2 คน ─────────────────────────────

export async function createOrgSwap(tournamentId : number, userId : number, input : OrgSwapInput){
    if(input.refereeAId === input.refereeBId) throw new AppError(400, 'SAME_REFEREE', 'ต้องเป็นกรรมการคนละคน');
    if(input.matchAId === input.matchBId)     throw new AppError(400, 'SAME_MATCH', 'ต้องเป็นแมตช์คนละแมตช์');

    const a = await loadActiveReferee(input.refereeAId, tournamentId);
    const b = await loadActiveReferee(input.refereeBId, tournamentId);
    const matchA = await loadMatchInTournament(input.matchAId, tournamentId);
    const matchB = await loadMatchInTournament(input.matchBId, tournamentId);
    assertMatchChangeable(matchA);
    assertMatchChangeable(matchB);

    assertAssigned(await acceptedMatchesOf(a.tournament_referee_id), matchA.match_id, 'กรรมการ A ');
    assertAssigned(await acceptedMatchesOf(b.tournament_referee_id), matchB.match_id, 'กรรมการ B ');
    await assertNoOpenDuplicate(matchA.match_id, a.tournament_referee_id);

    await assertNoConflictAfter(a.tournament_referee_id, [matchB], [matchA.match_id]);
    await assertNoConflictAfter(b.tournament_referee_id, [matchA], [matchB.match_id]);

    const id = await ReqRepo.create({
        tournamentId, type : 'org_swap', requestedBy : userId,
        refereeAId : a.tournament_referee_id, refereeBId : b.tournament_referee_id,
        matchAId : matchA.match_id, matchBId : matchB.match_id,
        aStatus : 'pending', bStatus : 'pending'
    });
    await NotificationService.notifyUsers([a.user_id, b.user_id], {
        type : 'referee_change_request',
        title : 'ผู้จัดขอสลับแมตช์กรรมการ',
        message : `ผู้จัดขอสลับกรรมการระหว่างแมตช์ #${matchA.match_id} กับแมตช์ #${matchB.match_id}`,
        relatedEntityType : 'match', relatedEntityId : matchA.match_id,
    });
    return dtoOf(id);
}

// ───────────────────────────── FR04 / FR05 · list ─────────────────────────────

export async function listMyRequests(userId : number){
    const [incoming, outgoing] = await Promise.all([
        ReqRepo.findPendingForUser(userId),
        ReqRepo.findCreatedByUser(userId)
    ]);
    return { incoming : incoming.map(toRefereeRequestDto), outgoing : outgoing.map(toRefereeRequestDto) };
}

export async function listTournamentRequests(tournamentId : number, status? : RefereeChangeRequestRow['request_status']){
    const rows = await ReqRepo.findByTournament(tournamentId, status);
    return { items : rows.map(toRefereeRequestDto) };
}

// ───────────────────────────── FR06 / FR07 · ตอบ ─────────────────────────────

/** ฝั่งไหนของคำขอที่ user คนนี้ต้องตอบ */
async function sideOf(req : RefereeChangeRequestRow, userId : number): Promise<'a' | 'b'>{
    const [a, b] = await Promise.all([
        RefRepo.findById(req.referee_a_id),
        req.referee_b_id !== null ? RefRepo.findById(req.referee_b_id) : Promise.resolve(null)
    ]);
    if(a?.user_id === userId && req.a_status === 'pending') return 'a';
    if(b?.user_id === userId && req.b_status === 'pending') return 'b';
    throw new AppError(403, 'NOT_YOUR_REQUEST', 'คำขอนี้ไม่ได้รอคำตอบจากคุณ');
}

async function loadOpenRequest(requestId : number): Promise<RefereeChangeRequestRow>{
    const req = await ReqRepo.findById(requestId);
    if(!req) throw new AppError(404, 'REQUEST_NOT_FOUND', 'ไม่พบคำขอนี้');
    if(req.request_status !== 'open'){
        throw new AppError(409, 'REQUEST_CLOSED', 'คำขอนี้ถูกปิดไปแล้ว');
    }
    return req;
}

export async function respondToRequest(requestId : number, userId : number, answer : 'accepted' | 'declined'){
    const req = await loadOpenRequest(requestId);
    const side = await sideOf(req, userId);

    const recorded = await ReqRepo.answerSide(requestId, side, answer);
    if(!recorded) throw new AppError(409, 'REQUEST_CLOSED', 'คำขอนี้ถูกตอบหรือปิดไปแล้ว');

    if(answer === 'declined'){
        await ReqRepo.close(requestId, 'declined');
        await NotificationService.notify({
            userId : req.requested_by, type : 'referee_change_request',
            title : 'คำขอเปลี่ยนกรรมการถูกปฏิเสธ',
            message : `คำขอเปลี่ยนกรรมการของแมตช์ #${req.match_a_id} ถูกปฏิเสธ`,
            relatedEntityType : 'match', relatedEntityId : req.match_a_id,
        });
        return dtoOf(requestId);
    }

    // ทุกฝ่ายตกลงแล้ว → เช็คสถานะจริงอีกรอบก่อน apply (§5.1)
    const fresh = (await ReqRepo.findById(requestId))!;
    const done = (s : RefereeChangeRequestRow['a_status']) => s === 'accepted' || s === 'not_required';
    if(done(fresh.a_status) && done(fresh.b_status)){
        await applyOrCancel(fresh);
        await NotificationService.notify({
            userId : fresh.requested_by, type : 'referee_assigned',
            title : 'เปลี่ยนกรรมการสำเร็จ',
            message : `ทุกฝ่ายตกลงแล้ว กรรมการของแมตช์ #${fresh.match_a_id}` +
                      (fresh.match_b_id ? ` และ #${fresh.match_b_id}` : '') + ' ถูกเปลี่ยนตามคำขอ',
            relatedEntityType : 'match', relatedEntityId : fresh.match_a_id,
        });
    }
    return dtoOf(requestId);
}

async function applyOrCancel(req : RefereeChangeRequestRow): Promise<void>{
    try {
        await revalidate(req);
        const applied = await ReqRepo.apply(req);
        if(!applied) throw new AppError(409, 'REQUEST_NO_LONGER_VALID', 'ข้อมูลกรรมการในแมตช์เปลี่ยนไปแล้ว คำขอนี้ใช้ไม่ได้');
    } catch (err) {
        if(err instanceof AppError){
            await ReqRepo.close(req.request_id, 'cancelled');
            throw new AppError(409, 'REQUEST_NO_LONGER_VALID', `คำขอถูกยกเลิกเพราะสถานะเปลี่ยนไป: ${err.message}`);
        }
        throw err;
    }
}

/** เงื่อนไขเดียวกับตอนสร้าง — แต่ตรวจกับข้อมูล ณ ตอนจะ apply */
async function revalidate(req : RefereeChangeRequestRow): Promise<void>{
    const a = await loadActiveReferee(req.referee_a_id, req.tournament_id);
    const matchA = await loadMatchInTournament(req.match_a_id, req.tournament_id);
    assertMatchChangeable(matchA);

    if(req.request_type === 'org_add_match'){
        await assertNoConflictAfter(a.tournament_referee_id, [matchA], []);
        return;
    }

    const b = await loadActiveReferee(req.referee_b_id!, req.tournament_id);
    assertAssigned(await acceptedMatchesOf(a.tournament_referee_id), matchA.match_id, 'กรรมการ A ');

    if(req.request_type === 'ref_transfer'){
        await assertNoConflictAfter(b.tournament_referee_id, [matchA], []);
        return;
    }

    const matchB = await loadMatchInTournament(req.match_b_id!, req.tournament_id);
    assertMatchChangeable(matchB);
    assertAssigned(await acceptedMatchesOf(b.tournament_referee_id), matchB.match_id, 'กรรมการ B ');
    await assertNoConflictAfter(a.tournament_referee_id, [matchB], [matchA.match_id]);
    await assertNoConflictAfter(b.tournament_referee_id, [matchA], [matchB.match_id]);
}

// ───────────────────────────── FR08 · ยกเลิก ─────────────────────────────

export async function cancelRequest(requestId : number, userId : number){
    const req = await loadOpenRequest(requestId);
    if(req.requested_by !== userId){
        throw new AppError(403, 'NOT_YOUR_REQUEST', 'ยกเลิกได้เฉพาะคำขอที่คุณส่งเอง');
    }
    await ReqRepo.close(requestId, 'cancelled');
}
