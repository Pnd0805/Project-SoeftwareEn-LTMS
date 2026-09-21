import express from 'express';
import { requireAuth, optionalAuth } from '../middlewares/requireAuth.js';
import { requireAdmin_U } from '../middlewares/requireAdmin_U.js';
import { validate } from '../middlewares/validate.js';
import { commentSchema, predictionSchema } from '../schemas/engagement.schema.js';
import * as Engagement from '../controllers/engagement.controller.js';

// C7 — mount ที่ /matches · อ่านสาธารณะ (ล็อกอินแล้วได้ข้อมูลของตัวเองเพิ่ม)
export const matchEngagementRouter = express.Router();
matchEngagementRouter.get('/:id/comments' , optionalAuth , Engagement.listComments);
matchEngagementRouter.post('/:id/comments' , requireAuth , validate(commentSchema) , Engagement.postComment);
matchEngagementRouter.post('/:id/predictions' , requireAuth , validate(predictionSchema) , Engagement.predict);
matchEngagementRouter.get('/:id/predictions/summary' , optionalAuth , Engagement.getPredictionSummary);
matchEngagementRouter.get('/:id/predictions/me' , requireAuth , Engagement.getMyPrediction);
matchEngagementRouter.delete('/:id/predictions/me' , requireAuth , Engagement.cancelPrediction);

// mount ที่ /comments
export const commentRouter = express.Router();
commentRouter.delete('/:id' , requireAuth , Engagement.deleteOwnComment);
commentRouter.post('/:id/report' , requireAuth , Engagement.reportComment);

// mount ที่ /admin — แอดมินทั้งมหาวิทยาลัยลบคอมเมนต์ (soft delete + audit) · body { reason? }
export const adminCommentRouter = express.Router();
adminCommentRouter.delete('/comments/:id' , requireAuth , requireAdmin_U , Engagement.removeCommentByAdmin);

// mount ที่ /me และ /tournaments
export const mePickemRouter = express.Router();
mePickemRouter.get('/pickem' , requireAuth , Engagement.getMyPickem);

export const tournamentPickemRouter = express.Router();
tournamentPickemRouter.get('/:id/pickem-leaderboard' , Engagement.getPickemLeaderboard);
