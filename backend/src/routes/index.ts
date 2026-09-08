import express from 'express';
import Auth from './auth.routes.js';
import Me from './me.routes.js';
import Reference from './reference.routes.js';
import User from './users.routes.js';
import { tournamentRefereeRouter, matchRefereeRouter, meRefereeRouter, refereeInvitationRouter } from './referee.routes.js';



const router = express.Router();


router.use('/' , Reference);

router.use('/auth' , Auth);
router.use('/me' , Me);
router.use('/users' , User);

router.use('/tournaments' , tournamentRefereeRouter);
router.use('/matches' , matchRefereeRouter);
router.use('/me' , meRefereeRouter);
router.use('/referee-invitations' , refereeInvitationRouter);

export default router;