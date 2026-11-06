import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireAdmin_U } from '../middlewares/requireAdmin_U.js';
import { validate } from '../middlewares/validate.js';
import { requireComplaintReader, requireComplaintReaderOfMatch, requireOrganizerOfComplaint } from '../middlewares/requireComplaint.js';
import { fileComplaintSchema, organizerStatementSchema, decideComplaintSchema } from '../schemas/matchResultComplaint.schema.js';
import * as Complaint from '../controllers/matchResultComplaint.controller.js';

/**
 * OD-26 ข้อ 8 — เรื่องร้องเรียนผลแมตช์ (มติ 26–27 ก.ย. 2569)
 *
 * การวาง prefix เป็นส่วนหนึ่งของกฎ ไม่ใช่เรื่องความสวยงาม:
 *   ยื่นเรื่อง  อยู่ใต้ `/matches/:id` → lockCompletedTournament ปิดให้เองเมื่อทัวร์ปิด
 *                                       (มติ: ยื่นได้เฉพาะก่อนปิดทัวร์) โดยไม่ต้องเขียนเงื่อนไขซ้ำ
 *   ความเห็น/คำวินิจฉัย  อยู่ที่ `/match-result-complaints/:id` ซึ่งอยู่นอก prefix นั้น
 *                        → ทำได้แม้ทัวร์ปิดแล้ว (มติ: เรื่องที่ค้างต้องเดินต่อให้จบ)
 */
export const matchComplaintRouter = express.Router();
export const complaintRouter      = express.Router();

// S13 — ยื่นเรื่อง (หัวหน้าทีมสองฝ่าย + กรรมการของแมตช์ · ตรวจใน service)
matchComplaintRouter.post('/:id/result/complaints',
    requireAuth, validate(fileComplaintSchema), Complaint.fileComplaint);

// S13b — เรื่องทั้งหมดของแมตช์
matchComplaintRouter.get('/:id/result/complaints',
    requireAuth, requireComplaintReaderOfMatch, Complaint.listComplaintsOfMatch);

// S13c — รายละเอียดเรื่องเดียว
complaintRouter.get('/:id', requireAuth, requireComplaintReader, Complaint.getComplaint);

// S13d — ผู้จัดแนบความเห็น · ไม่มี route ให้ปัดตกโดยเจตนา
complaintRouter.put('/:id/statement',
    requireAuth, requireOrganizerOfComplaint, validate(organizerStatementSchema), Complaint.attachOrganizerStatement);

// S13e — แอดมินมหาวิทยาลัยวินิจฉัย (service กันไว้ว่าต้องพ้น 48 ชม.ของผู้จัดก่อน)
complaintRouter.post('/:id/decision',
    requireAuth, requireAdmin_U, validate(decideComplaintSchema), Complaint.decideComplaint);
