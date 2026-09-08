import express from 'express';
import * as Application from '../controllers/application.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireOrganizer } from '../middlewares/requireOrganizer.js';
import { validate } from '../middlewares/validate.js';
import { rejectApplicationSchema, applyTournamentSchema } from '../schemas/application.schema.js';
const router = express.Router();

router.get('/tournaments/:id/teams' , Application.getTournamentTeams);
router.get('/me/applications' , requireAuth,  Application.getMyappication);
router.get('/tournaments/:id/applications' , requireAuth , requireOrganizer , Application.getTournamentApplications);
router.get('/applications/:id' , requireAuth , Application.getApplicationDetail);
router.post('/applications/:id/cancel' , requireAuth , Application.cancelApplication);
router.post('/applications/:id/withdraw' , requireAuth , Application.withdrawApplication);
router.post('/applications/:id/approve' , requireAuth , Application.approveApplication);
router.post('/applications/:id/reject' , requireAuth , validate(rejectApplicationSchema) , Application.rejectApplication)
router.post('/tournaments/:id/applications' , requireAuth , validate(applyTournamentSchema) , Application.applyTournament)
export default router;