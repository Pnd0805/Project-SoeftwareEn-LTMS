import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { getMe , patchMe , getMyInvitation } from '../controllers/user.controller.js';
import * as TournamentController from '../controllers/tournament.controller.js';
import { validate } from '../middlewares/validate.js';
import { updateMeSchema } from '../schemas/user.schema.js';
import * as TeamController from '../controllers/team.controller.js';

const router = express.Router();

router.get('/' , requireAuth , getMe)
router.patch('/' , requireAuth , validate(updateMeSchema) , patchMe);
router.get('/teams' , requireAuth , TeamController.getMyTeam);

router.get('/invitations' , requireAuth , getMyInvitation);
router.get('/tournament-requests', requireAuth, TournamentController.getMyTournamentRequests);
export default router;
