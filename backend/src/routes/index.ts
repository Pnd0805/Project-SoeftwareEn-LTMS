import express from 'express';

import Auth from './auth.routes.js';
import Me from './me.routes.js';
import Reference from './reference.routes.js';
import User from './users.routes.js';
import Application from './application.routes.js'
import Team from './team.routes.js';
import Invitation from './invitation.routes.js';
import Match from './match.routes.js'
import Upload from './upload.routes.js'
import Admin from './adminScope.routes.js';
import { tournamentRefereeRouter, matchRefereeRouter, meRefereeRouter, refereeInvitationRouter } from './referee.routes.js';
import { refereeRequestRouter, tournamentRefereeRequestRouter, meRefereeRequestRouter } from './refereeRequest.routes.js';
import { refereeAdminRouter } from './refereeAdmin.routes.js';
import Tournament from './tournament.routes.js';
import Amendment from './amendment.routes.js';
import { tournamentAnnouncementRouter, announcementRouter } from './announcement.routes.js';
import { meNotificationRouter } from './notification.routes.js';
import { tournamentFeedbackRouter, matchMvpRouter, feedbackRouter, adminFeedbackRouter } from './feedback.routes.js';
import { matchEngagementRouter, mePickemRouter, tournamentPickemRouter } from './engagement.routes.js';
import { lockCompletedTournament } from '../middlewares/lockCompletedTournament.js';

const router = express.Router();

// B1 — ทัวร์ที่ completed แล้ว ปฏิเสธทุก write ใต้ /tournaments/:id และ /matches/:id (ยกเว้น announcements)
router.use(['/tournaments/:id', '/matches/:id'], lockCompletedTournament);


router.use('/' , Reference);
router.use('/' , Application);
router.use('/' , Match);
router.use('/' , Upload);

router.use('/auth' , Auth);
router.use('/me' , Me);
router.use('/users' , User);
router.use('/teams' , Team);
router.use('/invitations' , Invitation);
router.use('/admin' , Admin);
router.use('/tournaments', Tournament);
router.use('/amendment-requests', Amendment);

router.use('/tournaments' , tournamentRefereeRouter);
router.use('/matches' , matchRefereeRouter);
router.use('/me' , meRefereeRouter);
router.use('/referee-invitations' , refereeInvitationRouter);

router.use('/tournaments' , tournamentRefereeRequestRouter);
router.use('/me' , meRefereeRequestRouter);
router.use('/referee-requests' , refereeRequestRouter);
router.use('/admin' , refereeAdminRouter);

router.use('/tournaments' , tournamentAnnouncementRouter);
router.use('/announcements' , announcementRouter);

// C1 Inbox — GET/PATCH/POST /me/notifications
router.use('/me' , meNotificationRouter);

// C6 feedback / rating / MVP vote
router.use('/tournaments' , tournamentFeedbackRouter);
router.use('/matches' , matchMvpRouter);
router.use('/feedback' , feedbackRouter);
router.use('/admin' , adminFeedbackRouter);

// C7 Pick'em (คอมเมนต์ทัวร์อยู่กับ C6 ที่ tournamentFeedbackRouter)
router.use('/matches' , matchEngagementRouter);
router.use('/me' , mePickemRouter);
router.use('/tournaments' , tournamentPickemRouter);

export default router;
