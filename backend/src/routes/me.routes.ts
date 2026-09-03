import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { getMe } from '../controllers/user.controller.js';

const router = express.Router();

router.get('/' , requireAuth , getMe)

export default router;