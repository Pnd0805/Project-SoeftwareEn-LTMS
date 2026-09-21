import * as FeedbackRepo from '../repositories/feedback.repo.js';
import * as TournamentRepo from '../repositories/tournament.repo.js';
import * as AdminRepo from '../repositories/adminScope.repo.js';
import type { TournamentRow } from '../types/db.js';
import type { OrganizerFeedbackInput } from '../schemas/feedback.schema.js';
import { toFeedbackItemDto, toFeedbackSummaryDto, toMvpCandidateDto, toMyFeedbackDto } from '../mappers/feedback.mapper.js';
import { AppError } from '../utils/AppError.js';

/**
 * C6 — Tournament feedback / rating / MVP vote (spec 08 §4–5) · มติทีม 21 ก.ย. 2569 (แก้ข้อ 1–2 วันเดียวกัน)
 *   1. ให้คะแนนได้เฉพาะคนที่เกี่ยวข้อง (ผู้เล่นในรายชื่อ · หัวหน้าทีม) — ไม่รวมกรรมการ · ORG ให้คะแนนตัวเองไม่ได้
 *   2. ให้คะแนนได้ตลอด จนครบ 7 วันหลังปิดทัวร์ (ปิดพร้อม MVP) · MVP เริ่มโหวตหลังปิดทัวร์ โหวตได้ 7 วัน
 *   3. ส่งซ้ำ = เขียนทับ (feedback และ MVP)
 *   4. โหวต MVP ได้เฉพาะคนที่ไม่ได้ลงแข่ง (ไม่ใช่ผู้เล่น/สมาชิกทีมที่ผ่าน/กรรมการ/ORG) · ผู้ถูกโหวต = ผู้เล่นในรายชื่อลงแข่ง
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

function assertFeedbackOpen(tournament: TournamentRow, now = new Date()): void {
    const closesAt = feedbackClosesAt(tournament);
    if (closesAt !== null && now >= closesAt) {
        throw new AppError(409, 'FEEDBACK_CLOSED', `ปิดรับความเห็นแล้ว (ให้คะแนนได้ถึง ${MVP_VOTING_DAYS} วันหลังปิดทัวร์)`, { closesAt });
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
    assertFeedbackOpen(tournament);
    const blocker = await feedbackBlocker(tournament, userId);
    if (blocker) throw blocker;

    const existing = await FeedbackRepo.findOwn(tournamentId, userId, 'organizer_feedback');
    if (existing?.removed_at) {
        throw new AppError(409, 'FEEDBACK_REMOVED', 'ความเห็นของคุณในทัวร์นาเมนต์นี้ถูกผู้ดูแลระบบลบแล้ว ส่งใหม่ไม่ได้');
    }

    const content = input.content ? input.content : null;   // ข้อความว่าง = ไม่มีข้อความ
    await FeedbackRepo.upsertOrganizerFeedback(tournamentId, userId, input.rating, content);
    const saved = await FeedbackRepo.findOwn(tournamentId, userId, 'organizer_feedback');
    return { ...toMyFeedbackDto(saved!), isNew: existing === null };
}

/**
 * ใครก็ดูค่าเฉลี่ยได้ · คนที่ล็อกอินเห็นของตัวเอง + canSubmit
 * ORG เห็นข้อความทั้งหมดแต่ไม่เห็นชื่อ · แอดมินทั้งมหาวิทยาลัยเห็นชื่อด้วย (ใช้ตรวจ report)
 */
export async function getOrganizerFeedback(tournamentId: number, userId?: number) {
    const tournament = await getTournamentOr404(tournamentId);
    const summary = toFeedbackSummaryDto(await FeedbackRepo.summarizeOrganizerFeedback(tournamentId));
    const closesAt = feedbackClosesAt(tournament);
    if (userId === undefined) {
        return { summary, closesAt, mine: null, canSubmit: false, items: null };
    }

    const mineRow = await FeedbackRepo.findOwn(tournamentId, userId, 'organizer_feedback');
    const mine = mineRow && !mineRow.removed_at ? toMyFeedbackDto(mineRow) : null;
    const canSubmit = (closesAt === null || new Date() < closesAt)
        && !mineRow?.removed_at
        && (await feedbackBlocker(tournament, userId)) === null;

    const isOrganizer = tournament.requested_by_user_id === userId;
    const isAdmin = !isOrganizer && await isUniversityAdmin(userId);
    const items = isOrganizer || isAdmin
        ? (await FeedbackRepo.listOrganizerFeedback(tournamentId)).map(row => toFeedbackItemDto(row, isAdmin))
        : null;

    return { summary, closesAt, mine, canSubmit, items };
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

// ───────────────────────── report / ลบ ─────────────────────────

/**
 * report ได้เฉพาะคนที่มองเห็นข้อความนั้น — organizer_feedback เห็นแค่ ORG ของทัวร์ · โหวต MVP ไม่มีข้อความให้ report
 * (comment ของ C7 ใช้ endpoint นี้ร่วมได้ ใครที่ล็อกอินก็ report ได้)
 */
export async function reportFeedback(feedbackId: number, userId: number) {
    const feedback = await FeedbackRepo.findById(feedbackId);
    if (!feedback || feedback.removed_at) {
        throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'ไม่พบความเห็นนี้');
    }
    if (feedback.feedback_type === 'mvp_vote') {
        throw new AppError(400, 'FEEDBACK_NOT_REPORTABLE', 'โหวต MVP ไม่มีข้อความให้รายงาน');
    }
    if (feedback.feedback_type === 'organizer_feedback') {
        const tournament = await getTournamentOr404(feedback.tournament_id);
        if (tournament.requested_by_user_id !== userId) {
            throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'ไม่พบความเห็นนี้');   // คนอื่นมองไม่เห็นอยู่แล้ว — ไม่บอกว่ามีอยู่จริง
        }
    }
    if (!feedback.is_reported) {
        await FeedbackRepo.markReported(feedbackId);
    }
    return { id: feedbackId, isReported: true };
}

export async function removeFeedback(feedbackId: number, adminUserId: number, reason?: string) {
    const feedback = await FeedbackRepo.findById(feedbackId);
    if (!feedback) {
        throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'ไม่พบความเห็นนี้');
    }
    if (feedback.removed_at || !(await FeedbackRepo.removeByAdmin(feedbackId, adminUserId, reason ?? null))) {
        throw new AppError(409, 'FEEDBACK_ALREADY_REMOVED', 'ความเห็นนี้ถูกลบไปแล้ว');
    }
}
