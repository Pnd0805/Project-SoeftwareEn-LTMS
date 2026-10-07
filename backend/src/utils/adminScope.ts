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
/**
 * 🆕 FE-38 (7 ต.ค. 2569 · มติ ค ก) — กฎขอบเขตเดียวกับ `adminOverseesTournament` แต่เป็น SQL
 *
 * ใช้กับ **รายการ** ที่ต้องกรองในฐาน (กรองใน TS ไม่ได้ เพราะต้องแบ่งหน้าให้ถูก)
 * คืน `null` = คนนี้อ่านรายการนี้ไม่ได้เลย ⇒ ผู้เรียกต้องตอบ 403 ไม่ใช่คืนรายการว่าง
 *
 * ★ root ได้ `null` — ตรงกับ `adminOverseesTournament` ที่คืน false ให้ root
 *   ไม่ใช่ของแถม แต่เป็นมติ 28 ก.ย. (OD-34): root แต่งตั้ง+ตรวจ ไม่ใช่คนปฏิบัติงาน
 *   ของที่ root เห็นคือคิวค้างแบบไม่มีเนื้อหา (/admin/oversight/stalled)
 * ★ แอดมินคณะที่ไม่มี `faculty_id` ได้ `null` ด้วย — ข้อมูลไม่ครบต้องไม่กลายเป็น "เห็นทุกคณะ"
 *   (เคสนี้เจอจริงตอนทำ B6: fixture ที่ไม่ได้ตั้งคณะเลย กลับผ่านด่าน)
 *
 * 🔴 ถ้าแก้ตัวนี้ ต้องแก้ `adminOverseesTournament` ให้ตรงกันด้วย — สองตัวตอบคำถาม
 *   เดียวกันคนละรูป
 * ★ 7 ต.ค. 2569 — `tournament.repo.adminScopeWhere` (สำเนาเก่าที่ root ได้รายการว่างแทน 403)
 *   ถูกลบแล้ว · คิวคำขอทัวร์และคิว amendment มาใช้ตัวนี้ทั้งคู่ ⇒ ไม่มีสำเนาเหลือในระบบ
 * @param alias ชื่อย่อของตาราง `tournaments` ใน query ที่เรียก
 */
export function adminScopeSqlOrNull(admin : AdminScopeRow , alias = 't'): { clause : string; params : number[] } | null {
    if(admin.scope_type === 'university_wide') return { clause : '' , params : [] };
    if(admin.scope_type !== 'faculty') return null;
    if(typeof admin.faculty_id !== 'number') return null;
    return { clause : ` AND ${alias}.organizing_faculty_id = ?` , params : [admin.faculty_id] };
}

export function adminOverseesTournament(admin : AdminScopeRow , tournament : { organizing_faculty_id : number | null }): boolean {
    if(admin.scope_type === 'university_wide') return true;
    if(admin.scope_type !== 'faculty') return false;
    // 🔴 เทียบเฉพาะเมื่อเป็นเลขจริงทั้งคู่ — ไม่ใช้ `!== null` เพราะ undefined === undefined
    //   จะผ่านด่านไปได้ (เจอจริงตอนทำ B6: fixture ที่ไม่ได้ตั้งคณะเลย กลับผ่านด่าน)
    return typeof admin.faculty_id === 'number'
        && typeof tournament.organizing_faculty_id === 'number'
        && admin.faculty_id === tournament.organizing_faculty_id;
}
