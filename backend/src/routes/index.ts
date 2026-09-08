import express from 'express';

import Auth from './auth.routes.js';
import Me from './me.routes.js';
import Reference from './reference.routes.js';
import User from './users.routes.js';
import Application from './application.routes.js'
import Team from './team.routes.js';
import Invitation from './invitation.routes.js';
import Admin from './adminScope.routes.js';
import { tournamentRefereeRouter, matchRefereeRouter, meRefereeRouter, refereeInvitationRouter } from './referee.routes.js';

const router = express.Router();


router.use('/' , Reference);
router.use('/' , Application);

router.use('/auth' , Auth);
router.use('/me' , Me);
router.use('/users' , User);
router.use('/teams' , Team);
router.use('/invitations' , Invitation);
router.use('/admin' , Admin);

router.use('/tournaments' , tournamentRefereeRouter);
router.use('/matches' , matchRefereeRouter);
router.use('/me' , meRefereeRouter);
router.use('/referee-invitations' , refereeInvitationRouter);

export default router;