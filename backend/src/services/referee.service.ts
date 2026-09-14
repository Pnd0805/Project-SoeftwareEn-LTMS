import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import { AppError } from '../utils/AppError.js';
import type { InviteRefereeInput, AcceptInvitationInput } from '../schemas/referee.schema.js';
import { resolveApprovalForAccept } from './refereeIdentity.service.js';
import { toTournamentRefereeDto, toMyRefereeInvitationDto, toMatchRefereeDto } from '../mappers/referee.mapper.js';
import type { InvitedMatchRow } from '../repositories/matchReferee.repo.js';
import * as MatchRefRepo from '../repositories/matchReferee.repo.js';
import { toRefereeStatus } from '../mappers/referee.mapper.js';
import type { RefereeStatusFields } from '../mappers/referee.mapper.js';
import * as MatchRepo from '../repositories/match.repo.js';
import type { MatchRefereeCoverageRow } from '../repositories/match.repo.js';
import * as SportTypeRepo from '../repositories/sportType.repo.js';

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
        // accepted แต่ถูก admin ปฏิเสธตัวตน (rejected_by_admin) → เชิญซ้ำได้ (F-15) แถวใหม่จะเริ่มตรวจใหม่
        if(latest.invitation_status === 'accepted' && toRefereeStatus(latest) !== 'rejected_by_admin'){
            throw new AppError(409, 'REFEREE_ALREADY_ACCEPTED', 'ผู้ใช้นี้เป็นกรรมการของทัวร์นาเมนต์นี้อยู่แล้ว');
        }
    }

    // 3. แมตช์ที่แนบมา — ต้องเป็นของทัวร์นี้ มีเวลาแข่งครบ และไม่ซ้อนกันเอง
    const matchIds = [...new Set(input.matchIds)];
    if(matchIds.length > 0){
        const matches = await MatchRepo.findByIdsInTournament(tournamentId, matchIds);
        if(matches.length !== matchIds.length){
            throw new AppError(404, 'MATCH_NOT_FOUND', 'บางแมตช์ไม่อยู่ในทัวร์นาเมนต์นี้');
        }
        assertSchedulable(matches);
    }

    // 4. เขียน (คำเชิญ + แมตช์ที่แนบ ในทรานแซกชันเดียว)
    const newId = await RefRepo.create({
        tournamentId, userId : input.userId, invitedBy, isExternal : input.isExternal, matchIds
    });

    return { id : newId, userId : input.userId, invitationStatus : 'pending', isExternal : input.isExternal, matchIds };
}

export type Schedulable = Pick<InvitedMatchRow, 'match_id' | 'scheduled_time' | 'scheduled_end_time'>;

/** กรรมการ 1 คนคุมได้ทีละแมตช์ — ทุกแมตช์ต้องมีเวลาเริ่ม/จบ และห้ามซ้อนเวลากัน (ใช้ร่วมกับ refereeRequest.service) */
export function assertSchedulable(matches : Schedulable[]): void {
    for(const m of matches){
        if(!m.scheduled_time || !m.scheduled_end_time){
            throw new AppError(409, 'MATCH_NOT_SCHEDULED',
                `แมตช์ #${m.match_id} ยังไม่ได้กำหนดเวลาเริ่ม/จบ กรุณาจัดตารางแข่งก่อนมอบหมายกรรมการ`);
        }
    }
    const sorted = [...matches].sort((a, b) => a.scheduled_time!.getTime() - b.scheduled_time!.getTime());
    for(let i = 1; i < sorted.length; i++){
        const prev = sorted[i - 1]!, cur = sorted[i]!;
        if(cur.scheduled_time! < prev.scheduled_end_time!){
            throw new AppError(409, 'REFEREE_TIME_CONFLICT',
                `แมตช์ #${prev.match_id} กับ #${cur.match_id} เวลาซ้อนกัน กรรมการคนเดียวคุมพร้อมกันไม่ได้`,
                { matchIds : [prev.match_id, cur.match_id] });
        }
    }
}

export async function listTournamentReferees(tournamentId : number){
    const rows = await RefRepo.findLatestPerUserByTournament(tournamentId);
    const items = rows.map(toTournamentRefereeDto);

    // ตอบรับแล้วกี่คน — ตัวเลขที่แสดงบนหน้าจอ
    const acceptedCount = items.filter(i => i.invitationStatus === 'accepted').length;

    // พร้อมปฏิบัติงานจริงกี่คน — กรรมการภายนอกที่ admin ยังไม่อนุมัติ ยังคุมแมตช์ไม่ได้
    //  BR-10 (C13 publish) ต้องเช็คตัวนี้ ไม่ใช่ acceptedCount 
    const effectiveCount = items.filter(i =>
        i.invitationStatus === 'accepted'
        && (!i.isExternal || i.externalApprovalStatus === 'approved')).length;

    return { items, acceptedCount, effectiveCount };
}

