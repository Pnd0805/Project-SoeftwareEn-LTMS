import express from 'express';
import * as User from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { createUserReportSchema } from '../schemas/userReport.schema.js';

const router = express.Router();

router.get('/search' , requireAuth , User.searchUser);
router.get('/:id' , User.getUserById);
router.get('/:id/stats' , User.getUserStats);
router.post('/:id/report' , requireAuth , validate(createUserReportSchema) , User.fileReport);

export default router;