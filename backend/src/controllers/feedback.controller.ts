import type { Request, Response } from 'express';
import { parseId } from '../utils/parseId.js';
import { AppError } from '../utils/AppError.js';
import * as FeedbackService from '../services/feedback.service.js';
import { removeFeedbackSchema } from '../schemas/feedback.schema.js';

function requireUserId(req: Request): number {
    if (!req.user) {
        throw new AppError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้นี้ในระบบ");
    }
    return req.user.user_id;
}

export async function submitOrganizerFeedback(req: Request, res: Response) {
    const userId = requireUserId(req);
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    const { isNew, ...feedback } = await FeedbackService.submitOrganizerFeedback(tournamentId, userId, req.body);
    res.status(isNew ? 201 : 200).json(feedback);
}

export async function getOrganizerFeedback(req: Request, res: Response) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await FeedbackService.getOrganizerFeedback(tournamentId, req.user?.user_id));
}

export async function castMvpVote(req: Request, res: Response) {
    const userId = requireUserId(req);
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await FeedbackService.castMvpVote(tournamentId, userId, req.body.userId));
}

export async function getMvpVotes(req: Request, res: Response) {
    const tournamentId = parseId(req.params['id'], 'รหัสทัวร์นาเมนต์');
    res.status(200).json(await FeedbackService.getMvpVotes(tournamentId, req.user?.user_id));
}

export async function reportFeedback(req: Request, res: Response) {
    const userId = requireUserId(req);
    const feedbackId = parseId(req.params['id'], 'รหัสความเห็น');
    res.status(200).json(await FeedbackService.reportFeedback(feedbackId, userId));
}

export async function removeFeedback(req: Request, res: Response) {
    const userId = requireUserId(req);
    const feedbackId = parseId(req.params['id'], 'รหัสความเห็น');
    const parsed = removeFeedbackSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        throw new AppError(400, "VALIDATION_FAILED", "ข้อมูลบางช่องไม่ถูกต้อง", { fields: { reason: parsed.error.issues[0]?.message ?? 'ไม่ถูกต้อง' } });
    }
    await FeedbackService.removeFeedback(feedbackId, userId, parsed.data.reason);
    res.status(204).send();
}
