import * as FeedbackRepo from '../repositories/feedback.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as AdminRepo from '../repositories/adminScope.repo.js';
import type { TournamentRow } from '../types/db.js';
import type { OrganizerFeedbackInput } from '../schemas/feedback.schema.js';
import type { CommentListRow } from '../repositories/feedback.repo.js';
import { toReviewItemDto, toReviewSummaryDto, toMvpCandidateDto, toMyReviewDto } from '../mappers/feedback.mapper.js';
import * as NotificationService from './notification.service.js';
import { AppError } from '../utils/AppError.js';
import { buildPagination } from '../utils/pagination.js';

/**
 * C6 — "รีวิวจากผู้ลงแข่ง" (organizer_feedback) + "โหวต MVP" (mvp_vote) · spec 08 §4–5 · มติทีม 21 ก.ย. 2569 (แก้ข้อ 1–2 วันเดียวกัน)
 * ★ ชื่อเรียก (ตกลง 23 ก.ย.): รีวิวจากผู้ลงแข่ง = ให้คะแนนการจัดงาน เฉพาะคนที่ลงแข่ง ข้อความเห็นแค่ผู้จัด
 *   ต่างจาก "ความเห็นต่อทัวร์" (comment, C7 ในไฟล์เดียวกันนี้) ที่ใครก็เขียนได้และทุกคนเห็น
 *   1. ให้คะแนนได้เฉพาะคนที่เกี่ยวข้อง (ผู้เล่นในรายชื่อ · หัวหน้าทีม) — ไม่รวมกรรมการ · ORG ให้คะแนนตัวเองไม่ได้
 *   2. ให้คะแนนได้ตั้งแต่ทัวร์เริ่ม (มติ 22 ก.ย.) จนครบ 7 วันหลังปิดทัวร์ (ปิดพร้อม MVP) · MVP เริ่มโหวตหลังปิดทัวร์ โหวตได้ 7 วัน
 *      ทัวร์เริ่ม = ถึงวันเริ่มทัวร์ (event_start_date เวลาไทย) หรือมีแมตช์ที่แข่งจริงแล้ว อย่างไหนถึงก่อน
 *   3. ส่งซ้ำ = เขียนทับ (feedback และ MVP)
 *   4. โหวต MVP ได้เฉพาะคนที่ไม่ได้ลงแข่ง (ไม่ใช่ผู้เล่น/สมาชิกทีมที่ผ่าน/กรรมการ/ORG) · ผู้ถูกโหวต = ผู้เล่นในรายชื่อลงแข่ง
 * + C7 คอมเมนต์ทัวร์ (มติ 22 ก.ย. — ย้ายจากรายแมตช์) อยู่ตารางเดียวกัน type 'comment' · ดูหัวข้อ "คอมเมนต์ทัวร์" ด้านล่าง
 */
export const MVP_VOTING_DAYS = 7;

async function getTournamentOr404(tournamentId: number): Promise<TournamentRow> {
    const tournament = await TournamentRepo.findTournamentById(tournamentId);
    if (!tournament) {
        throw new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้');
    }
    return tournament;
}

/** ให้คะแนนได้ตลอด แต่ถ้าปิดทัวร์แล้ว ปิดรับพร้อม MVP (ครบ 7 วันหลังปิดทัวร์) */
export function feedbackClosesAt(tournament: TournamentRow): Date | null {
    return mvpWindow(tournament).closesAt;
}

/** วันเริ่มทัวร์ 00:00 เวลาไทย — event_start_date เป็น DATE (pool ตั้ง dateStrings จึงได้ 'YYYY-MM-DD') */
export function feedbackOpensAt(tournament: TournamentRow): Date {
    return new Date(`${String(tournament.event_start_date).slice(0, 10)}T00:00:00+07:00`);
}

export type FeedbackStatus = 'not_started' | 'open' | 'closed';

/** not_started = ทัวร์ยังไม่เริ่ม · open = ให้คะแนน/แก้ได้ · closed = เลย 7 วันหลังปิดทัวร์ */
export async function feedbackStatus(tournament: TournamentRow, now = new Date()): Promise<FeedbackStatus> {
    if (!isFeedbackOpen(tournament, now)) return 'closed';
    if (tournament.tournament_status === 'completed' || now >= feedbackOpensAt(tournament)) return 'open';
    return (await FeedbackRepo.hasPlayedMatch(tournament.tournament_id)) ? 'open' : 'not_started';
}

