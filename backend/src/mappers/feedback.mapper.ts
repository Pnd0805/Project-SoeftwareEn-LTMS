import type { FeedbackListRow, FeedbackRow, FeedbackSummaryRow, MvpCandidateRow } from '../repositories/feedback.repo.js';

/**
 * ตาราง tournament_feedback เก็บ 3 เรื่องที่ผูกกับทัวร์ — ชื่อเรียกที่ทีมตกลง 23 ก.ย. 2569 (อย่าปนกัน):
 *   organizer_feedback = "รีวิวจากผู้ลงแข่ง"   ให้คะแนน 1–5 + ข้อความ · เฉพาะผู้เล่น/หัวหน้าทีมที่ลงแข่ง · ข้อความเห็นแค่ผู้จัด (ไม่เห็นชื่อ)
 *   mvp_vote           = "โหวต MVP"           เฉพาะคนที่ไม่ได้ลงแข่ง · ผลนับเป็นสาธารณะ
 *   comment            = "ความเห็นต่อทัวร์"    ใครที่ล็อกอินก็เขียนได้ · ทุกคนเห็น (mapper ของ comment อยู่ใน feedback.service)
 * ฟังก์ชันในไฟล์นี้เป็นของ "รีวิว" และ "โหวต MVP" เท่านั้น
 */

/** สรุปรีวิวจากผู้ลงแข่ง (ค่าเฉลี่ย/จำนวน/การกระจาย) — สาธารณะ */
export function toReviewSummaryDto(row: FeedbackSummaryRow) {
    return {
        average: row.average === null ? null : Math.round(row.average * 10) / 10,   // ทศนิยม 1 ตำแหน่ง
        count: row.count,
        distribution: { 1: row.r1, 2: row.r2, 3: row.r3, 4: row.r4, 5: row.r5 },
    };
}

/** รีวิวของตัวเอง — เห็นข้อความตัวเองได้เสมอ */
export function toMyReviewDto(row: FeedbackRow) {
    return { id: row.tournament_feedback_id, rating: row.rating, content: row.content, createdAt: row.created_at };
}

/**
 * มุมผู้จัด: เห็นข้อความแต่ "ไม่เห็นชื่อ" (ให้คนกล้าติตรงๆ) · มุมแอดมิน: เห็นชื่อด้วย ไว้ใช้ตอนตรวจ report
 */
export function toReviewItemDto(row: FeedbackListRow, withAuthor: boolean) {
    return {
        id: row.tournament_feedback_id,
        rating: row.rating,
        content: row.content,
        isReported: Boolean(row.is_reported),
        createdAt: row.created_at,
        author: withAuthor ? { id: row.user_id, fullName: row.author_name } : null,
    };
}

export function toMvpCandidateDto(row: MvpCandidateRow) {
    return {
        userId: row.user_id,
        fullName: row.full_name,
        avatarUrl: row.profile_image_key,
        team: { id: row.team_id, name: row.team_name },
        votes: Number(row.votes),
    };
}
