import * as AnnouncementRepo from '../repositories/announcement.repo.js';
import { toAnnouncementDto } from '../mappers/announcement.mapper.js';
import { buildPagination } from '../utils/pagination.js';
import { checkAnnouncement } from '../utils/checkExist.js';
import type { AnnouncementRow } from '../types/db.js';
import * as NotificationService from './notification.service.js';

/**
 * คำนำหน้าหัวข้อแจ้งเตือนตามประเภทประกาศ — คนเห็นใน Inbox แล้วรู้ว่าด่วนไหมโดยไม่ต้องเปิดอ่าน
 * ตารางมี `announcement_type` อยู่แล้วตั้งแต่แรกแต่ไม่มีใครใช้ ประกาศทุกประเภทจึงหน้าตาเหมือนกันหมด
 */
const ANNOUNCEMENT_TITLE_PREFIX : Record<AnnouncementRow['announcement_type'] , string> = {
    general         : 'ประกาศจากผู้จัด',
    schedule_change : 'เปลี่ยนกำหนดการแข่ง',
    venue_change    : 'เปลี่ยนสนามแข่ง',
    result          : 'ประกาศผลการแข่งขัน',
    livestream      : 'ถ่ายทอดสด',
};

/**
 * E08 — ผู้จัดโพสต์ประกาศ
 *
 * เดิมบันทึกลงฐานแล้วจบ ประกาศขึ้นค้างในหน้าทัวร์เฉย ๆ คนต้องเข้าไปเปิดดูเองถึงจะเห็น
 * ⇒ ผู้จัดเลื่อนเวลาแข่ง/เปลี่ยนสนาม แล้วไม่มีใครรู้ (แก้ 1 ต.ค. 2569 ตามที่ FE แจ้งมา)
 *
 * ส่งถึง **กรรมการด้วย** ไม่ใช่แค่นักแข่ง — `notifyTournamentSquads` ครอบแค่ผู้เล่นในรายชื่อลงแข่ง
 * กับหัวหน้าทีม ส่วน `schedule_change`/`venue_change` เป็นเรื่องที่กรรมการต้องรู้ก่อนใคร
 * สองกลุ่มนี้ไม่ทับกันเพราะกฎ CoI ห้ามคนในทีมที่ลงแข่งเป็นกรรมการของทัวร์เดียวกัน (BR-04/P01)
 *
 * ⚠️ ชนิด `tournament_announcement` **ยังไม่มีในตารางหมวดแจ้งเตือน (OD-43)** ⇒ ยังเป็น `critical` โดยปริยาย ปิดไม่ได้
 *    ค้างไว้เพราะ **ชนิดเดียวคุมสองความหมาย** — เลื่อนเวลาแข่ง/เปลี่ยนสนาม คือไปผิดวันแล้วแพ้บาย
 *    ส่วนประกาศทั่วไป/ถ่ายทอดสด ไม่รู้ก็ไม่เสียอะไร → จะแยกเป็นสองชนิดหรือยุบเป็นหมวดเดียว ยังรอมติของทีม (OD-49)
 *    (`team_deleted` กับ `comment_rewritten_after_removal` เติมหมวดไปแล้ว 3 ต.ค. เหลือตัวนี้ตัวเดียว)
 */
export async function createAnnouncement(tournamentId : number , title : string , body : string , userId : number ,
                                         type : AnnouncementRow['announcement_type'] = 'general'){
    const id = await AnnouncementRepo.create(tournamentId , title , body , userId , type);
    const row = await checkAnnouncement(id);

    const content = {
        type : 'tournament_announcement',
        title : `${ANNOUNCEMENT_TITLE_PREFIX[type]}: ${title}`,
        message : body,
        relatedEntityType : 'tournament',
        relatedEntityId : tournamentId,
    };
    await NotificationService.notifyTournamentSquads(tournamentId , content , { exceptUserId : userId });
    await NotificationService.notifyTournamentReferees(tournamentId , content);

    return toAnnouncementDto(row);
}

export async function listAnnouncements(tournamentId : number , offset : number , page : number , pageSize : number){
    const { rows, totalItems } = await AnnouncementRepo.findByTournament(tournamentId , offset , pageSize);
    return {
        items : rows.map(toAnnouncementDto),
        pagination : buildPagination(page , pageSize , totalItems)
    };
}

/**
 * E10 — แก้ประกาศ · **ไม่ยิงแจ้งเตือนซ้ำโดยเจตนา** (เช่นเดียวกับ E11 ที่ลบ)
 * ผู้จัดแก้คำผิดคำเดียวจะกลายเป็นยิงใหม่ทั้งทัวร์ · ถ้าเรื่องสำคัญพอให้คนรู้อีกครั้ง ผู้จัดโพสต์ใหม่ได้
 */
export async function updateAnnouncement(announcementId : number ,
                                         changes : { title? : string , body? : string , type? : AnnouncementRow['announcement_type'] } ,
                                         userId : number){
    const repoChanges : { title? : string , content? : string , type? : AnnouncementRow['announcement_type'] } = {};
    if(changes.title !== undefined) repoChanges.title = changes.title;
    if(changes.body !== undefined) repoChanges.content = changes.body;
    if(changes.type !== undefined) repoChanges.type = changes.type;

    await AnnouncementRepo.update(announcementId , repoChanges , userId);
    const row = await checkAnnouncement(announcementId);
    return toAnnouncementDto(row);
}

export async function deleteAnnouncement(announcementId : number , userId : number){
    await AnnouncementRepo.softDelete(announcementId , userId);
}
