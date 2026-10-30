import express from 'express';
import * as Upload from '../controllers/upload.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { rateLimitPresign } from '../middlewares/rateLimitPresign.js';
import { presignUploadSchema, presignUploadErrorCodes } from '../schemas/upload.schema.js';

const router = express.Router();

// QA 30 ต.ค. (D1) — 30 ครั้ง/ชม./ผู้ใช้ · นับก่อน validate (คำขอที่ผิดรูปก็นับ — ไม่งั้นยิงผิดรูปวนเพื่อหยั่งเชิงได้ฟรี)
router.post('/uploads/presign', requireAuth, rateLimitPresign, validate(presignUploadSchema, presignUploadErrorCodes), Upload.presignUpload);

export default router;
