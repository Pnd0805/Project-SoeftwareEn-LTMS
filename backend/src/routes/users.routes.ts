import express from 'express';
import * as User from '../controllers/user.controller.js';
import { requireAuth, optionalAuth } from '../middlewares/requireAuth.js';

const router = express.Router();

router.get('/search' , requireAuth , User.searchUser);
router.get('/:id' , optionalAuth , User.getUserById);   // C8: optionalAuth เพื่อคืน isFollowing
router.get('/:id/stats' , User.getUserStats);

export default router;