import express from 'express';
import * as Upload from '../controllers/upload.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { presignUploadSchema } from '../schemas/upload.schema.js';

const router = express.Router();

router.post('/uploads/presign', requireAuth, validate(presignUploadSchema), Upload.presignUpload);

export default router;