/**
 * ทัวร์ที่ completed ก่อนมี migration 022 ไม่มี completed_at (ข้อมูลเก่าเท่านั้น — ระบบจริงใส่ให้ตอนกด B1 เสมอ)
 * ถือว่าเลย 7 วันไปแล้วแน่นอน → ปิดทั้งให้คะแนนและ MVP
 */
function isLegacyCompleted(tournament: TournamentRow): boolean {
    return tournament.tournament_status === 'completed' && !tournament.completed_at;
}

function isFeedbackOpen(tournament: TournamentRow, now = new Date()): boolean {
    if (isLegacyCompleted(tournament)) return false;
    const closesAt = feedbackClosesAt(tournament);
    return closesAt === null || now < closesAt;
}

async function assertFeedbackOpen(tournament: TournamentRow, now = new Date()): Promise<void> {
    const status = await feedbackStatus(tournament, now);
    if (status === 'closed') {
        throw new AppError(409, 'FEEDBACK_CLOSED', `ปิดรับความเห็นแล้ว (ให้คะแนนได้ถึง ${MVP_VOTING_DAYS} วันหลังปิดทัวร์)`,
            { closesAt: feedbackClosesAt(tournament) });
    }
    if (status === 'not_started') {
        throw new AppError(409, 'TOURNAMENT_NOT_STARTED', 'ให้คะแนนได้ตั้งแต่ทัวร์นาเมนต์เริ่มแข่ง',
            { opensAt: feedbackOpensAt(tournament) });
    }
}

function assertCompleted(tournament: TournamentRow): void {
    if (tournament.tournament_status !== 'completed') {
        throw new AppError(409, 'TOURNAMENT_NOT_COMPLETED', 'โหวต MVP ได้หลังทัวร์นาเมนต์ปิดการแข่งขันแล้วเท่านั้น');
    }
}

/** ช่วงโหวต MVP = ตั้งแต่ปิดทัวร์ ถึง +7 วัน */
export function mvpWindow(tournament: TournamentRow, now = new Date()) {
    if (tournament.tournament_status !== 'completed' || !tournament.completed_at) {
        return { opensAt: null, closesAt: null, isOpen: false };
    }
    const opensAt = new Date(tournament.completed_at);
    const closesAt = new Date(opensAt.getTime() + MVP_VOTING_DAYS * 24 * 60 * 60 * 1000);
    return { opensAt, closesAt, isOpen: now >= opensAt && now < closesAt };
}

/** ใครให้คะแนนทัวร์นี้ได้ — คืนเหตุผลที่ไม่ได้ ไว้ให้ FE ซ่อนฟอร์มได้ถูก */
async function feedbackBlocker(tournament: TournamentRow, userId: number): Promise<AppError | null> {
    if (tournament.requested_by_user_id === userId) {
        return new AppError(403, 'ORGANIZER_CANNOT_REVIEW_OWN', 'ผู้จัดให้คะแนนทัวร์นาเมนต์ของตัวเองไม่ได้');
    }
    if (!(await FeedbackRepo.isTournamentParticipant(tournament.tournament_id, userId))) {
        return new AppError(403, 'FEEDBACK_NOT_ALLOWED', 'ให้คะแนนได้เฉพาะผู้เล่นและหัวหน้าทีมที่ลงแข่งในทัวร์นาเมนต์นี้');
    }
    return null;
}

async function mvpVoterBlocker(tournament: TournamentRow, userId: number): Promise<AppError | null> {
    if (tournament.requested_by_user_id === userId
        || await FeedbackRepo.isTournamentInsider(tournament.tournament_id, userId)) {
        return new AppError(403, 'MVP_VOTER_NOT_ELIGIBLE',
            'ผู้เล่น สมาชิกทีมที่ลงแข่ง กรรมการ และผู้จัดของทัวร์นาเมนต์นี้โหวต MVP ไม่ได้');
    }
    return null;
}

