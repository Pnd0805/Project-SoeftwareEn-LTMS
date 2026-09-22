import * as CommentRepo from '../repositories/comment.repo.js';
import type { CommentRow } from '../repositories/comment.repo.js';
import * as MatchRepo from '../repositories/match.repo.js';
import { AppError } from '../utils/AppError.js';
import { buildPagination } from '../utils/pagination.js';

/**
 * C7 — คอมเมนต์ใต้แมตช์ (FR-CM-01 · spec 08 §4 · OD-24)
 *   ใครที่ล็อกอินก็คอมเมนต์ได้ (ไม่มีกฎผลประโยชน์ทับซ้อน — เป็นแค่การพูดคุย) · โพสต์ได้หลายอัน ≤ 500 ตัวอักษร
 *   อ่านเป็นสาธารณะ · ห้ามแก้ · เจ้าของลบเองได้ · ใครล็อกอินก็ report ได้ · แอดมินลบได้ (audit)
 *   คอมเมนต์ได้ตลอด แม้ทัวร์ปิดแล้ว (lockCompletedTournament ยกเว้น /comments)
 *   กันสแปม (มติ 22 ก.ย.): คนละไม่เกิน 5 คอมเมนต์ต่อ 60 วินาที รวมทุกแมตช์ → 429 COMMENT_RATE_LIMITED
 */

export const COMMENT_RATE_LIMIT = { max: 5, windowSeconds: 60 } as const;

function toCommentDto(row: CommentRow, viewerId?: number) {
    return {
        id: row.match_comment_id,
        matchId: row.match_id,
        author: { id: row.user_id, fullName: row.full_name, avatarUrl: row.profile_image_key },
        content: row.content,
        createdAt: row.created_at,
        isMine: viewerId !== undefined && viewerId === row.user_id,   // FE โชว์ปุ่มลบของตัวเอง
    };
}

async function assertMatchExists(matchId: number): Promise<void> {
    if (!(await MatchRepo.findMatchById(matchId))) {
        throw new AppError(404, 'MATCH_NOT_FOUND', 'ไม่พบแมตช์นี้');
    }
}

export async function postComment(matchId: number, userId: number, content: string) {
    await assertMatchExists(matchId);
    const recent = await CommentRepo.countRecentByUser(userId, COMMENT_RATE_LIMIT.windowSeconds);
    if (recent.count >= COMMENT_RATE_LIMIT.max) {
        throw new AppError(429, 'COMMENT_RATE_LIMITED',
            `คอมเมนต์ได้ไม่เกิน ${COMMENT_RATE_LIMIT.max} ครั้งต่อนาที ลองใหม่ในอีก ${recent.retryAfterSeconds} วินาที`,
            { retryAfterSeconds: recent.retryAfterSeconds });
    }
    const id = await CommentRepo.insert(matchId, userId, content);
    return toCommentDto((await CommentRepo.findById(id))!, userId);
}

export async function listComments(matchId: number, viewerId: number | undefined, page: number, pageSize: number, offset: number) {
    await assertMatchExists(matchId);
    const { rows, totalItems } = await CommentRepo.findByMatch(matchId, offset, pageSize);
    return { items: rows.map(r => toCommentDto(r, viewerId)), pagination: buildPagination(page, pageSize, totalItems) };
}

async function getLiveComment(commentId: number): Promise<CommentRow> {
    const comment = await CommentRepo.findById(commentId);
    if (!comment || comment.removed_at) {
        throw new AppError(404, 'COMMENT_NOT_FOUND', 'ไม่พบคอมเมนต์นี้');
    }
    return comment;
}

/** เจ้าของลบของตัวเอง — ของคนอื่นตอบ 403 (คอมเมนต์เป็นสาธารณะอยู่แล้ว ไม่ต้องซ่อนว่ามีอยู่จริง) */
export async function deleteOwnComment(commentId: number, userId: number) {
    const comment = await getLiveComment(commentId);
    if (comment.user_id !== userId) {
        throw new AppError(403, 'NOT_COMMENT_OWNER', 'ลบได้เฉพาะคอมเมนต์ของตัวเอง');
    }
    await CommentRepo.remove(commentId, userId, null);
}

/** ใครล็อกอินก็ report ได้ (ยกเว้นของตัวเอง) · กดซ้ำได้ผลเดิม */
export async function reportComment(commentId: number, userId: number) {
    const comment = await getLiveComment(commentId);
    if (comment.user_id === userId) {
        throw new AppError(400, 'CANNOT_REPORT_OWN_COMMENT', 'รายงานคอมเมนต์ของตัวเองไม่ได้ — ลบเองได้เลย');
    }
    if (!comment.is_reported) {
        await CommentRepo.markReported(commentId);
    }
    return { id: commentId, isReported: true };
}

export async function removeCommentByAdmin(commentId: number, adminUserId: number, reason?: string) {
    const comment = await CommentRepo.findById(commentId);
    if (!comment) {
        throw new AppError(404, 'COMMENT_NOT_FOUND', 'ไม่พบคอมเมนต์นี้');
    }
    if (comment.removed_at || !(await CommentRepo.remove(commentId, adminUserId, { reason: reason ?? null }))) {
        throw new AppError(409, 'COMMENT_ALREADY_REMOVED', 'คอมเมนต์นี้ถูกลบไปแล้ว');
    }
}
