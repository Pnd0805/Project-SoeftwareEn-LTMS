import express from 'express';
import * as Match from '../controllers/match.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { scheduleMatchSchema, rejectCheckinSchema, createBracketSchema, submitCheckinSchema } from '../schemas/match.schema.js';
import { requireReferee } from '../middlewares/requireReferee.js';
import { requireOrganizer } from '../middlewares/requireOrganizer.js';

const router = express.Router();

router.post('/tournaments/:id/bracket' , requireAuth , requireOrganizer , validate(createBracketSchema) , Match.createBracket);
router.get('/tournaments/:id/bracket' , Match.getBracket);
router.get('/tournaments/:id/matches' , Match.getTournamentMatches);
router.get('/matches/:id' , Match.getMatchDetail);
router.patch('/matches/:id/schedule' , requireAuth , validate(scheduleMatchSchema) , Match.scheduleMatch);
router.post('/matches/:id/open-checkin'  , requireAuth , Match.openCheckinMatch);
router.post('/matches/:id/start' , requireAuth , requireReferee , Match.startMatch);
router.get('/matches/:id/checkins' , requireAuth , Match.getMatchCheckins);
router.post('/matches/:id/checkins/:cid/verify' , requireAuth , requireReferee , Match.verifyCheckin);
router.post('/matches/:id/checkins/:cid/reject' , requireAuth , requireReferee , validate(rejectCheckinSchema) , Match.rejectCheckin);
router.get('/matches/:id/checkin-qr' , requireAuth , Match.getCheckinQr);
router.post('/matches/:id/checkins' , requireAuth , validate(submitCheckinSchema) , Match.submitCheckin);
export default router;