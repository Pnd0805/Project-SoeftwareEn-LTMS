import * as RefRepo from '../repositories/tournamentReferee.repo.js';
import * as UserRepo from '../repositories/user.repo.js';
import { AppError } from '../utils/AppError.js';
import type { InviteRefereeInput, AcceptInvitationInput } from '../schemas/referee.schema.js';
import { resolveApprovalForAccept } from './refereeIdentity.service.js';
import { toTournamentRefereeDto, toMyRefereeInvitationDto, toMatchRefereeDto, toMyRefereeMatchDto } from '../mappers/referee.mapper.js';
import type { InvitedMatchRow } from '../repositories/matchReferee.repo.js';
import * as MatchRefRepo from '../repositories/matchReferee.repo.js';
import { toRefereeStatus } from '../mappers/referee.mapper.js';
import type { RefereeStatusFields } from '../mappers/referee.mapper.js';
import * as MatchRepo from '../repositories/match.repo.js';
import type { MatchRefereeCoverageRow } from '../repositories/match.repo.js';
import * as SportTypeRepo from '../repositories/sportType.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as NotificationService from './notification.service.js';
import { checkTournament } from '../utils/checkExist.js';
import { isOrganizerOf } from '../middlewares/requireOrganizer.js';
import { toAssignableRefereeDto } from '../mappers/referee.mapper.js';
import { timesOverlap } from '../utils/timeOverlap.js';

