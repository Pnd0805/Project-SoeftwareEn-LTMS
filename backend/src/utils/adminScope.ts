import type { AdminScopeRow } from '../types/db.js';

/**
 * "แอดมินคนนี้ดูแลทัวร์นี้ไหม" — กฎเดียวที่ใช้ร่วมทุกที่
 *
 * university_wide  ดูแลทุกทัวร์
 * faculty          ดูแลเฉพาะทัวร์ที่คณะตัวเองเป็นเจ้าภาพ
 * root             ไม่ดูแลทัวร์ใด ๆ — ตามมติ 28 ก.ย. 2569 (OD-34) root เป็นคนแต่งตั้งและคนตรวจ
 *                  ไม่ใช่คนปฏิบัติงาน ⇒ ไม่เข้าไปอ่าน/ตัดสินเนื้อหาของงานประจำวัน
 *
 * ★ ย้ายมาจาก tournament.service (ชื่อเดิม canManageTournament) ตอนทำมติ B6 6 ต.ค. 2569
 *   เพราะ middleware ต้องใช้กฎเดียวกัน และ repository/middleware เรียก service ไม่ได้
 *   ⇒ ตรรกะล้วนอยู่ใน utils/ ตามโครงของโปรเจกต์
 */
export function adminOverseesTournament(admin : AdminScopeRow , tournament : { organizing_faculty_id : number | null }): boolean {
    if(admin.scope_type === 'university_wide') return true;
    if(admin.scope_type !== 'faculty') return false;
    // 🔴 เทียบเฉพาะเมื่อเป็นเลขจริงทั้งคู่ — ไม่ใช้ `!== null` เพราะ undefined === undefined
    //   จะผ่านด่านไปได้ (เจอจริงตอนทำ B6: fixture ที่ไม่ได้ตั้งคณะเลย กลับผ่านด่าน)
    return typeof admin.faculty_id === 'number'
        && typeof tournament.organizing_faculty_id === 'number'
        && admin.faculty_id === tournament.organizing_faculty_id;
}
