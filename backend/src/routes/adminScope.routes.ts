import express from 'express';
import * as Admin from '../controllers/adminScope.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireAdmin_U } from '../middlewares/requireAdmin_U.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { validate } from '../middlewares/validate.js';
import { rejectTeamOfficial, transferLeaderSchema } from '../schemas/team.schema.js';
import { suspendUserSchema, grantScopeSchema } from '../schemas/admin.schema.js';
import { rejectUserReportSchema } from '../schemas/userReport.schema.js';
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

// C2 — Admin user surface
router.get('/users' , requireAuth , requireAdmin , Admin.listUsers);
router.patch('/users/:id/suspend' , requireAuth , requireAdmin , validate(suspendUserSchema) , Admin.suspendUser);
router.get('/scopes' , requireAuth , requireAdmin , Admin.listScopes);
router.post('/scopes' , requireAuth , requireAdmin , validate(grantScopeSchema) , Admin.grantScope);
router.delete('/scopes/:id' , requireAuth , requireAdmin , Admin.revokeScope);
router.get('/audit-logs' , requireAuth , requireAdmin , Admin.listAuditLogs);

// C2 — user_reports
router.get('/user-reports' , requireAuth , requireAdmin , Admin.listUserReports);
router.post('/user-reports/:id/approve' , requireAuth , requireAdmin , Admin.approveUserReport);
router.post('/user-reports/:id/reject' , requireAuth , requireAdmin , validate(rejectUserReportSchema) , Admin.rejectUserReport);

export default router;
