/**
 * OD-43 — หมวดของการแจ้งเตือน สำหรับให้ผู้ใช้เปิด/ปิดเป็นหมวด (spec 08 §3)
 *
 * แบ่งสองชั้นตามมติ:
 *   ชั้นที่ 1  `critical` = **ปิดไม่ได้** — เกณฑ์คือ "มีเส้นตายที่วัดได้ ไม่รู้แล้วเสียสิทธิ์ถาวร"
 *              ไม่ใช่ "สำคัญไหม" ซึ่งเถียงกันไม่จบ · เส้นตายทุกเส้นอ้างของจริงในฐาน/คอนฟิกได้
 *   ชั้นที่ 2  ที่เหลือแบ่งตามโดเมนให้หน้าตั้งค่าอ่านรู้เรื่อง — ผู้ใช้ปิดได้ทุกหมวด
 *
 * ชนิดที่ไม่อยู่ในตารางนี้ (ของใหม่ที่ยังไม่ได้จัดหมวด) ถือเป็น `critical` โดยปริยาย
 * เลือกทางนี้เพราะ "ลืมจัดหมวดแล้วแจ้งเตือนหายเงียบ" แย่กว่า "ลืมจัดหมวดแล้วปิดไม่ได้"
 */

/** หมวดที่ผู้ใช้ปิดได้ — คีย์เหล่านี้คือสิ่งที่เก็บใน `users.notification_prefs` */
export const MUTABLE_CATEGORIES = ['team', 'tournament', 'match', 'referee', 'result', 'community'] as const;

export type MutableCategory = typeof MUTABLE_CATEGORIES[number];
export type NotificationCategory = MutableCategory | 'critical';

/**
 * ชนิด → หมวด · เหตุผลของทุกตัวที่เป็น `critical` เขียนกำกับไว้ว่าเส้นตายคืออะไร
 * (ตัวที่ไม่ใช่ critical ไม่มีเส้นตาย — รู้ช้าก็ไม่เสียสิทธิ์อะไร)
 */
export const NOTIFICATION_CATEGORY: Record<string, NotificationCategory> = {
    // ── ทีม ──
    team_invited: 'critical',            // `team_invitations.expires_at` — คำเชิญหมดอายุใน 7 วัน (migration 013)
    team_invite_answered: 'team',
    team_member_removed: 'team',
    team_deleted: 'critical',            // เส้นตายคือ `registration_end` ของทัวร์ที่ใบสมัครค้าง — ทีมหายแล้วต้องไปหาทีมใหม่สมัครให้ทัน (เกณฑ์เดียวกันกับ `application_decided`)
                                         // ★ การกวาดทีมร้าง (TM-07) เกิดขึ้นโดยลูกทีมไม่ได้ทำอะไรเลย ปิดหมวดนี้แล้วทีมหายเงียบ 100%
    squad_below_minimum: 'critical',     // ต้องเติมคนก่อนแมตช์เริ่ม ไม่งั้น M10 ปรับแพ้บายทันที (`sport_types.min_members`)

    // ── ทัวร์นาเมนต์ + ใบสมัคร ──
    tournament_decided: 'tournament',
    tournament_published: 'tournament',
    registration_toggled: 'critical',    // `registration_start`–`registration_end` — ปิดรับสมัครแล้วสมัครไม่ได้อีก
    application_decided: 'critical',     // ถูกปฏิเสธแล้วยังไปสมัครทัวร์อื่นทันถ้ารู้เร็ว — เส้นตายคือ `registration_end` ของทัวร์อื่น
    application_withdrawn: 'tournament',

    // ── แมตช์ · ตาราง · สาย ──
    match_scheduled: 'critical',         // `matches.scheduled_time` — ไม่มาตามนัดคือแพ้บาย
    checkin_opened: 'critical',          // หน้าต่างเช็คอินปิดตอนกรรมการกด start — เช็คอินไม่ทันคือไม่ได้ลงแข่ง
    match_finished: 'critical',          // เริ่มนาฬิกา `SUBMIT_ESCALATION_HOURS` (24 ชม. ต้องส่งผล) และ `MVP_VOTING_HOURS`
    match_abandoned: 'match',            // ★ ก้ำกึ่ง — ล้างเช็คอินจริง แต่เวลานัดใหม่จะมาทาง `match_scheduled` ซึ่ง critical อยู่แล้ว
    match_walkover: 'match',             // ★ ก้ำกึ่ง — ผลตัดสินไปแล้ว รู้ช้าก็เปลี่ยนอะไรไม่ได้
    bracket_created: 'match',
    bracket_redrawn: 'critical',         // คู่แข่งเปลี่ยนและเวลาที่นัดไว้เดิมถูกยกเลิกทั้งหมด — ยึดตารางเก่าคือไปผิดวัน

    // ── กรรมการ ──
    referee_invited: 'critical',         // ต้องตอบก่อนทัวร์ publish ไม่งั้นทัวร์เปิดไม่ได้ (capacity ต้องครบ)
    referee_invite_answered: 'referee',
    referee_removed: 'referee',          // ★ ก้ำกึ่ง — สิทธิ์เปลี่ยนจริง แต่ไม่มีอะไรให้ทำทันเวลา
    referee_assigned: 'referee',
    referee_change_request: 'critical',  // คำขอเป็น `open` และถูก cancel ทันทีที่มีคนอื่นตอบก่อน
    referee_external_decided: 'critical',// ถ้าแอดมินขอเอกสารเพิ่ม ต้องส่งก่อนทัวร์ publish

    // ── ผลการแข่งขัน ──
    result_submitted: 'critical',        // `tournaments.dispute_window_hours` 6–72 ชม. — ไม่ค้านทันคือผลเป็นที่สุด
    result_verified: 'critical',         // เรื่องร้องเรียน (OD-26 ข้อ 8) ยื่นได้ก่อนปิดทัวร์เท่านั้น
    result_auto_verified: 'critical',    // `AUTO_VERIFY_HOURS` — ระบบยืนยันให้เอง เส้นตายเดียวกับข้างบน
    result_decided_by_organizer: 'critical', // ผู้จัดกรอกผลเอง (OD-26 ข้อ 6) — ยังโต้แย้งได้แต่มีเวลาจำกัด
    result_disputed: 'critical',         // `ORG_RESOLVE_HOURS` 48 ชม. ผู้จัดต้องตัดสิน
    result_resolved: 'result',
    match_result_complaint_filed: 'critical',  // ผู้จัดมี 48 ชม. แนบความเห็น แล้วขึ้นแอดมินอัตโนมัติ
    match_result_complaint_decided: 'result',

    // ── ชุมชน ──
    comment_removed: 'community',
    comment_reported: 'community',
    comment_rewritten_after_removal: 'community',   // ไม่มีเส้นตาย — ผู้จัดรู้ช้าก็ตรวจความเห็นได้ และแถวค้างในคิว `?reported=true` อยู่แล้ว
    feedback_removed_by_admin: 'community',
    feedback_restored: 'community',
    feedback_restore_overridden: 'community',
    pickem_cancelled: 'community',
};

