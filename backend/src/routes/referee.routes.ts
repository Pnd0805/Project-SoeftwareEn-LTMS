import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireOrganizer } from '../middlewares/requireOrganizer.js';
import { validate } from '../middlewares/validate.js';
import { inviteRefereeSchema } from '../schemas/referee.schema.js';
import * as Referee from '../controllers/referee.controller.js';

export const tournamentRefereeRouter = express.Router();
export const matchRefereeRouter      = express.Router();
export const meRefereeRouter         = express.Router();
export const refereeInvitationRouter = express.Router();

// F01
tournamentRefereeRouter.post('/:id/referees',
    requireAuth, requireOrganizer, validate(inviteRefereeSchema), Referee.invite);