export async function inviteReferee(tournamentId : number, invitedBy : number, input : InviteRefereeInput){
    // 1. คนที่ถูกเชิญมีตัวตนจริงไหม
    const user = await UserRepo.findById(input.userId);
    if(!user){
        throw new AppError(404, 'USER_NOT_FOUND', 'ไม่พบผู้ใช้นี้ในระบบ');
    }

    // 1.1 Conflict of interest (มติ 18 ก.ย. 2569) — ORG ของทัวร์ และคนที่มีชื่อในทีมที่สมัครทัวร์นี้ (แม้ไม่ได้ลงแข่ง) เป็นกรรมการไม่ได้
    //     requireOrganizer ยืนยันแล้วว่า invitedBy = ORG ของทัวร์นี้
    if(input.userId === invitedBy){
        throw new AppError(409, 'ORGANIZER_CANNOT_BE_REFEREE', 'ผู้จัดการแข่งขันเป็นกรรมการของทัวร์นาเมนต์ตัวเองไม่ได้');
    }
    const applyingTeam = await RefRepo.findApplyingTeamOfUser(tournamentId, input.userId);
    if(applyingTeam){
        throw new AppError(409, 'REFEREE_CONFLICT_OF_INTEREST',
            `ผู้ใช้นี้มีชื่อในทีม "${applyingTeam.name}" ที่สมัครทัวร์นาเมนต์นี้ เป็นกรรมการไม่ได้`,
            { teamId : applyingTeam.team_id });
    }

    // 2. กันเชิญทับสถานะเดิม
    //    ★ แก้ 1 ต.ค. 2569 — เดิมดู "แถวล่าสุดตาม id" แถวเดียว ซึ่งตอบผิดได้
    //    ตารางเป็น soft delete + F-15 ตั้งใจให้มีแถว active ได้หลายแถว ⇒ แถวล่าสุดอาจเป็นแถวที่ถูกลบไปแล้ว
    //    ขณะที่แถวเก่ายัง active อยู่ · ด่านจึงปล่อยผ่าน แล้วได้กรรมการ active ซ้ำคนในทัวร์เดียวกัน
    //    (เจอของจริงในฐาน dev: ทัวร์ 2 มี 9002 เป็น accepted ค้างอยู่สามแถวพร้อมกัน)
    const active = await RefRepo.findActiveByTournamentAndUser(tournamentId, input.userId);
    if(active.some(r => r.invitation_status === 'pending')){
        throw new AppError(409, 'REFEREE_INVITATION_PENDING', 'ผู้ใช้นี้มีคำเชิญที่ยังไม่ได้ตอบอยู่แล้ว');
    }
    // accepted แต่ถูก admin ปฏิเสธตัวตน (rejected_by_admin) → เชิญซ้ำได้ (F-15) แถวใหม่จะเริ่มตรวจใหม่
    // ส่วน invitation_status = 'rejected' คือเจ้าตัวปฏิเสธเอง เชิญใหม่ได้เหมือนเดิม
    if(active.some(r => r.invitation_status === 'accepted' && toRefereeStatus(r) !== 'rejected_by_admin')){
        throw new AppError(409, 'REFEREE_ALREADY_ACCEPTED', 'ผู้ใช้นี้เป็นกรรมการของทัวร์นาเมนต์นี้อยู่แล้ว');
    }

    // 3. แมตช์ที่แนบมา — ต้องเป็นของทัวร์นี้ มีเวลาแข่งครบ และไม่ซ้อนกันเอง
    const matchIds = [...new Set(input.matchIds)];
    let attached : Awaited<ReturnType<typeof MatchRepo.findByIdsInTournament>> = [];
    if(matchIds.length > 0){
        attached = await MatchRepo.findByIdsInTournament(tournamentId, matchIds);
        if(attached.length !== matchIds.length){
            throw new AppError(404, 'MATCH_NOT_FOUND', 'บางแมตช์ไม่อยู่ในทัวร์นาเมนต์นี้');
        }
        assertSchedulable(attached);
    }

    // 4. เขียน (คำเชิญ + แมตช์ที่แนบ ในทรานแซกชันเดียว)
    const newId = await RefRepo.create({
        tournamentId, userId : input.userId, invitedBy, isExternal : input.isExternal, matchIds
    });

    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    await NotificationService.notify({
        userId : input.userId, type : 'referee_invited',
        title : 'คุณได้รับเชิญเป็นกรรมการ',
        message : `คุณได้รับเชิญเป็นกรรมการทัวร์นาเมนต์ "${tournament?.name ?? ''}"` +
                  (matchIds.length > 0 ? ` (${matchIds.length} แมตช์)` : ''),
        relatedEntityType : 'tournament', relatedEntityId : tournamentId,
    });

    /**
     * คำเตือน "ข้ามทัวร์" ให้ ORG — **ไม่ block** (มติ 6 ต.ค. · ทางเลือก ก)
     *
     * ★ ตั้งใจเป็นคำเตือน ไม่ใช่ด่าน เพราะ ORG แก้ของทัวร์อื่นไม่ได้ ⇒ block แล้วเป็นทางตัน
     *   ตรงกับมติ Q6 ที่ว่าเวลาซ้อน "เตือน ไม่ block" สำหรับฝั่ง ORG
     * 🔴 บอกเฉพาะ "ชนกับงานนอกทัวร์นี้กี่แมตช์" ไม่บอกชื่อทัวร์/ชื่อแมตช์
     *   เพราะตารางงานของกรรมการในทัวร์อื่นไม่ใช่ข้อมูลของ ORG คนนี้
     *   ⇒ พอให้เขารู้ว่าควรถามกรรมการก่อน แต่ไม่เปิดข้อมูลทัวร์อื่น
     * ด่านจริงอยู่ตอนกรรมการกดรับ ซึ่งเป็นคนที่เห็นข้อมูลนั้นได้
     */
    // ★ 6 ต.ค. — ใช้ timesOverlap ตัวกลางเหมือนอีก 4 ที่ (เดิมเขียนเทียบเองซ้ำที่นี่ = สำเนาที่ 5)
    //   และใช้ `matches` ที่อ่านมาแล้วในข้อ 3 ไม่ยิง findByIdsInTournament ซ้ำรอบสอง
    const held = await bookingsOfReferee(input.userId);
    const crossTournamentWarnings = attached
        .filter(m => m.scheduled_time && m.scheduled_end_time)
        .filter(m => held.some(b => b.tournamentId !== tournamentId
            && timesOverlap(m.scheduled_time!, m.scheduled_end_time!, b.scheduled_time!, b.scheduled_end_time!)))
        .length;

    return { id : newId, userId : input.userId, invitationStatus : 'pending', isExternal : input.isExternal, matchIds,
             crossTournamentWarnings };
}

export type Schedulable = Pick<InvitedMatchRow, 'match_id' | 'scheduled_time' | 'scheduled_end_time'>;

/** งานที่กรรมการคนนี้รับไว้แล้ว ซึ่งอาจอยู่ทัวร์อื่น — ใช้ทั้งด่าน block และคำเตือนตอนเชิญ */
export type CrossTournamentBooking = {
    matchId : number,
    tournamentId : number,
    tournamentName : string,
    scheduledTime : string,
    scheduledEndTime : string
};

