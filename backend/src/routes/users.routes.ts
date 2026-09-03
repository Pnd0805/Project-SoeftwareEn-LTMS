import express from 'express';
import * as User from '../controllers/user.controller.js';

const router = express.Router();

router.get('/:id' , User.getUserById);
router.get('/:id/stats' , User.getUserStats);

export default router;