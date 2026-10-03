import express from 'express';
import { registerSchema , loginSchema , forgotPasswordSchema , resetPasswordSchema , verifyEmailSchema , resendVerificationSchema } from '../schemas/auth.schema.js';

import { register , login , logout , forgotPassword , resetPassword , verifyEmail , resendVerification } from '../controllers/auth.controller.js';

import {validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = express.Router();

router.post('/register' , validate(registerSchema) , register );
router.post('/login' , validate(loginSchema) , login);
router.post('/logout' , requireAuth , logout);
// OD-53 — ไม่มี requireAuth: register ไม่คืน token ⇒ คนที่เพิ่งสมัครยังล็อกอินไม่ได้
router.post('/verify-email' , validate(verifyEmailSchema) , verifyEmail);
router.post('/resend-verification' , validate(resendVerificationSchema) , resendVerification);
router.post('/forgot-password' , validate(forgotPasswordSchema) , forgotPassword);
router.post('/reset-password' , validate(resetPasswordSchema) , resetPassword);

export default router;