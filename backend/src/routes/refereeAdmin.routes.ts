import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireAdmin_U } from '../middlewares/requireAdmin_U.js';
import { validate } from '../middlewares/validate.js';
import { rejectExternalRefereeSchema } from '../schemas/referee.schema.js';
import * as Admin from '../controllers/refereeAdmin.controller.js';

/** /admin/referee-requests — ตรวจตัวตนกรรมการภายนอก "ต่อคน" (university-wide เท่านั้น เหมือน T16–T18) */
export const refereeAdminRouter = express.Router();

// AR01
refereeAdminRouter.get('/referee-requests', requireAuth, requireAdmin_U, Admin.listPending);
// AR02
refereeAdminRouter.post('/referee-requests/:userId/approve', requireAuth, requireAdmin_U, Admin.approve);
// AR04 — ขอเอกสารใหม่ (ทัวร์ยังรอ ไม่ใช่ reject)
refereeAdminRouter.post('/referee-requests/:userId/request-docs',
    requireAuth, requireAdmin_U, validate(rejectExternalRefereeSchema), Admin.requestDocs);
// AR03 — ปฏิเสธจริง / ถอนอนุมัติ
refereeAdminRouter.post('/referee-requests/:userId/reject',
    requireAuth, requireAdmin_U, validate(rejectExternalRefereeSchema), Admin.reject);
