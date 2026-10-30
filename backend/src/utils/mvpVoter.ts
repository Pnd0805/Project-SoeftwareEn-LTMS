/**
 * ใครนับเป็น "โหวต MVP ที่ใช้ได้" — ด่านนี้ใช้ทั้งตอนกดโหวตและตอนนับคะแนน
 *
 * ═══ มติเจ้าของงาน 30 ต.ค. 2569 (แก้ของ QA C2 รอบแรก) ═══
 * เป้าหมายของ MVP คือ **ให้คนที่ไม่มีส่วนได้ส่วนเสียกับแมตช์นั้นเป็นคนตัดสิน**
 *   ⇒ โหวตได้ทุกคนที่ล็อกอิน **ยกเว้นสามกลุ่มที่มีส่วนเกี่ยวข้องกับแมตช์นั้น**
 *       ① ORG ของทัวร์นั้น (`tournaments.requested_by_user_id`)
 *       ② กรรมการของ **แมตช์นั้น** (`match_referees` ที่ accepted และยัง active)
 *       ③ คนในทีมที่ลงแข่งแมตช์นั้น (สมาชิกทีม + หัวหน้าทีม ทั้งสองทีม)
 *   ตรงกับมติ 26 ก.ย. ข้อ 2 เดิม ("ทุกคนที่ล็อกอิน ยกเว้นสมาชิกของสองทีมในแมตช์นั้น")
 *   แค่เติม ORG และกรรมการเข้าไปในรายการยกเว้น
 *
 * 🔴 นี่คือการ **กลับทิศ** ของด่าน QA C2 รอบแรก (29→30 ต.ค.) ที่นับเฉพาะคนในรายชื่อลงแข่งของทัวร์
 *   ของเดิมผิดเป้าสองทาง:
 *     ① คนนอกที่เป็นกลุ่มเป้าหมายจริงของ MVP กดโหวตได้ แต่โหวต **ถูกทิ้งเงียบ ๆ** (กดแล้วไม่มีผล ไม่มีใครรู้)
 *     ② คนในทัวร์ที่เหลือ = ผู้เล่นทีมอื่น ซึ่งเป็นคู่แข่ง ⇒ มีส่วนได้ส่วนเสียมากกว่าคนนอก
 *
 * 🔴 ช่องที่ยังเปิดอยู่และ **รู้ตัว** (QA C2 ข้อเดิม) — `MVP_MIN_VOTES = 3` และตอนด่านยืนยันอีเมลปิด
 *   ใครก็สมัครบัญชีได้ไม่จำกัด ⇒ สร้าง 3 บัญชีโหวตให้ตัวเองก็ยังได้ MVP
 *   ด่านนี้ **ไม่ได้กันเรื่องนั้น** และกันไม่ได้โดยธรรมชาติของกฎ "ใครล็อกอินก็โหวตได้"
 *   ⇒ ถ้าจะปิด ต้องปิดด้วยเงื่อนไขเรื่องตัวบัญชี (เช่น อายุบัญชีก่อนแมตช์จบ) ไม่ใช่เรื่องบทบาทในแมตช์
 *
 * 🔴 ห้ามปิดด้วย `email_verified` — เหตุผลเดิมยังอยู่ทั้งสองข้อ:
 *   ① บัญชีจริงเกือบทั้งหมดยัง `email_verified = 0` (ด่านเพิ่งมี และยังปิดอยู่) ⇒ โหวตจะแทบไม่นับใครเลย
 *   ② `emailVerifiedSql()` คืน `'1'` (ผ่านหมด) เมื่อสวิตช์ปิด ⇒ ด่านจะไม่ทำงานเลย **ในสถานะที่ถูกโจมตีได้พอดี**
 *
 * ★ ใช้ทุกที่ที่นับโหวต MVP: ยอดในหน้าผลโหวต (feedback.repo) · `mvp_votes` / `mvp_times` ในโปรไฟล์ (playerStat.repo)
 *   🔴 แก้ที่หนึ่งต้องแก้ทุกที่ — ไม่งั้นหน้าผลโหวตกับโปรไฟล์จะนับจากชุดโหวตต่างกัน
 * ★ กฎชุดเดียวกันนี้ถูกบังคับตอนกดโหวตด้วย (`FeedbackRepo.findMvpVoterConflict`)
 *   🔴 แก้ที่นี่แล้วต้องแก้ที่นั่นให้ตรงกัน ไม่งั้นจะเกิดสภาพ "กดโหวตผ่าน แต่ไม่ถูกนับ" ซึ่งคือข้อเสียของรอบแรก
 *
 * ★ แถวโหวตเก่าที่ `match_id IS NULL` (MVP ระดับทัวร์ ก่อน 26 ก.ย.) — สองด่านล่างไม่มีแมตช์ให้เทียบ
 *   จึงผ่านอัตโนมัติ เหลือแค่ด่าน ORG ซึ่งยังเทียบได้จาก `tournament_id` ⇒ ตรงความหมายเดิมที่สุดเท่าที่ทำได้
 *
 * @param alias ชื่อเล่นของตาราง `tournament_feedback` ใน query ที่เรียก
 */
export function mvpEligibleVoterSql(alias : string): string {
    return `NOT EXISTS (SELECT 1 FROM tournaments mvp_t
                         WHERE mvp_t.tournament_id = ${alias}.tournament_id
                           AND mvp_t.requested_by_user_id = ${alias}.user_id)
            AND NOT EXISTS (SELECT 1 FROM match_referees mvp_mr
                              JOIN tournament_referees mvp_tr
                                ON mvp_tr.tournament_referee_id = mvp_mr.tournament_referee_id
                             WHERE mvp_mr.match_id = ${alias}.match_id
                               AND mvp_mr.assignment_status = 'accepted'
                               AND mvp_tr.removed_at IS NULL
                               AND mvp_tr.user_id = ${alias}.user_id)
            AND NOT EXISTS (SELECT 1 FROM matches mvp_m
                             WHERE mvp_m.match_id = ${alias}.match_id
                               AND (EXISTS (SELECT 1 FROM team_members mvp_tm
                                             WHERE mvp_tm.team_id IN (mvp_m.team_a_id, mvp_m.team_b_id)
                                               AND mvp_tm.user_id = ${alias}.user_id)
                                 OR EXISTS (SELECT 1 FROM teams mvp_te
                                             WHERE mvp_te.team_id IN (mvp_m.team_a_id, mvp_m.team_b_id)
                                               AND mvp_te.leader_id = ${alias}.user_id)))`;
}
