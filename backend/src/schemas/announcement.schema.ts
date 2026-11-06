import * as z from 'zod';

/**
 * `type` — คอลัมน์ `announcements.announcement_type` มีมาตั้งแต่ schema แรกพร้อม 5 ค่าและ NOT NULL
 * แต่เดิม INSERT ฮาร์ดโค้ด 'general' ทุกครั้งและไม่มี response ไหนคืนออกมา คอลัมน์จึงไม่ได้ทำอะไรเลย
 * ผู้จัดเลือกชนิดไม่ได้ และหน้าประกาศของ FE ติดป้าย "เปลี่ยนเวลา"/"ผลการแข่งขัน" ไม่ได้ (มติ 27 ก.ย.)
 * ไม่ส่งมา = 'general' เหมือนพฤติกรรมเดิม ของเก่าจึงไม่พัง
 */
export const announcementTypes = ['general' , 'schedule_change' , 'venue_change' , 'result' , 'livestream'] as const;

/**
 * 🔴 แก้ 7 ต.ค. 2569 (BE-29 · BE-30) — เดิมเป็น `z.string()` เปล่าทั้งสองช่อง
 *   BE-29: `{"title":"","body":""}` ได้ 201 หน้าประกาศขึ้นการ์ดเปล่า และ**ยิงแจ้งเตือนออกไป**
 *          ถึงหัวหน้าทีมทุกคนเป็น "ประกาศจากผู้จัด: " ที่ไม่มีหัวข้อ — เรียกคืนไม่ได้
 *   BE-30: หัวข้อ 300 ตัวทะลุ VARCHAR(255) ⇒ 500 INTERNAL_ERROR (เหมือน BE-09)
 *
 * เพดาน: `title` = 255 เท่าคอลัมน์ · `body` คอลัมน์เป็น TEXT (utf8mb4 ไทยได้ ~21,000 ตัว)
 * ★ ตั้ง body ไว้ 5,000 ตัว — **ผมเลือกเลขนี้เอง** เพราะคอลัมน์ไม่ได้บังคับ และประกาศคือข้อความ
 *   สั้น ๆ ที่ส่งเข้าแจ้งเตือน ไม่ใช่เอกสาร · ถ้าทีมอยากให้ยาวกว่านี้ แก้ที่เลขนี้ที่เดียว
 */
const title = z.string().trim().min(1 , 'กรุณาระบุหัวข้อประกาศ').max(255 , 'หัวข้อยาวได้ไม่เกิน 255 ตัวอักษร');
const body  = z.string().trim().min(1 , 'กรุณาระบุเนื้อหาประกาศ').max(5000 , 'เนื้อหายาวได้ไม่เกิน 5,000 ตัวอักษร');

export const createAnnouncementSchema = z.object({
    title,
    body,
    type : z.enum(announcementTypes).default('general')
});

export const updateAnnouncementSchema = z.object({
    title : title.optional(),
    body : body.optional(),
    type : z.enum(announcementTypes).optional()
});
