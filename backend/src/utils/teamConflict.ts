import { REFEREE_INVITATION_DAYS } from '../config/scoring.js';

/**
 * 🆕 8 ต.ค. 2569 (FE ขอ) — ข้อความของ `TEAM_CONFLICT_OF_INTEREST` ฝั่ง "เข้าทีม"
 *
 * ประตูสามบานใช้ร่วมกัน: หัวหน้าทีมส่งคำเชิญ (`team.service`) · ผู้ถูกเชิญกดรับ
 * (`invitation.service`) · ขอเข้าทีมเอง (`joinRequest.service`)
 * ⇒ คนที่เจอปัญหาเดียวกันจากคนละทาง ต้องได้คำแนะนำเดียวกัน
 *
 * ★ อยู่ใน `utils/` ไม่ใช่ใน service หรือ repo ตามโครงของโปรเจกต์ — เป็นกฎล้วน ไม่แตะฐาน
 *   และถ้าฝังไว้ใน repo เทสของ service ที่ `vi.mock` repo จะได้ `undefined` แทนข้อความจริง
 *
 * `subject` ต่างกันเพราะคนอ่านไม่ใช่คนเดียวกัน
 *   'you'     = คนที่กำลังจะเข้าทีม อ่านเรื่องของตัวเอง
 *   'invitee' = หัวหน้าทีม อ่านเรื่องของคนที่ตัวเองเชิญ
 */
export type TeamConflict = {
    name : string;
    role : 'organizer' | 'referee';
    /** null เมื่อ role = 'organizer' — ผู้จัดไม่มีคำเชิญ จึงไม่มีสถานะ */
    invitation_status : 'pending' | 'accepted' | null;
};

export function teamConflictMessage(conflict : TeamConflict , subject : 'you' | 'invitee'): string {
    const who  = subject === 'you' ? 'คุณ' : 'ผู้ใช้นี้';
    const verb = subject === 'you' ? 'เข้าร่วมทีมไม่ได้' : 'เชิญเข้าทีมไม่ได้';
    const role = conflict.role === 'organizer' ? 'ผู้จัด' : 'กรรมการ';
    const head = `${who}เป็น${role}ของทัวร์นาเมนต์ "${conflict.name}" ที่ทีมนี้สมัครอยู่ ${verb}`;

    if(conflict.invitation_status !== 'pending') return head;

    /**
     * ★ กิ่งนี้คือเหตุผลทั้งหมดของการแก้รอบนี้
     *   เดิมบอกว่า "เป็นกรรมการ" ทั้งที่เขา **ยังไม่ได้ตอบรับคำเชิญเลย**
     *   ⇒ ผู้ใช้ไปตามให้ "เลิกเป็นกรรมการ" ซึ่งไม่มีอะไรให้เลิก = ทางตัน
     *   ทางออกจริงมีสามทาง และไม่มีทางไหนที่เดาได้จากข้อความเดิม
     *   (หลักเดียวกับที่ฝั่งสมัครทีมแก้ไปแล้วตอน BE-13 — นี่คือประตูอีกบานของกฎเดียวกัน)
     */
    return `${head} — คำเชิญกรรมการยังรอเขาตอบอยู่ ยังไม่ได้ตอบรับ`
         + ` ให้เขากดปฏิเสธคำเชิญ หรือให้ผู้จัดการแข่งขันยกเลิกคำเชิญ แล้วเข้าทีมได้ทันที`
         + ` (คำเชิญจะหมดอายุเองใน ${REFEREE_INVITATION_DAYS} วัน)`;
}
