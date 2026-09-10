import express from 'express';
import * as Match from '../controllers/match.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { scheduleMatchSchema } from '../schemas/match.schema.js';

const router = express.Router();

router.get('/tournaments/:id/matches' , Match.getTournamentMatches);
router.get('/matches/:id' , Match.getMatchDetail);
router.patch('/matches/:id/schedule' , requireAuth , validate(scheduleMatchSchema) , Match.scheduleMatch);
router.post('/matches/:id/open-checkin'  , requireAuth , Match.openCheckinMatch);
export default router;