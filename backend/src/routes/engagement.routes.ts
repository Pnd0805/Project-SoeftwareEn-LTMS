import express from 'express';
import { requireAuth, optionalAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { predictionSchema } from '../schemas/engagement.schema.js';
import * as Engagement from '../controllers/engagement.controller.js';

// C7 Pick'em — mount ที่ /matches · อ่านสาธารณะ (ล็อกอินแล้วได้ข้อมูลของตัวเองเพิ่ม)
// คอมเมนต์ย้ายไปอยู่ระดับทัวร์แล้ว (มติ 22 ก.ย.) → feedback.routes.ts `/tournaments/:id/comments`
export const matchEngagementRouter = express.Router();
matchEngagementRouter.post('/:id/predictions' , requireAuth , validate(predictionSchema) , Engagement.predict);
matchEngagementRouter.get('/:id/predictions/summary' , optionalAuth , Engagement.getPredictionSummary);
matchEngagementRouter.get('/:id/predictions/me' , requireAuth , Engagement.getMyPrediction);
matchEngagementRouter.delete('/:id/predictions/me' , requireAuth , Engagement.cancelPrediction);

// mount ที่ /me และ /tournaments
export const mePickemRouter = express.Router();
mePickemRouter.get('/pickem' , requireAuth , Engagement.getMyPickem);

export const tournamentPickemRouter = express.Router();
tournamentPickemRouter.get('/:id/pickem-leaderboard' , Engagement.getPickemLeaderboard);
