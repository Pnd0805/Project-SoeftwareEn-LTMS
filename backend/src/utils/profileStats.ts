import * as AdminRepo from '../repositories/adminScope.repo.js';
import type { UserRow } from '../types/db.js';

/**
 * OD-46 — "คนที่ดูอยู่ เห็นสถิติในโปรไฟล์ของคนนี้ได้ไหม"
 *
 * ที่เดียวที่ตอบคำถามนี้ ⇒ สามเส้นที่ผูกกับสวิตช์เดียวกัน (U04 stats · U14 career · RW05 match-history)
 * ตอบเหมือนกันแน่นอน · ถ้าเขียนด่านซ้ำสามที่ จะเพี้ยนกันเองเมื่อแก้ที่หนึ่งแล้วลืมอีกสองที่
 * (บั๊กคลาสเดียวกับสามด่านกรรมการที่แก้ไปใน d5bda6d)
 *
 * - เปิดอยู่ (ค่าเริ่มต้น) → ทุกคนเห็น รวมคนที่ไม่ล็อกอิน เหมือนก่อน migration 035
 * - ปิดแล้ว → เจ้าตัวยังเห็นของตัวเองเสมอ (ไม่งั้นปิดแล้วตัวเองก็ดูไม่ได้ ซึ่งไม่ใช่สิ่งที่ผู้ใช้ขอ)
 * - ปิดแล้ว → แอดมินทะลุได้ เพราะคิวคำร้องขอระงับผู้ใช้ตัดสินจากพฤติกรรมในสนาม
 *   ถ้าเป้าปิดสถิติได้แล้วแอดมินมองไม่เห็น การซ่อนจะกลายเป็นเครื่องมือหนีการตรวจ
 * - ผู้จัด/กรรมการ **ไม่** ทะลุ — เขาดูผลและสถิติของแมตช์ในทัวร์ตัวเองได้อยู่แล้วทางเส้นของทัวร์
 *   สิ่งที่ปิดคือหน้าโปรไฟล์ ไม่ใช่ข้อมูลการแข่งขัน
 *
 * ค้นสิทธิ์แอดมินเฉพาะตอนที่จำเป็นจริง (ปิดอยู่ + ไม่ใช่เจ้าตัว) ⇒ เส้นปกติไม่มี query เพิ่มเลย
 */
export async function canSeeProfileStats(target : UserRow , viewerUserId? : number) : Promise<boolean>{
    if(target.show_profile_stats === 1) return true;
    if(viewerUserId === undefined) return false;
    if(viewerUserId === target.user_id) return true;
    return (await AdminRepo.findAdminByUserId(viewerUserId)) !== null;
}
