import express from 'express';
import { registerSchema , loginSchema } from '../schemas/auth.schema.js';

import { register , login , logout} from '../controllers/auth.controller.js';

import {validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = express.Router();

router.post('/register' , validate(registerSchema) , register );
router.post('/login' , validate(loginSchema) , login);
router.post('/logout' , requireAuth , logout);

export default router;