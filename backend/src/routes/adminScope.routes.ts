import express from 'express';
import * as Admin from '../controllers/adminScope.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireAdmin_U } from '../middlewares/requireAdmin_U.js';
import { validate } from '../middlewares/validate.js';
import { rejectTeamOfficial, transferLeaderSchema } from '../schemas/team.schema.js';
import * as TournamentController from '../controllers/tournament.controller.js';

const router = express.Router();

router.get('/team-requests' , requireAuth , requireAdmin_U , Admin.getAllOfficialRequest);
router.post('/team-requests/:id/approve' , requireAuth , requireAdmin_U , Admin.approveTeamOfficial);
router.post('/team-requests/:id/reject' , requireAuth , requireAdmin_U ,validate(rejectTeamOfficial) , Admin.rejectTeamOfficial);
router.get('/team-requests/transfers' , requireAuth , requireAdmin_U , Admin.getAllTransferRequest);
router.post('/team-requests/:id/approve-transfer' , requireAuth , requireAdmin_U , Admin.approveTransfer);
router.post('/team-requests/:id/reject-transfer' , requireAuth , requireAdmin_U , validate(rejectTeamOfficial) , Admin.rejectTransfer);
router.post('/teams/:id/transfer-leader' , requireAuth , requireAdmin_U , validate(transferLeaderSchema) , Admin.transferLeaderByAdmin);
router.get('/tournament-requests', requireAuth, TournamentController.getPendingTournamentRequests);
router.get('/amendment-requests', requireAuth, TournamentController.getPendingAmendments);

export default router;
