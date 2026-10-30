/**
 * 🔴 QA 30 ต.ค. 2569 (C2) — ชนะ MVP ด้วยบัญชีปลอม · มติเจ้าของงาน 30 ต.ค.
 *
 * `MVP_MIN_VOTES = 3` และตอนด่านยืนยันอีเมลปิด ใครก็สมัครบัญชีได้ไม่จำกัด
 *   ⇒ สร้าง 3 บัญชีโหวตให้ตัวเองแล้วได้ MVP
 * ⇒ **นับเฉพาะโหวตจากคนที่อยู่ในรายชื่อลงแข่ง (application_players) ของใบสมัครที่ approved ในทัวร์นั้น**
 *   ชุดเดียวกับที่ findMatchAudience ใช้ · ตรงความหมายของ MVP (คนในทัวร์เป็นคนตัดสิน)
 *   บัญชีปลอมที่ไม่ได้ลงแข่งโหวตได้ แต่ **ไม่ถูกนับ**
 *
 * 🔴 ห้าม "แก้ให้ดีขึ้น" ด้วยการผูกกับ `email_verified` แทน — มีเหตุผลสองข้อ:
 *   ① บัญชีจริงเกือบทั้งหมดยัง `email_verified = 0` (ด่านเพิ่งมี และยังปิดอยู่) ⇒ โหวตจะแทบไม่นับใครเลย
 *   ② `emailVerifiedSql()` คืน `'1'` (ผ่านหมด) เมื่อสวิตช์ปิด ⇒ ด่านจะไม่ทำงานเลย **ในสถานะที่ถูกโจมตีได้พอดี**
 *
 * ★ ใช้ทุกที่ที่นับโหวต MVP: ยอดในหน้าผลโหวต (feedback.repo) · `mvp_votes` / `mvp_times` ในโปรไฟล์ (playerStat.repo)
 *   🔴 แก้ที่หนึ่งต้องแก้ทุกที่ — ไม่งั้นหน้าผลโหวตกับโปรไฟล์จะนับจากชุดโหวตต่างกัน
 *
 * @param alias ชื่อเล่นของตาราง `tournament_feedback` ใน query ที่เรียก
 */
export function mvpEligibleVoterSql(alias : string): string {
    return `EXISTS (SELECT 1 FROM tournament_applications mvp_ta
                      JOIN application_players mvp_ap ON mvp_ap.tournament_application_id = mvp_ta.tournament_application_id
                     WHERE mvp_ta.tournament_id = ${alias}.tournament_id
                       AND mvp_ta.tournament_application_status = 'approved'
                       AND mvp_ap.user_id = ${alias}.user_id)`;
}
