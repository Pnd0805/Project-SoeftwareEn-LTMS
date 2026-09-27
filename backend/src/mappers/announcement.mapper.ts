import type { AnnouncementRow } from "../types/db.js";

export type announcementDto = {
    id : number,
    /**
     * `announcements.announcement_type` — 5 ค่า NOT NULL มาตั้งแต่ schema แรก
     * แต่เดิม INSERT ฮาร์ดโค้ด 'general' และไม่มี response ไหนคืนออกมา คอลัมน์จึงไม่ได้ทำอะไรเลย (แก้ 27 ก.ย.)
     */
    type : AnnouncementRow['announcement_type'],
    title : string,
    body : string,
    createdAt : string
};

export function toAnnouncementDto(row : AnnouncementRow) : announcementDto{
    return {
        id : row.announcement_id,
        type : row.announcement_type,
        title : row.title,
        body : row.content,
        createdAt : row.created_at.toISOString()
    };
}
