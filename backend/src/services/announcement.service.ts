import * as AnnouncementRepo from '../repositories/announcement.repo.js';
import { toAnnouncementDto } from '../mappers/announcement.mapper.js';
import { buildPagination } from '../utils/pagination.js';
import { checkAnnouncement } from '../utils/checkExist.js';
import type { AnnouncementRow } from '../types/db.js';
import * as NotificationService from './notification.service.js';
import type { NotificationInput } from '../repositories/notification.repo.js';

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
 * ประเภทประกาศที่ถือว่า "ด่วน" ⇒ ยิงเป็นชนิด `tournament_announcement_urgent` ซึ่งอยู่หมวด `critical` ปิดไม่ได้
 *
 * เกณฑ์เดียวกับทั้งตารางหมวด: **มีเส้นตายที่วัดได้ ไม่รู้แล้วเสียสิทธิ์ถาวร** — สองตัวนี้อ้างของจริงได้
 * `matches.scheduled_time` (ไม่มาตามนัด = M10 ปรับแพ้บาย) และสนามที่ต้องไปถึงให้ทันเวลานั้น
 *
 * `result` ไม่อยู่ในนี้เพราะผลออกไปแล้ว รู้ช้าก็เปลี่ยนอะไรไม่ได้ (เหตุผลเดียวกับ `match_walkover`)
 * `livestream`/`general` ไม่มีเส้นตายของตัวเองเลย
 *
 * ★ เพิ่มประเภทประกาศใหม่ในอนาคต **ต้องมาตัดสินที่นี่ว่าด่วนไหม** — ไม่ใส่ = ไม่ด่วน = ผู้ใช้ปิดได้
 *   ซึ่งปลอดภัยกว่าทางกลับกัน เพราะ `ANNOUNCEMENT_TITLE_PREFIX` เป็น Record ที่ครบทุกประเภทอยู่แล้ว
 *   ⇒ ลืมเพิ่มคำนำหน้าจะ compile ไม่ผ่านก่อน และคนที่มาแก้จะเห็นไฟล์นี้พร้อมกัน
 */
const URGENT_ANNOUNCEMENT_TYPES = new Set<AnnouncementRow['announcement_type']>(['schedule_change' , 'venue_change']);

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
 * ★ **ยิงเป็นสองชนิด ไม่ใช่ชนิดเดียว** (3 ต.ค. · OD-49) — เพราะ `announcement_type` เดียวคุมสองความหมายที่คนละขั้ว
 *    `schedule_change`/`venue_change` ไม่รู้ = ไปผิดวัน/ผิดสนาม = แพ้บาย (M10) ⇒ ต้องปิดไม่ได้
 *    `general`/`result`/`livestream` ไม่รู้ก็ไม่เสียสิทธิ์ ⇒ ต้องปิดได้
 *    ถ้าใช้ชนิดเดียว เลือกหมวดไหนก็ผิดอีกทางเสมอ — ปิดไม่ได้ก็รบกวนจนคนไปปิดหมวดอื่นที่สำคัญกว่า
 *    ปิดได้ก็มีคนไปผิดวัน · แยกที่ **ชั้นยิง** ไม่ใช่ชั้นตั้งค่า เพราะคนที่รู้ว่าประกาศไหนด่วนคือที่นี่
 *
 * ⚠️ การกรองหมวดทำ **ตอนอ่าน** (OD-43) ⇒ ประกาศที่ยิงไป**ก่อน 3 ต.ค.** ถูกเก็บเป็น `tournament_announcement`
 *    ทั้งหมด **รวมของที่เลื่อนเวลา** ⇒ ของเก่ากลุ่มนั้นกลายเป็นปิดได้ย้อนหลัง · ตั้งใจไม่ backfill
 *    เพราะประกาศเก่าคือเรื่องที่ผ่านไปแล้ว ไม่มีใครต้องไปแข่งตามนั้นอีก (บันทึกไว้ใน OD-49)
 */
export async function createAnnouncement(tournamentId : number , title : string , body : string , userId : number ,
                                         type : AnnouncementRow['announcement_type'] = 'general'){
    const id = await AnnouncementRepo.create(tournamentId , title , body , userId , type);
    const row = await checkAnnouncement(id);

    // ระบุชนิดให้ tsc ตรง ๆ — ถ้าเก็บเป็นตัวแปรเปล่า ๆ ternary จะกว้างเป็น string แล้วหลุด union ของ NotificationInput
    const content : Omit<NotificationInput , 'userId'> = {
        type : URGENT_ANNOUNCEMENT_TYPES.has(type) ? 'tournament_announcement_urgent' : 'tournament_announcement',
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