async function isUniversityAdmin(userId: number): Promise<boolean> {
    const admin = await AdminRepo.findAdminByUserId(userId);
    return admin?.scope_type === 'university_wide';
}

// ───────────────────────── Organizer feedback ─────────────────────────

export async function submitOrganizerFeedback(tournamentId: number, userId: number, input: OrganizerFeedbackInput) {
    const tournament = await getTournamentOr404(tournamentId);
    await assertFeedbackOpen(tournament);
    const blocker = await feedbackBlocker(tournament, userId);
    if (blocker) throw blocker;

    const existing = await FeedbackRepo.findOwn(tournamentId, userId, 'organizer_feedback');
    if (existing?.removed_at) {
        throw new AppError(409, 'FEEDBACK_REMOVED', 'ความเห็นของคุณในทัวร์นาเมนต์นี้ถูกผู้ดูแลระบบลบแล้ว ส่งใหม่ไม่ได้');
    }

    const content = input.content ? input.content : null;   // ข้อความว่าง = ไม่มีข้อความ
    await FeedbackRepo.upsertOrganizerFeedback(tournamentId, userId, input.rating, content);
    const saved = await FeedbackRepo.findOwn(tournamentId, userId, 'organizer_feedback');
    return { ...toMyReviewDto(saved!), isNew: existing === null };
}

/**
 * ใครก็ดูค่าเฉลี่ยได้ · คนที่ล็อกอินเห็นของตัวเอง + canSubmit
 * ORG เห็นข้อความทั้งหมดแต่ไม่เห็นชื่อ · แอดมินทั้งมหาวิทยาลัยเห็นชื่อด้วย (ใช้ตรวจ report)
 */
export async function getOrganizerFeedback(tournamentId: number, userId?: number) {
    const tournament = await getTournamentOr404(tournamentId);
    const summary = toReviewSummaryDto(await FeedbackRepo.summarizeOrganizerFeedback(tournamentId));
    const status = await feedbackStatus(tournament);
    const opensAt = feedbackOpensAt(tournament);
    const closesAt = feedbackClosesAt(tournament);
    if (userId === undefined) {
        return { summary, status, opensAt, closesAt, mine: null, canSubmit: false, items: null };
    }

    const mineRow = await FeedbackRepo.findOwn(tournamentId, userId, 'organizer_feedback');
    const mine = mineRow && !mineRow.removed_at ? toMyReviewDto(mineRow) : null;
    const canSubmit = status === 'open'
        && !mineRow?.removed_at
        && (await feedbackBlocker(tournament, userId)) === null;

    const isOrganizer = tournament.requested_by_user_id === userId;
    const isAdmin = !isOrganizer && await isUniversityAdmin(userId);
    const items = isOrganizer || isAdmin
        ? (await FeedbackRepo.listOrganizerFeedback(tournamentId)).map(row => toReviewItemDto(row, isAdmin))
        : null;

    return { summary, status, opensAt, closesAt, mine, canSubmit, items };
}

// ───────────────────────── MVP vote ─────────────────────────

export async function castMvpVote(tournamentId: number, userId: number, candidateId: number) {
    const tournament = await getTournamentOr404(tournamentId);
    assertCompleted(tournament);
    const window = mvpWindow(tournament);
    if (!window.isOpen) {
        throw new AppError(409, 'MVP_VOTING_CLOSED', `ปิดโหวต MVP แล้ว (โหวตได้ ${MVP_VOTING_DAYS} วันหลังปิดทัวร์)`,
            { closesAt: window.closesAt });
    }
    const blocker = await mvpVoterBlocker(tournament, userId);
    if (blocker) throw blocker;

    const candidates = await FeedbackRepo.findMvpCandidates(tournamentId);
    if (!candidates.some(c => c.user_id === candidateId)) {
        throw new AppError(422, 'MVP_CANDIDATE_NOT_ELIGIBLE', 'โหวตได้เฉพาะผู้เล่นที่ลงแข่งในทัวร์นาเมนต์นี้');
    }

    const existing = await FeedbackRepo.findOwn(tournamentId, userId, 'mvp_vote');
    if (existing?.removed_at) {
        throw new AppError(409, 'FEEDBACK_REMOVED', 'โหวตของคุณในทัวร์นาเมนต์นี้ถูกผู้ดูแลระบบลบแล้ว โหวตใหม่ไม่ได้');
    }
    await FeedbackRepo.upsertMvpVote(tournamentId, userId, candidateId);
    return { tournamentId, votedForUserId: candidateId, changed: existing !== null && existing.voted_for_user_id !== candidateId };
}

