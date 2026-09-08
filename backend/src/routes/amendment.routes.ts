import express from 'express';
import * as AmendmentController from '../controllers/amendment.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { amendmentRejectSchema } from '../schemas/tournament.schema.js';

const router = express.Router();

router.post('/:id/approve', requireAuth, AmendmentController.approve);
router.post('/:id/reject', requireAuth, validate(amendmentRejectSchema), AmendmentController.reject);

export default router;
