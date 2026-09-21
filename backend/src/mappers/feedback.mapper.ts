import type { FeedbackListRow, FeedbackRow, FeedbackSummaryRow, MvpCandidateRow } from '../repositories/feedback.repo.js';

export function toFeedbackSummaryDto(row: FeedbackSummaryRow) {
    return {
        average: row.average === null ? null : Math.round(row.average * 10) / 10,   // ทศนิยม 1 ตำแหน่ง
        count: row.count,
        distribution: { 1: row.r1, 2: row.r2, 3: row.r3, 4: row.r4, 5: row.r5 },
    };
}

/** ของตัวเอง — เห็นข้อความตัวเองได้เสมอ */
export function toMyFeedbackDto(row: FeedbackRow) {
    return { id: row.tournament_feedback_id, rating: row.rating, content: row.content, createdAt: row.created_at };
}

/**
 * มุมผู้จัด: เห็นข้อความแต่ "ไม่เห็นชื่อ" (ให้คนกล้าติตรงๆ) · มุมแอดมิน: เห็นชื่อด้วย ไว้ใช้ตอนตรวจ report
 */
export function toFeedbackItemDto(row: FeedbackListRow, withAuthor: boolean) {
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