export async function getMvpVotes(tournamentId: number, userId?: number) {
    const tournament = await getTournamentOr404(tournamentId);
    const window = mvpWindow(tournament);
    const candidates = (await FeedbackRepo.findMvpCandidates(tournamentId)).map(toMvpCandidateDto);
    const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);

    // ปิดโหวตแล้วถึงประกาศผล · คะแนนเท่ากันได้หลายคน
    const top = candidates[0]?.votes ?? 0;
    const winners = !window.isOpen && window.closesAt !== null && top > 0
        ? candidates.filter(c => c.votes === top).map(c => c.userId)
        : [];

    let mine: { votedForUserId: number } | null = null;
    let canVote = false;
    if (userId !== undefined) {
        const own = await FeedbackRepo.findOwn(tournamentId, userId, 'mvp_vote');
        mine = own && !own.removed_at ? { votedForUserId: own.voted_for_user_id! } : null;
        canVote = window.isOpen && !own?.removed_at && (await mvpVoterBlocker(tournament, userId)) === null;
    }

    return { window, candidates, totalVotes, winners, mine, canVote };
}

// ───────────────────────── คอมเมนต์ทัวร์ (C7 · มติ 22 ก.ย. 2569) ─────────────────────────
//   ทุกคนที่ล็อกอินคอมเมนต์ได้ (รวมคนในทัวร์) · ทุกคนอ่านได้ · คนละ 1 อันต่อทัวร์ ส่งซ้ำ = แก้ · เจ้าของลบเองได้
//   ทัวร์ต้อง public หรือ completed — private / รออนุมัติ ฯลฯ เขียนไม่ได้ และคนนอกอ่านไม่ได้ (เหมือนหน้าทัวร์)
//   report: ใครล็อกอินก็ได้ ยกเว้นของตัวเอง (POST /feedback/:id/report) · ลบของคนอื่น: แอดมินเท่านั้น (DELETE /admin/feedback/:id)

function isOpenToPublic(tournament: TournamentRow): boolean {
    return tournament.tournament_status === 'public' || tournament.tournament_status === 'completed';
}

function toCommentDto(row: CommentListRow, viewerId?: number) {
    return {
        id: row.tournament_feedback_id,
        tournamentId: row.tournament_id,
        author: { id: row.user_id, fullName: row.author_name, avatarUrl: row.author_avatar },
        content: row.content,
        createdAt: row.created_at,
        isMine: viewerId !== undefined && viewerId === row.user_id,
    };
}

/** ทัวร์ที่ไม่ได้เปิดเผยแพร่: เห็นเฉพาะผู้จัดกับแอดมินทั้งมหาวิทยาลัย — คนอื่น 404 เหมือนหน้าทัวร์ */
async function assertCommentsVisible(tournament: TournamentRow, viewerId?: number): Promise<void> {
    if (isOpenToPublic(tournament)) return;
    if (viewerId !== undefined && (tournament.requested_by_user_id === viewerId || await isUniversityAdmin(viewerId))) return;
    throw new AppError(404, 'TOURNAMENT_NOT_FOUND', 'ไม่พบทัวร์นาเมนต์นี้');
}

/** 201 ครั้งแรก · 200 แก้ของเดิม (isNew ให้ controller เลือก status) */
export async function postTournamentComment(tournamentId: number, userId: number, content: string) {
    const tournament = await getTournamentOr404(tournamentId);
    if (!isOpenToPublic(tournament)) {
        throw new AppError(409, 'TOURNAMENT_NOT_PUBLIC', 'ทัวร์นาเมนต์นี้ไม่ได้เปิดเผยแพร่ คอมเมนต์ไม่ได้');
    }
    const existing = await FeedbackRepo.findOwnComment(tournamentId, userId);
    if (existing?.removed_at) {
        throw new AppError(409, 'COMMENT_REMOVED', 'คอมเมนต์ของคุณในทัวร์นาเมนต์นี้ถูกผู้ดูแลระบบลบแล้ว ส่งใหม่ไม่ได้');
    }
    await FeedbackRepo.upsertComment(tournamentId, userId, content);
    const saved = await FeedbackRepo.findOwnComment(tournamentId, userId);
    return { ...toCommentDto(saved!, userId), isNew: existing === null };
}

