import express from 'express';
import { registerSchema , loginSchema , forgotPasswordSchema , resetPasswordSchema } from '../schemas/auth.schema.js';

import { register , login , logout , forgotPassword , resetPassword } from '../controllers/auth.controller.js';

import {validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = express.Router();

router.post('/register' , validate(registerSchema) , register );
router.post('/login' , validate(loginSchema) , login);
router.post('/logout' , requireAuth , logout);
router.post('/forgot-password' , validate(forgotPasswordSchema) , forgotPassword);
router.post('/reset-password' , validate(resetPasswordSchema) , resetPassword);

export default router;