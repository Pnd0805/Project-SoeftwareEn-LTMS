import express from 'express';
import * as User from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = express.Router();

router.get('/search' , requireAuth , User.searchUser);
router.get('/:id' , User.getUserById);
router.get('/:id/stats' , User.getUserStats);

export default router;