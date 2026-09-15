import express from 'express';
import * as TournamentController from '../controllers/tournament.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/requireAuth.js';
import { requireOrganizer } from '../middlewares/requireOrganizer.js';
import { validate } from '../middlewares/validate.js';
import {
    amendmentRequestSchema,
    createTournamentSchema,
    updateTournamentSchema
} from '../schemas/tournament.schema.js';

const router = express.Router();

router.post('/', requireAuth, validate(createTournamentSchema), TournamentController.createTournament);
router.get('/', TournamentController.getPublicTournaments);
router.get('/:id', optionalAuth, TournamentController.getTournament);
router.patch('/:id', requireAuth, requireOrganizer, validate(updateTournamentSchema), TournamentController.updateTournament);
router.post('/:id/amendment-requests', requireAuth, requireOrganizer, validate(amendmentRequestSchema), TournamentController.requestAmendment);

router.post('/:id/approve', requireAuth, TournamentController.approveTournament);
router.post('/:id/reject', requireAuth, TournamentController.rejectTournament);
router.post('/:id/publish', requireAuth, requireOrganizer, TournamentController.publishTournament);
router.post('/:id/unpublish', requireAuth, requireOrganizer, TournamentController.unpublishTournament);
router.post('/:id/open-registration', requireAuth, requireOrganizer, TournamentController.openRegistration);
router.post('/:id/close-registration', requireAuth, requireOrganizer, TournamentController.closeRegistration);
router.get('/:id/eligibility-rules', optionalAuth, TournamentController.getEligibilityRules);

export default router;
