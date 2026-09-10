import express from 'express';
import * as Match from '../controllers/match.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { scheduleMatchSchema, rejectCheckinSchema } from '../schemas/match.schema.js';
import { requireReferee } from '../middlewares/requireReferee.js';

const router = express.Router();

router.get('/tournaments/:id/matches' , Match.getTournamentMatches);
router.get('/matches/:id' , Match.getMatchDetail);
router.patch('/matches/:id/schedule' , requireAuth , validate(scheduleMatchSchema) , Match.scheduleMatch);
router.post('/matches/:id/open-checkin'  , requireAuth , Match.openCheckinMatch);
router.post('/matches/:id/start' , requireAuth , requireReferee , Match.startMatch);
router.get('/matches/:id/checkins' , requireAuth , Match.getMatchCheckins);
router.post('/matches/:id/checkins/:cid/verify' , requireAuth , requireReferee , Match.verifyCheckin);
router.post('/matches/:id/checkins/:cid/reject' , requireAuth , requireReferee , validate(rejectCheckinSchema) , Match.rejectCheckin);
export default router;