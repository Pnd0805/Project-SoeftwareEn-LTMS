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
import { matchComplaintRouter, complaintRouter } from './matchResultComplaint.routes.js';
import MatchHistory from './matchHistory.routes.js';
import { rewardsRouter, userRewardsRouter, meRewardsRouter } from './reward.routes.js';
import { lockCompletedTournament } from '../middlewares/lockCompletedTournament.js';

const router = express.Router();

// B1 โ€” เธ—เธฑเธงเธฃเนเธ—เธตเน completed เนเธฅเนเธง เธเธเธดเน€เธชเธเธ—เธธเธ write เนเธ•เน /tournaments/:id เนเธฅเธฐ /matches/:id (เธขเธเน€เธงเนเธ announcements)
router.use(['/tournaments/:id', '/matches/:id'], lockCompletedTournament);


router.use('/' , Reference);
router.use('/' , Application);
router.use('/' , Match);
router.use('/' , Upload);

router.use('/auth' , Auth);
router.use('/me' , Me);
router.use('/me', meRewardsRouter);
router.use('/rewards', rewardsRouter);
router.use('/users', userRewardsRouter);
router.use('/users', MatchHistory);
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

// C1 Inbox โ€” GET/PATCH/POST /me/notifications
router.use('/me' , meNotificationRouter);

// C6 feedback / rating / MVP vote
router.use('/tournaments' , tournamentFeedbackRouter);
router.use('/matches' , matchMvpRouter);
router.use('/feedback' , feedbackRouter);
router.use('/admin' , adminFeedbackRouter);

// OD-26 เธเนเธญ 8 โ€” เธขเธทเนเธเน€เธฃเธทเนเธญเธเธญเธขเธนเนเนเธ•เน /matches/:id (เธเธดเธ”เธ—เธฑเธงเธฃเนเนเธฅเนเธงเธขเธทเนเธเนเธกเนเนเธ”เนเน€เธญเธ)
//                เธเธงเธฒเธกเน€เธซเนเธ ORG/เธเธณเธงเธดเธเธดเธเธเธฑเธขเนเธญเธ”เธกเธดเธเธญเธขเธนเนเธเธญเธ prefix เธเธฑเนเธ (เธ—เธณเนเธ”เนเนเธกเนเธ—เธฑเธงเธฃเนเธเธดเธ”เนเธฅเนเธง)
router.use('/matches' , matchComplaintRouter);
router.use('/match-result-complaints' , complaintRouter);

// C7 Pick'em (เธเธญเธกเน€เธกเธเธ•เนเธ—เธฑเธงเธฃเนเธญเธขเธนเนเธเธฑเธ C6 เธ—เธตเน tournamentFeedbackRouter)
router.use('/matches' , matchEngagementRouter);
router.use('/me' , mePickemRouter);
router.use('/tournaments' , tournamentPickemRouter);

export default router;