export async function listTournamentComments(tournamentId: number, viewerId: number | undefined, page: number, pageSize: number, offset: number) {
    const tournament = await getTournamentOr404(tournamentId);
    await assertCommentsVisible(tournament, viewerId);
    const { rows, totalItems } = await FeedbackRepo.listComments(tournamentId, offset, pageSize);

    let mine = null;
    let canComment = false;
    if (viewerId !== undefined) {
        const own = await FeedbackRepo.findOwnComment(tournamentId, viewerId);
        mine = own && !own.removed_at ? toCommentDto(own, viewerId) : null;
        canComment = isOpenToPublic(tournament) && !own?.removed_at;
    }
    return {
        items: rows.map(r => toCommentDto(r, viewerId)),
        mine, canComment,
        pagination: buildPagination(page, pageSize, totalItems),
    };
}

/**
 * ผู้จัดลบความเห็นในทัวร์ของตัวเอง (มติ 23 ก.ย. ข้อ 6) — ดูแลหน้างานตัวเองได้ ไม่ต้องรอแอดมิน
 * แตะได้เฉพาะ `comment` · รีวิวจากผู้ลงแข่ง/โหวต MVP ลบไม่ได้ (เป็นการประเมินตัวผู้จัดเอง)
 * กันลบคำวิจารณ์เงียบ ๆ: reason บังคับ · เขียน audit `comment_removed_by_organizer` พร้อมคนเขียน · แจ้งเจ้าของความเห็น · แอดมินคืนได้
 */
export async function removeCommentByOrganizer(tournamentId: number, feedbackId: number, orgUserId: number, reason: string) {
    const tournament = await getTournamentOr404(tournamentId);
    const feedback = await FeedbackRepo.findById(feedbackId);
    if (!feedback || feedback.tournament_id !== tournamentId) {
        throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'ไม่พบความเห็นนี้ในทัวร์นาเมนต์นี้');
    }
    if (feedback.feedback_type !== 'comment') {
        throw new AppError(403, 'FEEDBACK_NOT_REMOVABLE_BY_ORGANIZER',
            'ผู้จัดลบได้เฉพาะความเห็นต่อทัวร์ — รีวิวจากผู้ลงแข่งและโหวต MVP ลบไม่ได้');
    }
    if (feedback.removed_at || !(await FeedbackRepo.softRemove(feedbackId, orgUserId, reason, {
        actionType: 'comment_removed_by_organizer',
        details: { tournamentId, authorUserId: feedback.user_id },
    }))) {
        throw new AppError(409, 'FEEDBACK_ALREADY_REMOVED', 'ความเห็นนี้ถูกลบไปแล้ว');
    }

    if (feedback.user_id !== orgUserId) {
        await NotificationService.notify({
            userId: feedback.user_id, type: 'comment_removed',
            title: 'ความเห็นของคุณถูกลบ',
            message: `ผู้จัดลบความเห็นของคุณในทัวร์นาเมนต์ "${tournament.name}" — เหตุผล: ${reason}`,
            relatedEntityType: 'tournament', relatedEntityId: tournamentId,
        });
    }
}

/** เจ้าของลบของตัวเอง → โพสต์ใหม่ได้ · ไม่มีให้ลบ → 404 · ถูกแอดมินลบไปแล้ว → 409 (ลบเพื่อโพสต์ใหม่ไม่ได้) */
export async function deleteOwnTournamentComment(tournamentId: number, userId: number): Promise<void> {
    await getTournamentOr404(tournamentId);
    const own = await FeedbackRepo.findOwnComment(tournamentId, userId);
    if (!own) {
        throw new AppError(404, 'COMMENT_NOT_FOUND', 'คุณยังไม่มีคอมเมนต์ในทัวร์นาเมนต์นี้');
    }
    if (own.removed_at) {
        throw new AppError(409, 'COMMENT_REMOVED', 'คอมเมนต์ของคุณในทัวร์นาเมนต์นี้ถูกผู้ดูแลระบบลบแล้ว');
    }
    await FeedbackRepo.deleteOwnComment(tournamentId, userId);
}

