import express from 'express';
import { requireAuth, optionalAuth } from '../middlewares/requireAuth.js';
import { requireOrganizer } from '../middlewares/requireOrganizer.js';
import { validate } from '../middlewares/validate.js';
import { inviteRefereeSchema, acceptInvitationSchema, submitDocsSchema } from '../schemas/referee.schema.js';
import * as Identity from '../controllers/refereeIdentity.controller.js';
import * as Referee from '../controllers/referee.controller.js';

import { requireCanSubmitResult , requireCanVerifyResult , requireCanDisputeResult , requireCanRecordStats} from '../middlewares/requireReferee.js';
import { resolveSchema, statSchema, organizerDecideSchema } from '../schemas/matchResult.schema.js';
import { livestreamSchema } from '../schemas/match.schema.js';
import * as MatchResult from '../controllers/matchResult.controller.js'

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
// B7 — แมตช์ที่ฉันเป็นกรรมการ (รับแล้ว + active) ทุกทัวร์
meRefereeRouter.get('/referee-matches', requireAuth, Referee.listMyMatches);

// F05 / F06
refereeInvitationRouter.post('/:id/accept', requireAuth, validate(acceptInvitationSchema), Referee.accept);
refereeInvitationRouter.post('/:id/decline', requireAuth, Referee.decline);

// U11 / U12 — การยืนยันตัวตนกรรมการภายนอก (ต่อคน ไม่ผูกกับคำเชิญ)
meRefereeRouter.get('/referee-identity', requireAuth, Identity.getMine);
meRefereeRouter.put('/referee-identity/docs', requireAuth, validate(submitDocsSchema), Identity.submitDocs);

import { disputeSchema, submitResultSchema } from '../schemas/matchResult.schema.js';

import { requireOrganizerOfMatch, requireCanResolveDispute } from '../middlewares/requireOrganizer.js';

// F11 (ORG ใส่กรรมการเข้าแมตช์ตรง ๆ) ถูกแทนด้วย FR02 — POST /tournaments/:id/referee-requests/add-match

// F12 — สาธารณะ ไม่มี middleware
matchRefereeRouter.get('/:id/referees', Referee.listByMatch);

// F13
matchRefereeRouter.delete('/:id/referees/:rid',
    requireAuth, requireOrganizerOfMatch, Referee.unassignFromMatch);

// F14 — แมตช์ที่ยังขาดกรรมการ / กรรมการที่เวลาซ้อน (สำหรับหน้า ORG + เช็คก่อน publish)
tournamentRefereeRouter.get('/:id/referees/coverage', requireAuth, requireOrganizer, Referee.coverage);

// F03
tournamentRefereeRouter.delete('/:id/referees/:rid', requireAuth, requireOrganizer, Referee.removeFromTournament);



// MatchResult
matchRefereeRouter.post('/:id/result' , requireAuth , requireCanSubmitResult , validate(submitResultSchema) , MatchResult.createSubmitMatchRes);
matchRefereeRouter.post('/:id/result/verify' , requireAuth , requireCanVerifyResult , MatchResult.updateVerifyMatchResult);
matchRefereeRouter.post('/:id/result/dispute' , requireAuth , requireCanDisputeResult , validate(disputeSchema) , MatchResult.updateDisputeMatchResult);
matchRefereeRouter.get('/:id/result/dispute' , requireAuth , MatchResult.getDispute);   // ผู้จัดต้องอ่านเรื่องได้ก่อนตัดสิน
// ผู้จัดตัดสินแมตช์ที่แข่งแล้วแต่ไม่มีใครส่งผล — ทางออกสุดท้ายของข้อ 6 (มติ 26 ก.ย.)
matchRefereeRouter.post('/:id/result/organizer' , requireAuth , requireOrganizerOfMatch , validate(organizerDecideSchema) , MatchResult.organizerDecideMatch);
// ข้อ 10 — ผู้จัดตัดสินได้เสมอ · แอดมินมหาวิทยาลัยตัดสินแทนได้เมื่อผู้จัดเงียบเกิน 48 ชม.
matchRefereeRouter.post('/:id/result/resolve' , requireAuth , requireCanResolveDispute , validate(resolveSchema) , MatchResult.updateResolveMatchResult);

matchRefereeRouter.get('/:id/result' , optionalAuth , MatchResult.getVerifiedResult);   // มี token = เห็นผลที่ยังไม่ verify ถ้าเกี่ยวข้อง
matchRefereeRouter.post('/:id/stats' , requireAuth , requireCanRecordStats , validate(statSchema) , MatchResult.updatePlayerStat);
matchRefereeRouter.get('/:id/stats' , MatchResult.getPlayerMatchStat);

// S10 — สาธารณะ ไม่มี middleware
tournamentRefereeRouter.get('/:id/winner' , MatchResult.getChampion);

// S11 — สาธารณะ ไม่มี middleware
tournamentRefereeRouter.get('/:id/dashboard' , MatchResult.getDashboard);

// S12 — สาธารณะ ไม่มี middleware
tournamentRefereeRouter.get('/:id/standings' , MatchResult.getStandings);

// E12
matchRefereeRouter.put('/:id/livestream' , requireAuth , requireOrganizerOfMatch , validate(livestreamSchema) , MatchResult.updateLivestream);

