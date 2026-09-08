import express from 'express';
import * as Invitation  from '../controllers/invitation.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = express.Router();

router.post('/:id/accept' , requireAuth , Invitation.acceptInvitation);
router.post('/:id/decline' , requireAuth , Invitation.rejectInvitation);
export default router;