// ───────────────────────── report / ลบ ─────────────────────────

/**
 * report ได้เฉพาะคนที่มองเห็นข้อความนั้น — organizer_feedback เห็นแค่ ORG ของทัวร์ · โหวต MVP ไม่มีข้อความให้ report
 * comment (C7 คอมเมนต์ทัวร์) ใครที่ล็อกอินก็ report ได้ ยกเว้นของตัวเอง
 */
export async function reportFeedback(feedbackId: number, userId: number) {
    const feedback = await FeedbackRepo.findById(feedbackId);
    if (!feedback || feedback.removed_at) {
        throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'ไม่พบความเห็นนี้');
    }
    if (feedback.feedback_type === 'mvp_vote') {
        throw new AppError(400, 'FEEDBACK_NOT_REPORTABLE', 'โหวต MVP ไม่มีข้อความให้รายงาน');
    }
    if (feedback.feedback_type === 'comment' && feedback.user_id === userId) {
        throw new AppError(400, 'CANNOT_REPORT_OWN_COMMENT', 'รายงานคอมเมนต์ของตัวเองไม่ได้');
    }
    if (feedback.feedback_type === 'organizer_feedback') {
        const tournament = await getTournamentOr404(feedback.tournament_id);
        if (tournament.requested_by_user_id !== userId) {
            throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'ไม่พบความเห็นนี้');   // คนอื่นมองไม่เห็นอยู่แล้ว — ไม่บอกว่ามีอยู่จริง
        }
    }
    if (!feedback.is_reported) {
        await FeedbackRepo.markReported(feedbackId);
        // ความเห็นต่อทัวร์เป็นของสาธารณะบนหน้าผู้จัด — คนดูแลคือผู้จัด (มติ 23 ก.ย. ข้อ 6.4) · แจ้งครั้งแรกครั้งเดียว ไม่ใช่ทุกคนที่กด
        const tournament = feedback.feedback_type === 'comment' ? await TournamentRepo.findTournamentById(feedback.tournament_id) : null;
        if (tournament && tournament.requested_by_user_id !== userId) {
            await NotificationService.notify({
                userId: tournament.requested_by_user_id, type: 'comment_reported',
                title: 'มีคนรายงานความเห็นในทัวร์ของคุณ',
                message: `มีผู้รายงานความเห็นในทัวร์นาเมนต์ "${tournament.name}" — เข้าไปตรวจและลบได้ถ้าไม่เหมาะสม`,
                relatedEntityType: 'tournament', relatedEntityId: feedback.tournament_id,
            });
        }
    }
    return { id: feedbackId, isReported: true };
}

export async function removeFeedback(feedbackId: number, adminUserId: number, reason?: string) {
    const feedback = await FeedbackRepo.findById(feedbackId);
    if (!feedback) {
        throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'ไม่พบความเห็นนี้');
    }
    if (feedback.removed_at || !(await FeedbackRepo.softRemove(feedbackId, adminUserId, reason ?? null))) {
        throw new AppError(409, 'FEEDBACK_ALREADY_REMOVED', 'ความเห็นนี้ถูกลบไปแล้ว');
    }
}

/** แอดมินคืนความเห็นที่ถูกลบ (มติ 23 ก.ย. ข้อ 6.3.3) — ใช้ตอนเจ้าของอุทธรณ์ว่าผู้จัดลบคำวิจารณ์ */
export async function restoreFeedback(feedbackId: number, adminUserId: number) {
    const feedback = await FeedbackRepo.findById(feedbackId);
    if (!feedback) {
        throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'ไม่พบความเห็นนี้');
    }
    if (!feedback.removed_at || !(await FeedbackRepo.restore(feedbackId, adminUserId))) {
        throw new AppError(409, 'FEEDBACK_NOT_REMOVED', 'ความเห็นนี้ไม่ได้ถูกลบอยู่');
    }
    return { id: feedbackId, restored: true };
}
