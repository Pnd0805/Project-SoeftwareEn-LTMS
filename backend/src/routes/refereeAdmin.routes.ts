import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireAdmin_U } from '../middlewares/requireAdmin_U.js';
import { validate } from '../middlewares/validate.js';
import { rejectExternalRefereeSchema } from '../schemas/referee.schema.js';
import * as Admin from '../controllers/refereeAdmin.controller.js';

/** /admin/referee-requests — ตรวจตัวตนกรรมการภายนอก (university-wide เท่านั้น เหมือน T16–T18) */
export const refereeAdminRouter = express.Router();

// AR01
refereeAdminRouter.get('/referee-requests', requireAuth, requireAdmin_U, Admin.listPending);
// AR02
refereeAdminRouter.post('/referee-requests/:id/approve', requireAuth, requireAdmin_U, Admin.approve);
// AR03
refereeAdminRouter.post('/referee-requests/:id/reject',
    requireAuth, requireAdmin_U, validate(rejectExternalRefereeSchema), Admin.reject);