/**
 * งานที่กรรมการคนนี้รับไว้แล้ว **ทุกทัวร์** และยังต้องไปคุมจริง
 *
 * ★ ใช้ MatchRefRepo.findAcceptedByUser ซึ่งข้ามทัวร์อยู่แล้วโดยธรรมชาติ (เส้นเดียวกับ
 *   หน้า "แมตช์ของฉัน" ของกรรมการ) ⇒ ไม่ต้องเขียนคิวรีใหม่สำหรับเรื่องนี้
 *
 * ตัดออกสามอย่าง:
 *   ① แถวกรรมการที่ไม่ active (ถูกถอด · ยังไม่ตอบรับ · คนนอกที่ admin ยังไม่อนุมัติ)
 *   ② แมตช์ที่ไม่มีเวลาเริ่ม/จบ — เทียบการทับไม่ได้
 *   ③ แมตช์ที่จบไปแล้ว (`completed`/`finished`) — ไม่มีใครต้องไปอยู่ที่นั้นอีก
 *     🔴 ไม่ตัดด้วย "เวลาผ่านไปแล้ว" เพราะแมตช์ที่เลยเวลาแต่ยัง scheduled คือแมตช์ที่
 *       ยังไม่ได้เริ่มและอาจกำลังเริ่มช้า ⇒ คนยังต้องอยู่ที่นั้น ⇒ ยังนับเป็นการทับ
 */
export async function bookingsOfReferee(userId : number): Promise<(CrossTournamentBooking & Schedulable)[]> {
    return (await bookingsOfReferees([userId])).get(userId) ?? [];
}

/**
 * เหมือน `bookingsOfReferee` แต่หลายคนในคิวรีเดียว — ใช้โดย F14 ที่ต้องถามกรรมการทุกคนของทัวร์
 *
 * ★ กฎการกรองทั้งสามข้อ (และ isActiveReferee) อยู่ที่นี่ที่เดียว ตัวเดี่ยวเรียกตัวนี้ด้วย
 *   ⇒ ด่านตอนกดรับ กับ คำเตือนใน F14 ตอบจาก "งานที่ถืออยู่" ชุดเดียวกันเสมอ
 *   ถ้าเขียนแยก แล้ววันหนึ่งมีคนแก้กฎที่เดียว ผู้จัดกับกรรมการจะเห็นคนละความจริง
 */
export async function bookingsOfReferees(userIds : number[]): Promise<Map<number, (CrossTournamentBooking & Schedulable)[]>> {
    const rows = await MatchRefRepo.findAcceptedByUsers(userIds);
    const byUser = new Map<number, (CrossTournamentBooking & Schedulable)[]>();
    for(const r of rows){
        if(!isActiveReferee(r)) continue;
        if(r.scheduled_time === null || r.scheduled_end_time === null) continue;
        if(r.match_status === 'completed' || r.match_status === 'finished') continue;
        const list = byUser.get(r.user_id) ?? [];
        list.push({
            matchId : r.match_id, tournamentId : r.tournament_id, tournamentName : r.tournament_name,
            scheduledTime : r.scheduled_time.toISOString(), scheduledEndTime : r.scheduled_end_time.toISOString(),
            match_id : r.match_id, scheduled_time : r.scheduled_time, scheduled_end_time : r.scheduled_end_time
        });
        byUser.set(r.user_id, list);
    }
    return byUser;
}

/**
 * ด่าน "ข้ามทัวร์" (มติ 6 ต.ค. 2569 · ทางเลือก ก) — FE รายงาน 6 ต.ค.
 *
 * 🔴 ช่องโหว่ที่ปิด: ด่านตรวจเวลาซ้อนทุกจุดก่อนหน้านี้ดูแค่แมตช์ **ในทัวร์เดียวกัน**
 *   ทัวร์ A เชิญคุม 10:00 · ทัวร์ B เชิญคุม 10:30 วันเดียวกัน ⇒ ผ่านทั้งตอนเชิญและตอนรับ
 *   และ F14 ของทั้งสองทัวร์ก็ไม่เห็น เพราะแต่ละอันดูแค่ทัวร์ตัวเอง
 *   ⇒ สุดท้ายมีคนต้องอยู่สองที่พร้อมกัน และไม่มีใครรู้จนถึงวันแข่ง
 *
 * ★ ด่านนี้อยู่ที่ **ตอนกรรมการกดรับ** ไม่ใช่ตอน ORG เชิญ โดยเจตนา
 *   ถ้า block ตอนเชิญ ORG จะได้ 409 จากข้อมูลของทัวร์อื่นที่เขา **มองไม่เห็นและแก้ไม่ได้**
 *   ⇒ ทางตัน · และถ้าบอกว่าชนกับทัวร์ไหนก็เท่ากับเปิดตารางงานของกรรมการให้ ORG คนอื่นเห็น
 *   คนที่เห็นตารางตัวเองทุกทัวร์และแก้ได้ คือกรรมการ ⇒ ด่านควรอยู่ตรงที่เขากด
 *   ⇒ บอกชื่อทัวร์ในข้อความได้ ไม่รั่วให้ใคร เพราะเป็นตารางของตัวเขาเอง
 *
 * 🔴 และด่านนี้ต้องมาหลังจาก FR09 (ref_withdraw) เท่านั้น
 *   ก่อนหน้านี้กรรมการออกจากแมตช์เก่าไม่ได้ถ้าไม่มีคนรับช่วง ⇒ block ไปก็ติดตาย
 *
 * `excludeMatchIds` — แมตช์ที่กำลังจะถูกเทียบอยู่แล้วในชุด incoming หรือกำลังจะถูกปล่อยไป
 *   ไม่ใช่งานที่ "ยังถืออยู่" ⇒ ไม่ควรนับเป็นคู่ขัดแย้งของตัวเอง
 */
