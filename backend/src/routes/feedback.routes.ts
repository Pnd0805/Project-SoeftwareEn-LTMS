import express from 'express';
import { requireAuth, optionalAuth } from '../middlewares/requireAuth.js';
import { requireAdmin_U } from '../middlewares/requireAdmin_U.js';
import { requireOrganizer } from '../middlewares/requireOrganizer.js';
import { validate } from '../middlewares/validate.js';
import { organizerFeedbackSchema, mvpVoteSchema, tournamentCommentSchema } from '../schemas/feedback.schema.js';
import * as Feedback from '../controllers/feedback.controller.js';

// C6 — mount ที่ /tournaments · GET เปิดสาธารณะ (ล็อกอินแล้วได้ข้อมูลของตัวเองเพิ่ม)
export const tournamentFeedbackRouter = express.Router();
tournamentFeedbackRouter.post('/:id/feedback' , requireAuth , validate(organizerFeedbackSchema) , Feedback.submitOrganizerFeedback);
tournamentFeedbackRouter.get('/:id/feedback' , optionalAuth , Feedback.getOrganizerFeedback);
// C7 คอมเมนต์ทัวร์ (มติ 22 ก.ย. — ย้ายจากรายแมตช์) · คนละ 1 อัน ส่งซ้ำ = แก้
tournamentFeedbackRouter.get('/:id/comments' , optionalAuth , Feedback.listTournamentComments);
tournamentFeedbackRouter.post('/:id/comments' , requireAuth , validate(tournamentCommentSchema) , Feedback.postTournamentComment);
tournamentFeedbackRouter.delete('/:id/comments/me' , requireAuth , Feedback.deleteOwnTournamentComment);
// ผู้จัดลบความเห็นของคนอื่นในทัวร์ตัวเอง (มติ 23 ก.ย.) · body { reason } บังคับ — ต้องอยู่หลัง /comments/me ไม่งั้น 'me' โดนจับเป็น :cid
tournamentFeedbackRouter.delete('/:id/comments/:cid' , requireAuth , requireOrganizer , Feedback.removeCommentByOrganizer);

// mount ที่ /matches — โหวต MVP ย้ายมาเป็นรายแมตช์ (มติ 26 ก.ย.) · path ยังเป็น /mvp-votes เหมือนเดิม
// จึงยังเข้าข้อยกเว้นของ lockCompletedTournament (โหวตได้แม้ทัวร์ปิดไปแล้ว ถ้ายังไม่พ้น 24 ชม. หลังแมตช์จบ)
export const matchMvpRouter = express.Router();
matchMvpRouter.post('/:id/mvp-votes' , requireAuth , validate(mvpVoteSchema) , Feedback.castMvpVote);
matchMvpRouter.get('/:id/mvp-votes' , optionalAuth , Feedback.getMvpVotes);

// mount ที่ /feedback — report ใช้ร่วมกับคอมเมนต์ทัวร์ (C7) · ลบโดยแอดมินก็ใช้ /admin/feedback/:id ร่วมกัน
export const feedbackRouter = express.Router();
feedbackRouter.post('/:id/report' , requireAuth , Feedback.reportFeedback);

// mount ที่ /admin — แอดมินทั้งมหาวิทยาลัยลบ (soft delete + audit)
export const adminFeedbackRouter = express.Router();
adminFeedbackRouter.delete('/feedback/:id' , requireAuth , requireAdmin_U , Feedback.removeFeedback);   // body { reason? } ไม่บังคับ
adminFeedbackRouter.post('/feedback/:id/restore' , requireAuth , requireAdmin_U , Feedback.restoreFeedback);   // คืนของที่ถูกลบ (เจ้าของอุทธรณ์)
