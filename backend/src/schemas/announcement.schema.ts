import * as z from 'zod';

/**
 * `type` — คอลัมน์ `announcements.announcement_type` มีมาตั้งแต่ schema แรกพร้อม 5 ค่าและ NOT NULL
 * แต่เดิม INSERT ฮาร์ดโค้ด 'general' ทุกครั้งและไม่มี response ไหนคืนออกมา คอลัมน์จึงไม่ได้ทำอะไรเลย
 * ผู้จัดเลือกชนิดไม่ได้ และหน้าประกาศของ FE ติดป้าย "เปลี่ยนเวลา"/"ผลการแข่งขัน" ไม่ได้ (มติ 27 ก.ย.)
 * ไม่ส่งมา = 'general' เหมือนพฤติกรรมเดิม ของเก่าจึงไม่พัง
 */
export const announcementTypes = ['general' , 'schedule_change' , 'venue_change' , 'result' , 'livestream'] as const;

export const createAnnouncementSchema = z.object({
    title : z.string(),
    body : z.string(),
    type : z.enum(announcementTypes).default('general')
});

export const updateAnnouncementSchema = z.object({
    title : z.string().optional(),
    body : z.string().optional(),
    type : z.enum(announcementTypes).optional()
});
