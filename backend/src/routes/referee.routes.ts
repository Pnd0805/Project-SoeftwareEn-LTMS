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

// F02
tournamentRefereeRouter.get('/:id/referees', requireAuth, requireOrganizer, Referee.list);

// F04
meRefereeRouter.get('/referee-invitations', requireAuth, Referee.listMyInvitations);

// F05 / F06
refereeInvitationRouter.post('/:id/accept', requireAuth, Referee.accept);
refereeInvitationRouter.post('/:id/decline', requireAuth, Referee.decline);