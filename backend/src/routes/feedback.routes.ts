import express from 'express';
import { requireAuth, optionalAuth } from '../middlewares/requireAuth.js';
import { requireAdmin_U } from '../middlewares/requireAdmin_U.js';
import { validate } from '../middlewares/validate.js';
import { organizerFeedbackSchema, mvpVoteSchema } from '../schemas/feedback.schema.js';
import * as Feedback from '../controllers/feedback.controller.js';

// C6 — mount ที่ /tournaments · GET เปิดสาธารณะ (ล็อกอินแล้วได้ข้อมูลของตัวเองเพิ่ม)
export const tournamentFeedbackRouter = express.Router();
tournamentFeedbackRouter.post('/:id/feedback' , requireAuth , validate(organizerFeedbackSchema) , Feedback.submitOrganizerFeedback);
tournamentFeedbackRouter.get('/:id/feedback' , optionalAuth , Feedback.getOrganizerFeedback);
tournamentFeedbackRouter.post('/:id/mvp-votes' , requireAuth , validate(mvpVoteSchema) , Feedback.castMvpVote);
tournamentFeedbackRouter.get('/:id/mvp-votes' , optionalAuth , Feedback.getMvpVotes);

// mount ที่ /feedback — report ใช้ร่วมกับ comment ของ C7 ได้
export const feedbackRouter = express.Router();
feedbackRouter.post('/:id/report' , requireAuth , Feedback.reportFeedback);

// mount ที่ /admin — แอดมินทั้งมหาวิทยาลัยลบ (soft delete + audit)
export const adminFeedbackRouter = express.Router();
adminFeedbackRouter.delete('/feedback/:id' , requireAuth , requireAdmin_U , Feedback.removeFeedback);   // body { reason? } ไม่บังคับ
