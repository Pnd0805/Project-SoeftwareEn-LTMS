import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireOrganizer } from '../middlewares/requireOrganizer.js';
import { validate } from '../middlewares/validate.js';
import { refRequestSchema, orgAddMatchSchema, orgSwapSchema, refWithdrawSchema } from '../schemas/refereeRequest.schema.js';
import * as Req from '../controllers/refereeRequest.controller.js';

/** /referee-requests */
export const refereeRequestRouter = express.Router();
/** /tournaments/:id/referee-requests (ORG) */
export const tournamentRefereeRequestRouter = express.Router();
/** /me/referee-requests */
export const meRefereeRequestRouter = express.Router();

// FR01 — REF ขอโอน/แลกแมตช์กับกรรมการอีกคน
refereeRequestRouter.post('/', requireAuth, validate(refRequestSchema), Req.createRefRequest);

// FR09 — REF ขอถอนตัวจากแมตช์เดียว หรือทั้งทัวร์ (ORG อนุมัติ)
// ★ ไม่มี requireOrganizer — คนยื่นคือกรรมการ · ด่าน "เป็นกรรมการของทัวร์นี้ไหม" อยู่ใน service
//   เพราะต้องถามฐานว่าแถวของเขายัง active อยู่ไหม ซึ่ง middleware ตอบไม่ได้
refereeRequestRouter.post('/withdraw', requireAuth, validate(refWithdrawSchema), Req.createRefWithdraw);

// FR02 / FR03 — ORG ขอเพิ่มแมตช์ / ขอสลับ 2 คน
tournamentRefereeRequestRouter.post('/:id/referee-requests/add-match',
    requireAuth, requireOrganizer, validate(orgAddMatchSchema), Req.createOrgAddMatch);
tournamentRefereeRequestRouter.post('/:id/referee-requests/swap',
    requireAuth, requireOrganizer, validate(orgSwapSchema), Req.createOrgSwap);

// FR04 — คำขอที่รอฉันตอบ + ที่ฉันส่ง
meRefereeRequestRouter.get('/referee-requests', requireAuth, Req.listMine);

// FR05 — คำขอทั้งหมดของทัวร์ (?status=open|applied|declined|cancelled)
tournamentRefereeRequestRouter.get('/:id/referee-requests', requireAuth, requireOrganizer, Req.listByTournament);

// FR06 / FR07 / FR08
refereeRequestRouter.post('/:id/accept',  requireAuth, Req.accept);
refereeRequestRouter.post('/:id/decline', requireAuth, Req.decline);
refereeRequestRouter.delete('/:id',       requireAuth, Req.cancel);