export async function assertNoCrossTournamentConflict(
        userId : number, incoming : Schedulable[], excludeMatchIds : number[] = []): Promise<void> {
    const wanted = incoming.filter(m => m.scheduled_time && m.scheduled_end_time);
    if(wanted.length === 0) return;

    const held = (await bookingsOfReferee(userId))
        .filter(b => !excludeMatchIds.includes(b.matchId))
        .filter(b => !wanted.some(w => w.match_id === b.matchId));

    for(const w of wanted){
        const clash = held.find(b => timesOverlap(w.scheduled_time!, w.scheduled_end_time!, b.scheduled_time!, b.scheduled_end_time!));
        if(clash){
            throw new AppError(409, 'REFEREE_TIME_CONFLICT_CROSS_TOURNAMENT',
                `แมตช์ #${w.match_id} เวลาซ้อนกับแมตช์ #${clash.matchId} ของทัวร์นาเมนต์ "${clash.tournamentName}" ` +
                'ที่คุณรับไว้แล้ว — ถ้าต้องการรับแมตช์นี้ ให้ขอถอนตัวจากแมตช์เดิมก่อน',
                { matchId : w.match_id, conflictsWith : clash });
        }
    }
}

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
        if(timesOverlap(prev.scheduled_time!, prev.scheduled_end_time!, cur.scheduled_time!, cur.scheduled_end_time!)){
            throw new AppError(409, 'REFEREE_TIME_CONFLICT',
                `แมตช์ #${prev.match_id} กับ #${cur.match_id} เวลาซ้อนกัน กรรมการคนเดียวคุมพร้อมกันไม่ได้`,
                { matchIds : [prev.match_id, cur.match_id] });
        }
    }
}

export async function listTournamentReferees(tournamentId : number){
    const rows = await RefRepo.findLatestPerUserByTournament(tournamentId);
    const items = rows.map(toTournamentRefereeDto);

    // acceptedCount = พร้อมปฏิบัติงานจริง (active) — คนนอกที่ admin ยังไม่อนุมัติไม่นับ (FE gaps 19 ก.ย. / FR-RM-02)
    // awaitingAdminCount = ตอบรับแล้วแต่รอ admin · (effectiveCount เดิมถูกตัด — ค่าเดียวกับ acceptedCount)
    const accepted = items.filter(i => i.invitationStatus === 'accepted');
    const activeCount = accepted.filter(i => !i.isExternal || i.externalApprovalStatus === 'approved').length;

    return { items, acceptedCount : activeCount, awaitingAdminCount : accepted.length - activeCount };
}