export async function listMyRefereeInvitations(userId : number){
    const rows = await RefRepo.findPendingInvitationsByUser(userId);

    // แมตช์ที่เสนอมาของทุกคำเชิญ — query เดียวแล้วจับกลุ่มใน JS
    const matches = await MatchRefRepo.findByTournamentReferees(rows.map(r => r.tournament_referee_id));
    const byInvitation = new Map<number, InvitedMatchRow[]>();
    for(const m of matches){
        const list = byInvitation.get(m.tournament_referee_id) ?? [];
        list.push(m);
        byInvitation.set(m.tournament_referee_id, list);
    }

    return { items : rows.map(r => toMyRefereeInvitationDto(r, byInvitation.get(r.tournament_referee_id) ?? [])) };
}

export async function acceptRefereeInvitation(invitationId : number, userId : number, input : AcceptInvitationInput){
    const invitation = await RefRepo.findById(invitationId);

    // ไม่มีจริง / ถูกถอดแล้ว / ไม่ใช่ของเรา → 404 เหมือนกันหมด
    if(!invitation || invitation.removed_at !== null || invitation.user_id !== userId){
        throw new AppError(404, 'INVITATION_NOT_FOUND', 'ไม่พบคำเชิญนี้');
    }

    if(invitation.invitation_status !== 'pending'){
        throw new AppError(409, 'INVITATION_ALREADY_ANSWERED', 'คำเชิญนี้ถูกตอบไปแล้ว');
    }

    // เลือกได้เฉพาะแมตช์ที่ ORG เสนอมาเท่านั้น — [] = เข้าทัวร์แบบ pool
    const offered = await MatchRefRepo.findByTournamentReferees([invitationId]);
    const chosenIds = [...new Set(input.matchIds)];
    const chosen = chosenIds.map(id => offered.find(m => m.match_id === id));
    if(chosen.some(m => m === undefined)){
        throw new AppError(400, 'MATCH_NOT_IN_INVITATION', 'เลือกได้เฉพาะแมตช์ที่อยู่ในคำเชิญนี้เท่านั้น');
    }

    // ORG อาจเลื่อนเวลาแมตช์ระหว่างรอตอบ → เช็คซ้อนเวลาอีกรอบตอนรับจริง
    assertSchedulable(chosen as InvitedMatchRow[]);

    const { joinsOpenReview, ...approval } = await resolveApprovalForAccept(invitation, input.docs);

    const updated = await RefRepo.accept(invitationId, chosenIds, approval);
    if(!updated){
        throw new AppError(409, 'INVITATION_ALREADY_ANSWERED', 'คำเชิญนี้ถูกตอบไปแล้ว');
    }

    // ส่ง docs มาพร้อม accept ทั้งที่มีการตรวจค้างอยู่ = ส่งเอกสารใหม่ให้ทุกทัวร์ที่รอ
    if(joinsOpenReview && input.docs){
        await RefRepo.submitDocsForUser(userId, input.docs);
    }

    const requiresAdminApproval = approval.status === 'pending' || approval.status === 'needs_docs';
    return {
        id : invitationId,
        invitationStatus : 'accepted',
        requiresAdminApproval,
        docsRequired : requiresAdminApproval && approval.docs === null,
        acceptedMatchIds : chosenIds,
        declinedMatchIds : offered.map(m => m.match_id).filter(id => !chosenIds.includes(id))
    };
}


export async function declineRefereeInvitation(invitationId : number, userId : number){
    const invitation = await RefRepo.findById(invitationId);

    if(!invitation || invitation.removed_at !== null || invitation.user_id !== userId){
        throw new AppError(404, 'INVITATION_NOT_FOUND', 'ไม่พบคำเชิญนี้');
    }

    if(invitation.invitation_status !== 'pending'){
        throw new AppError(409, 'INVITATION_ALREADY_ANSWERED', 'คำเชิญนี้ถูกตอบไปแล้ว');
    }

    const updated = await RefRepo.decline(invitationId);
    if(!updated){
        throw new AppError(409, 'INVITATION_ALREADY_ANSWERED', 'คำเชิญนี้ถูกตอบไปแล้ว');
    }
}   



export async function listMatchReferees(matchId : number){
    // แถวใน match_referees = "จอง" — ใช้ได้จริงต่อเมื่อสถานะฝั่งทัวร์เป็น active (ตัด external ที่รอ admin)
    const rows = await MatchRefRepo.findByMatch(matchId);
    return { items : rows.filter(isActiveReferee).map(toMatchRefereeDto) };
}

export async function unassignRefereeFromMatch(matchId : number, tournamentRefereeId : number){
    const removed = await MatchRefRepo.unassign(matchId, tournamentRefereeId);
    if(!removed){
        throw new AppError(404, 'REFEREE_NOT_ASSIGNED', 'กรรมการคนนี้ไม่ได้ถูกมอบหมายให้แมตช์นี้');
    }
}

type MatchCoverage = {
    matchId : number,
    roundNumber : number | null,
    scheduledTime : string | null,
    needed : number,
    assigned : number
};

