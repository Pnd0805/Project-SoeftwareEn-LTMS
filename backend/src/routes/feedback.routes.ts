import express from 'express';
import { requireAuth, optionalAuth } from '../middlewares/requireAuth.js';
import { requireAdmin_U } from '../middlewares/requireAdmin_U.js';
import { validate } from '../middlewares/validate.js';
import { organizerFeedbackSchema, mvpVoteSchema, tournamentCommentSchema } from '../schemas/feedback.schema.js';
import * as Feedback from '../controllers/feedback.controller.js';

// C6 — mount ที่ /tournaments · GET เปิดสาธารณะ (ล็อกอินแล้วได้ข้อมูลของตัวเองเพิ่ม)
export const tournamentFeedbackRouter = express.Router();
tournamentFeedbackRouter.post('/:id/feedback' , requireAuth , validate(organizerFeedbackSchema) , Feedback.submitOrganizerFeedback);
tournamentFeedbackRouter.get('/:id/feedback' , optionalAuth , Feedback.getOrganizerFeedback);
tournamentFeedbackRouter.post('/:id/mvp-votes' , requireAuth , validate(mvpVoteSchema) , Feedback.castMvpVote);
tournamentFeedbackRouter.get('/:id/mvp-votes' , optionalAuth , Feedback.getMvpVotes);
// C7 คอมเมนต์ทัวร์ (มติ 22 ก.ย. — ย้ายจากรายแมตช์) · คนละ 1 อัน ส่งซ้ำ = แก้
tournamentFeedbackRouter.get('/:id/comments' , optionalAuth , Feedback.listTournamentComments);
tournamentFeedbackRouter.post('/:id/comments' , requireAuth , validate(tournamentCommentSchema) , Feedback.postTournamentComment);
tournamentFeedbackRouter.delete('/:id/comments/me' , requireAuth , Feedback.deleteOwnTournamentComment);

// mount ที่ /feedback — report ใช้ร่วมกับคอมเมนต์ทัวร์ (C7) · ลบโดยแอดมินก็ใช้ /admin/feedback/:id ร่วมกัน
export const feedbackRouter = express.Router();
feedbackRouter.post('/:id/report' , requireAuth , Feedback.reportFeedback);

// mount ที่ /admin — แอดมินทั้งมหาวิทยาลัยลบ (soft delete + audit)
export const adminFeedbackRouter = express.Router();
adminFeedbackRouter.delete('/feedback/:id' , requireAuth , requireAdmin_U , Feedback.removeFeedback);   // body { reason? } ไม่บังคับ