/**
 * F02b · OD-59 (4 ต.ค. 2569) — รายชื่อปลายทางที่ใช้ขอโอน/แลกแมตช์ได้
 *
 * ปัญหาที่แก้ (`TO-BACKEND-2026-10-01-frontend-workflows.md` ข้อ 8):
 *   F02 (`GET /tournaments/:id/referees`) ติด `requireOrganizer` ⇒ หน้าของกรรมการเรียกไม่ได้
 *   FE จึงต้องไปรวบรวมปลายทางจาก `GET /matches/:id/referees` ของแมตช์อื่นในทัวร์เดียวกัน
 *   ⇒ **กรรมการที่ active แต่ยังไม่ได้รับแมตช์เลย ไม่โผล่ในตัวเลือกปลายทาง**
 *      ซึ่งเป็นคนที่ควรโผล่ที่สุด เพราะว่างที่สุด
 *
 * ★ ไม่ผ่อน `requireOrganizer` ของ F02 แทน — F02 มี `isExternal` / `externalApprovalStatus`
 *   ซึ่งเป็นเรื่องเอกสารตัวตน และ `awaitingAdminCount` ที่เป็นข้อมูลการจัดการของผู้จัด
 *   เปิด F02 ให้กรรมการ = เปิดเกินที่งานนี้ต้องใช้ ⇒ ทำเส้นใหม่ที่คืนเท่าที่ต้องใช้พอดี
 *
 * สิทธิ์: **ผู้จัด หรือ กรรมการที่ใช้งานได้จริงของทัวร์นี้** — คนนอกทัวร์ไม่ได้รายชื่อคนในทัวร์
 * ★ ตัวผู้เรียกเองถูกตัดออกจากผลลัพธ์ — ไม่มีใครขอโอนแมตช์ให้ตัวเอง และการโชว์ตัวเอง
 *   ในลิสต์ปลายทางทำให้กดผิดได้เปล่า ๆ (ฝั่ง POST ก็ปฏิเสธอยู่แล้ว แต่ไม่ควรให้กดถึงตรงนั้น)
 */
