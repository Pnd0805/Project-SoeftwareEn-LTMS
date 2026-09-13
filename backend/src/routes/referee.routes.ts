import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireOrganizer } from '../middlewares/requireOrganizer.js';
import { validate } from '../middlewares/validate.js';
import { inviteRefereeSchema, acceptInvitationSchema } from '../schemas/referee.schema.js';
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
refereeInvitationRouter.post('/:id/accept', requireAuth, validate(acceptInvitationSchema), Referee.accept);
refereeInvitationRouter.post('/:id/decline', requireAuth, Referee.decline);

import { requireOrganizerOfMatch } from '../middlewares/requireOrganizer.js';
import { assignRefereeSchema } from '../schemas/referee.schema.js';

// F11
matchRefereeRouter.post('/:id/referees',
    requireAuth, requireOrganizerOfMatch, validate(assignRefereeSchema), Referee.assignToMatch);

// F12 — สาธารณะ ไม่มี middleware
matchRefereeRouter.get('/:id/referees', Referee.listByMatch);

// F13
matchRefereeRouter.delete('/:id/referees/:rid',
    requireAuth, requireOrganizerOfMatch, Referee.unassignFromMatch);

// F14 — แมตช์ที่ยังขาดกรรมการ / กรรมการที่เวลาซ้อน (สำหรับหน้า ORG + เช็คก่อน publish)
tournamentRefereeRouter.get('/:id/referees/coverage', requireAuth, requireOrganizer, Referee.coverage);

// F03
tournamentRefereeRouter.delete('/:id/referees/:rid', requireAuth, requireOrganizer, Referee.removeFromTournament);