/** ชนิดที่ยังไม่ได้จัดหมวด = critical (ปิดไม่ได้) — ปลอดภัยกว่าปล่อยให้หายเงียบ */
export function categoryOf(type: string): NotificationCategory {
    return NOTIFICATION_CATEGORY[type] ?? 'critical';
}

/** ค่าที่เก็บใน `users.notification_prefs` — คีย์ที่ไม่มี = เปิด (ค่าเริ่มต้นคือเปิดทุกหมวด) */
export type NotificationPrefs = Partial<Record<MutableCategory, boolean>>;

/** เติมค่าเริ่มต้นให้ครบทุกหมวด — NULL หรือ JSON เพี้ยนก็ได้ "เปิดหมด" */
export function resolvePrefs(stored: unknown): Record<MutableCategory, boolean> {
    const raw = (stored !== null && typeof stored === 'object' && !Array.isArray(stored))
        ? stored as Record<string, unknown> : {};
    return Object.fromEntries(
        MUTABLE_CATEGORIES.map(c => [c, raw[c] !== false])       // มีแต่ค่า false เท่านั้นที่แปลว่าปิด
    ) as Record<MutableCategory, boolean>;
}

/**
 * ชนิดที่ต้องซ่อนจากผู้ใช้คนนี้ — ใช้กรองตอน "อ่าน" ไม่ใช่ตอนเขียน (มติ: เปลี่ยนค่าแล้วมีผลย้อนหลัง)
 * คืนลิสต์ว่างเมื่อไม่ได้ปิดอะไรเลย เพื่อให้ฝั่ง repo ข้ามเงื่อนไข WHERE ไปได้
 */
export function mutedTypes(stored: unknown): string[] {
    const prefs = resolvePrefs(stored);
    const off = new Set(MUTABLE_CATEGORIES.filter(c => !prefs[c]));
    if (off.size === 0) return [];
    return Object.keys(NOTIFICATION_CATEGORY).filter(t => off.has(NOTIFICATION_CATEGORY[t] as MutableCategory));
}