export async function listAssignableReferees(tournamentId : number , userId : number){
    const tournament = await checkTournament(tournamentId);

    if(!isOrganizerOf(tournament , userId) && !(await findActiveRefereeRow(tournamentId , userId))){
        throw new AppError(403 , 'NOT_TOURNAMENT_REFEREE' ,
            'ดูรายชื่อกรรมการของทัวร์นาเมนต์นี้ได้เฉพาะผู้จัดและกรรมการของทัวร์นี้');
    }

    const rows = await RefRepo.findAssignableByTournament(tournamentId);
    return { items : rows.filter(r => r.user_id !== userId).map(toAssignableRefereeDto) };
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

/**
 * B7 (รายงาน FE 19 ก.ย.) — แมตช์ที่ฉันเป็นกรรมการ (รับแมตช์แล้ว + ยัง active ในทัวร์นั้น) ข้ามทุกทัวร์
 * ?status= กรองสถานะแมตช์ · ?upcoming=true เฉพาะที่ยังไม่จบ (ทุกสถานะที่ยังไม่ completed)
 */
export async function listMyRefereeMatches(userId : number, filters : { status? : string | undefined; upcoming? : boolean | undefined }){
    const rows = (await MatchRefRepo.findAcceptedByUser(userId)).filter(r => isActiveReferee(r));
    const items = rows
        .filter(r => filters.status === undefined || r.match_status === filters.status)
        .filter(r => !filters.upcoming || r.match_status !== 'completed')
        .map(toMyRefereeMatchDto);
    return { items };
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
    // มติ 6 ต.ค. (ทางเลือก ก) — และต้องไม่ซ้อนกับงานที่รับไว้ใน **ทัวร์อื่น** ด้วย
    // ★ ด่านนี้อยู่ตรงนี้เพราะคนกดคือกรรมการเอง ซึ่งเป็นคนเดียวที่เห็นตารางตัวเองทุกทัวร์
    await assertNoCrossTournamentConflict(userId, chosen as InvitedMatchRow[]);

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
    const referee = await UserRepo.findById(userId);
    await NotificationService.notify({
        userId : invitation.invited_by, type : 'referee_invite_answered',
        title : 'กรรมการตอบรับคำเชิญแล้ว',
        message : `${referee?.full_name ?? 'กรรมการ'} ตอบรับเป็นกรรมการ รับ ${chosenIds.length} แมตช์` +
                  (requiresAdminApproval ? ' — รอแอดมินตรวจตัวตนก่อนนับเป็นกรรมการ' : ''),
        relatedEntityType : 'tournament', relatedEntityId : invitation.tournament_id,
    });
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
    const referee = await UserRepo.findById(userId);
    await NotificationService.notify({
        userId : invitation.invited_by, type : 'referee_invite_answered',
        title : 'กรรมการปฏิเสธคำเชิญ',
        message : `${referee?.full_name ?? 'กรรมการ'} ปฏิเสธคำเชิญเป็นกรรมการ`,
        relatedEntityType : 'tournament', relatedEntityId : invitation.tournament_id,
    });
}   



export async function listMatchReferees(matchId : number){
    // แถวใน match_referees = "จอง" — ใช้ได้จริงต่อเมื่อสถานะฝั่งทัวร์เป็น active (ตัด external ที่รอ admin)
    const rows = await MatchRefRepo.findByMatch(matchId);
    return { items : rows.filter(isActiveReferee).map(toMatchRefereeDto) };
}

export async function unassignRefereeFromMatch(matchId : number, tournamentRefereeId : number){
    // อ่านก่อนลบ — ต้องรู้ว่าเป็นใครและรับแมตช์ไว้แล้วหรือแค่ถูกเสนอ (declined = เขาไม่รับเองอยู่แล้ว ไม่ต้องแจ้ง)
    const row = (await MatchRefRepo.findByTournamentReferees([tournamentRefereeId])).find(r => r.match_id === matchId);
    const referee = await RefRepo.findById(tournamentRefereeId);

    const removed = await MatchRefRepo.unassign(matchId, tournamentRefereeId);
    if(!removed){
        throw new AppError(404, 'REFEREE_NOT_ASSIGNED', 'กรรมการคนนี้ไม่ได้ถูกมอบหมายให้แมตช์นี้');
    }

    if(referee && row && row.assignment_status !== 'declined'){
        await NotificationService.notify({
            userId : referee.user_id, type : 'referee_removed',
            title : row.assignment_status === 'accepted' ? 'คุณถูกถอดจากกรรมการแมตช์' : 'ผู้จัดถอนแมตช์ออกจากคำเชิญ',
            message : row.assignment_status === 'accepted'
                ? `ผู้จัดถอดคุณออกจากการเป็นกรรมการแมตช์ #${matchId} — ไม่ต้องไปคุมแมตช์นี้แล้ว`
                : `ผู้จัดถอนแมตช์ #${matchId} ออกจากคำเชิญเป็นกรรมการของคุณ`,
            relatedEntityType : 'match', relatedEntityId : matchId,
        });
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

/**
 * 🆕 F14 ท่อนที่สอง (FE ขอ 6 ต.ค. 2569) — กรรมการของทัวร์นี้ที่งานทับกับ **ทัวร์อื่น**
 *
 * 🔴 ทำไมต้องมี ทั้งที่มีด่านตอนกรรมการกดรับแล้ว (e872124)
 *   ด่านนั้นดักตอน "กดรับ" ⇒ ตอนนั้นเวลายังไม่ทับ
 *   แต่ M06 ปล่อยให้ ORG **เลื่อนเวลาแมตช์** ได้โดยไม่ดูกรรมการเลย (มติ Q6 — เตือน ไม่ block
 *   เพราะกรรมการแก้ได้ด้วยการสลับ/โอน/ถอนตัว ต่างจากทีมกับสนามที่แก้ไม่ได้)
 *   ⇒ เลื่อนแล้วเพิ่งทับ = ไม่มีใครรู้ · ที่นี่คือที่เดียวที่บอกได้
 *
 * ★ `conflictCount` เป็น **จำนวนแมตช์** ของทัวร์อื่นที่ทับกับแมตช์นี้ ไม่ใช่จำนวนทัวร์
 * 🔴 ไม่มีชื่อทัวร์ ไม่มีรหัสแมตช์ของทัวร์อื่นโดยเจตนา — ตารางงานของกรรมการในทัวร์อื่น
 *   ไม่ใช่ข้อมูลของ ORG คนนี้ · พอให้รู้ว่าควรไปถามกรรมการก่อน
 *   (กฎเดียวกับ `crossTournamentWarnings` ตอนเชิญ · คนที่เห็นชื่อทัวร์ได้คือเจ้าตัวเท่านั้น)
 */
type CrossTournamentConflict = {
    userId : number,
    /** แมตช์ของ **ทัวร์นี้** ที่มีปัญหา — ORG กดเข้าไปเลื่อน/เปลี่ยนกรรมการได้เลย */
    matchId : number,
    conflictCount : number
};

/** BR-11: on-site ที่ต้องบันทึกสถิติ ใช้กรรมการ 2 คน นอกนั้น 1 — ใช้ร่วมกับ C13 publish และ M10 start */
export async function refereesNeededPerMatch(sportTypeId : number): Promise<(mode : 'onsite' | 'online') => number> {
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
    const { byReferee, ...summary } = summarizeCoverage(rows, needed);
    return { ...summary, crossTournamentConflicts : await crossTournamentConflicts(tournamentId, byReferee) };
}

/**
 * เทียบแมตช์ของกรรมการแต่ละคน **ในทัวร์นี้** กับงานที่เขาถืออยู่ **นอกทัวร์นี้**
 *
 * ★ ถามฐานครั้งเดียวสำหรับกรรมการทุกคน (bookingsOfReferees) ไม่ใช่วนถามทีละคน
 *   ทัวร์ที่มีกรรมการ 10 คน = 10 คิวรีต่อการเปิดหน้า F14 หนึ่งครั้ง ซึ่ง ORG เปิดบ่อย
 * ★ `b.tournamentId !== tournamentId` คือหัวใจ — งานในทัวร์นี้ที่ทับกันเอง
 *   รายงานไปแล้วที่ `conflicts` ⇒ ไม่นับซ้ำที่นี่
 */
async function crossTournamentConflicts(
        tournamentId : number,
        byReferee : Map<number, { tournamentRefereeId : number, matches : MatchRefereeCoverageRow[] }>
        ): Promise<CrossTournamentConflict[]>{
    const held = await bookingsOfReferees([...byReferee.keys()]);
    const out : CrossTournamentConflict[] = [];
    for(const [userId, ref] of byReferee){
        const outside = (held.get(userId) ?? []).filter(b => b.tournamentId !== tournamentId);
        if(outside.length === 0) continue;
        for(const m of ref.matches){
            if(!m.scheduled_time || !m.scheduled_end_time) continue;
            const conflictCount = outside
                .filter(b => timesOverlap(m.scheduled_time!, m.scheduled_end_time!, b.scheduled_time!, b.scheduled_end_time!))
                .length;
            if(conflictCount > 0) out.push({ userId, matchId : m.match_id, conflictCount });
        }
    }
    // เรียงให้ผลคงที่ — FE แสดงเป็นลิสต์ และเทสเทียบตรง ๆ ได้
    return out.sort((a, b) => a.userId !== b.userId ? a.userId - b.userId : a.matchId - b.matchId);
}

function summarizeCoverage(rows : MatchRefereeCoverageRow[], needed : (mode : 'onsite' | 'online') => number){
    // 1. จับกลุ่มตามแมตช์ นับเฉพาะกรรมการที่ active จริง
    const matches = new Map<number, MatchCoverage & { row : MatchRefereeCoverageRow }>();
    /**
     * 🔴 แก้ 6 ต.ค. 2569 — จับกลุ่มด้วย `user_id` ไม่ใช่ `tournament_referee_id`
     *
     * เดิมจับกลุ่มด้วย id ของ **แถวคำเชิญ** ⇒ ถ้าคนเดียวมีหลายแถว active ในทัวร์เดียวกัน
     * F14 จะมองเป็นกรรมการหลายคน แล้ว **ไม่เทียบเวลาระหว่างแถว** ⇒ เวลาทับกันแต่เงียบ
     * ★ เคสนั้นเคยเกิดจริง — ดูคอมเมนต์ที่ inviteReferee ข้อ 2:
     *   "เจอของจริงในฐาน dev: ทัวร์ 2 มี 9002 เป็น accepted ค้างอยู่สามแถวพร้อมกัน"
     *   ด่าน REFEREE_ALREADY_ACCEPTED ถูกแก้ไปแล้ว 1 ต.ค. แต่แถวที่ค้างจากก่อนนั้นยังอยู่ได้
     *   และ GUIDE/11 §10.3 เขียนเจตนาไว้ว่า "หา REF ที่มี 2 แมตช์ทับกันทั้งทัวร์"
     *   — คำว่า REF หมายถึง **คน** ไม่ใช่แถว
     * 🙋 นี่คือการซ้อนเวลา **ในทัวร์เดียวกัน** เท่านั้น · การซ้อนข้ามทัวร์เป็นอีกเรื่อง
     */
    const byReferee = new Map<number, { tournamentRefereeId : number, matches : MatchRefereeCoverageRow[] }>();

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
        const ref = byReferee.get(r.user_id) ?? { tournamentRefereeId : r.tournament_referee_id, matches : [] };
        ref.matches.push(r);
        byReferee.set(r.user_id, ref);
    }

    // 2. แมตช์ที่ยังขาด
    const uncovered : MatchCoverage[] = [];
    for(const { row : _row, ...m } of matches.values()){
        if(m.assigned < m.needed) uncovered.push(m);
    }

    // 3. กรรมการที่รับแมตช์ซ้อนเวลา (เกิดได้เมื่อ ORG เลื่อนเวลาแมตช์ทีหลัง)
    const conflicts : RefereeConflict[] = [];
    for(const [userId, ref] of byReferee){
        const sorted = ref.matches
            .filter(m => m.scheduled_time && m.scheduled_end_time)
            .sort((a, b) => a.scheduled_time!.getTime() - b.scheduled_time!.getTime());
        for(let i = 1; i < sorted.length; i++){
            const prev = sorted[i - 1]!, cur = sorted[i]!;
            if(timesOverlap(prev.scheduled_time!, prev.scheduled_end_time!, cur.scheduled_time!, cur.scheduled_end_time!)){
                // tournamentRefereeId = แถวของ **แมตช์แรกในคู่ที่ทับ** (prev)
                // ถ้าคนนี้มีหลายแถว สองแมตช์อาจมาจากต่างแถวกัน ⇒ ค่านี้ตอบได้แค่แถวเดียว
                // คงคีย์เดิมไว้เพื่อไม่ให้ FE พัง · ตัวที่มีความหมายจริงคือ userId + matchIds
                conflicts.push({ tournamentRefereeId : prev.tournament_referee_id!, userId, matchIds : [prev.match_id, cur.match_id] });
            }
        }
    }

    return {
        matchesTotal : matches.size,
        matchesCovered : matches.size - uncovered.length,
        uncovered,
        conflicts,
        /** ★ ภายใน — getRefereeCoverage ใช้ต่อแล้วถอดออกก่อนตอบ ไม่ได้อยู่ใน response */
        byReferee
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

    // ปฏิเสธคำเชิญไปเองแล้ว = ไม่มีอะไรเปลี่ยนสำหรับเขา ไม่ต้องแจ้ง
    if(target.invitation_status !== 'rejected'){
        const tournament = await TournamentRepo.findTournamentById(tournamentId);
        await NotificationService.notify({
            userId : target.user_id, type : 'referee_removed',
            title : target.invitation_status === 'accepted' ? 'คุณถูกถอดจากกรรมการทัวร์นาเมนต์' : 'คำเชิญเป็นกรรมการถูกยกเลิก',
            message : target.invitation_status === 'accepted'
                ? `ผู้จัดถอดคุณออกจากการเป็นกรรมการทัวร์นาเมนต์ "${tournament?.name ?? ''}" — แมตช์ที่เคยรับไว้ไม่ต้องไปคุมแล้ว`
                : `ผู้จัดยกเลิกคำเชิญเป็นกรรมการทัวร์นาเมนต์ "${tournament?.name ?? ''}"`,
            relatedEntityType : 'tournament', relatedEntityId : tournamentId,
        });
    }

    const coverage = await getRefereeCoverage(tournamentId, sportTypeId);
    return { removed : true, uncoveredMatches : coverage.uncovered.map(m => m.matchId) };
}

/**
 * แถวที่ "นับเป็นกรรมการใช้งานได้" ของคนนี้ในทัวร์นี้ · null = ไม่มี (เพิ่ม 1 ต.ค. 2569)
 *
 * ตารางเป็น soft delete และ F-15 ตั้งใจให้มีแถว active ได้หลายแถว ⇒ ต้องมองทุกแถว ไม่ใช่แถวล่าสุดตาม id
 * เดิมสามที่เรียก findLatestByTournamentAndUser (ลบฟังก์ชันนั้นไปแล้ว 4 ต.ค.) แล้วถาม isActiveReferee กับแถวนั้นแถวเดียว
 * ⇒ ถ้าแถวล่าสุดเป็นแถวที่แอดมินปฏิเสธตัวตน (rejected_by_admin) ขณะที่แถวเก่า approved และยัง active
 *   จะตอบว่า "ไม่ใช่กรรมการ" ทั้งที่เป็น ⇒ คุมแมตช์/ส่งผล/โอนแมตช์ไม่ได้ทั้งที่มีสิทธิ์
 *
 * คืนแถวแรก (id น้อยสุด) ที่ใช้งานได้ เพื่อให้ผลคาดเดาได้เวลามีหลายแถวที่ใช้งานได้พร้อมกัน
 */
export async function findActiveRefereeRow(tournamentId : number, userId : number){
    const rows = await RefRepo.findActiveByTournamentAndUser(tournamentId, userId);
    return rows.find(row => isActiveReferee(row)) ?? null;
}

/** กรรมการคนนี้ใช้งานได้จริงหรือยัง — นิยามอยู่ที่ toRefereeStatus() ที่เดียว */
export function isActiveReferee(tr : RefereeStatusFields | null): boolean {
    if(!tr) return false;
    return toRefereeStatus(tr) === 'active';
}