type RefereeConflict = {
    tournamentRefereeId : number,
    userId : number,
    matchIds : [number, number]
};

/** BR-11: on-site ที่ต้องบันทึกสถิติ ใช้กรรมการ 2 คน นอกนั้น 1 */
async function refereesNeededPerMatch(sportTypeId : number): Promise<(mode : 'onsite' | 'online') => number> {
    const statDefs = await SportTypeRepo.findStatDefinitionsBySportType(sportTypeId);
    const onsiteNeed = statDefs.length > 0 ? 2 : 1;
    return mode => mode === 'onsite' ? onsiteNeed : 1;
}

/**
 * BR-10 แบบใหม่ (GUIDE/11 §4.2) — "ทุกแมตช์มีกรรมการครบ" ไม่ใช่นับหัวรวม
 * คืนแมตช์ที่ยังขาด + กรรมการที่มีแมตช์ซ้อนเวลา (Q6: เตือน ไม่ block)
 */
export async function getRefereeCoverage(tournamentId : number, sportTypeId : number){
    const rows = await MatchRepo.findRefereeCoverage(tournamentId);
    const needed = await refereesNeededPerMatch(sportTypeId);
    return summarizeCoverage(rows, needed);
}

function summarizeCoverage(rows : MatchRefereeCoverageRow[], needed : (mode : 'onsite' | 'online') => number){
    // 1. จับกลุ่มตามแมตช์ นับเฉพาะกรรมการที่ active จริง
    const matches = new Map<number, MatchCoverage & { row : MatchRefereeCoverageRow }>();
    const byReferee = new Map<number, { userId : number, matches : MatchRefereeCoverageRow[] }>();

    for(const r of rows){
        if(!matches.has(r.match_id)){
            matches.set(r.match_id, {
                matchId : r.match_id, roundNumber : r.round_number,
                scheduledTime : r.scheduled_time?.toISOString() ?? null,
                needed : needed(r.mode), assigned : 0, row : r
            });
        }
        if(r.tournament_referee_id === null || r.user_id === null) continue;
        if(!isActiveReferee({
            invitation_status : r.invitation_status!, is_external : r.is_external!,
            external_approval_status : r.external_approval_status!, removed_at : r.removed_at
        })) continue;

        matches.get(r.match_id)!.assigned++;
        const ref = byReferee.get(r.tournament_referee_id) ?? { userId : r.user_id, matches : [] };
        ref.matches.push(r);
        byReferee.set(r.tournament_referee_id, ref);
    }

    // 2. แมตช์ที่ยังขาด
    const uncovered : MatchCoverage[] = [];
    for(const { row : _row, ...m } of matches.values()){
        if(m.assigned < m.needed) uncovered.push(m);
    }

    // 3. กรรมการที่รับแมตช์ซ้อนเวลา (เกิดได้เมื่อ ORG เลื่อนเวลาแมตช์ทีหลัง)
    const conflicts : RefereeConflict[] = [];
    for(const [tournamentRefereeId, ref] of byReferee){
        const sorted = ref.matches
            .filter(m => m.scheduled_time && m.scheduled_end_time)
            .sort((a, b) => a.scheduled_time!.getTime() - b.scheduled_time!.getTime());
        for(let i = 1; i < sorted.length; i++){
            const prev = sorted[i - 1]!, cur = sorted[i]!;
            if(cur.scheduled_time! < prev.scheduled_end_time!){
                conflicts.push({ tournamentRefereeId, userId : ref.userId, matchIds : [prev.match_id, cur.match_id] });
            }
        }
    }

    return {
        matchesTotal : matches.size,
        matchesCovered : matches.size - uncovered.length,
        uncovered,
        conflicts
    };
}

/**
 * F03 — ถอดกรรมการออกจากทัวร์ (มติ Q4: ยอมเสมอ แต่บอกว่าแมตช์ไหนจะขาดคน)
 * ถอดทุกแถวของ user คนนี้ แถวใน match_referees คงไว้ — F12/coverage กรองด้วย removed_at เอง
 */
export async function removeTournamentReferee(
        tournamentId : number, tournamentRefereeId : number, removedBy : number, sportTypeId : number){

    const target = await RefRepo.findById(tournamentRefereeId);
    if(!target || target.tournament_id !== tournamentId || target.removed_at !== null){
        throw new AppError(404, 'REFEREE_NOT_FOUND', 'ไม่พบกรรมการคนนี้ในทัวร์นาเมนต์นี้');
    }

    await RefRepo.removeAllByUser(tournamentId, target.user_id, removedBy);

    const coverage = await getRefereeCoverage(tournamentId, sportTypeId);
    return { removed : true, uncoveredMatches : coverage.uncovered.map(m => m.matchId) };
}

/** กรรมการคนนี้ใช้งานได้จริงหรือยัง — นิยามอยู่ที่ toRefereeStatus() ที่เดียว */
export function isActiveReferee(tr : RefereeStatusFields | null): boolean {
    if(!tr) return false;
    return toRefereeStatus(tr) === 'active';
}