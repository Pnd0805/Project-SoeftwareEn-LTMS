import express from 'express';
import { registerSchema , loginSchema , forgotPasswordSchema , resetPasswordSchema , verifyEmailSchema , resendVerificationSchema } from '../schemas/auth.schema.js';

import { register , login , logout , forgotPassword , resetPassword , verifyEmail , resendVerification } from '../controllers/auth.controller.js';

import {validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { rateLimitLogin } from '../middlewares/rateLimitLogin.js';

const router = express.Router();

router.post('/register' , validate(registerSchema) , register );
/**
 * BE-06 (มติ 7 ต.ค. ⑭ ค) — จำกัดจำนวนครั้งที่ล็อกอินผิด (ข้อจำกัดอยู่ในหัวไฟล์ middleware)
 * ★ วางหลัง `validate` — ตัวนับผูกกับอีเมล จึงต้องรู้ว่า payload มีอีเมลที่ใช้ได้ก่อน
 *   คำขอที่รูปแบบผิดตั้งแต่ต้น (400) ไม่ควรไปกินโควตาของใคร
 */
router.post('/login' , validate(loginSchema) , rateLimitLogin , login);
router.post('/logout' , requireAuth , logout);
// OD-53 — ไม่มี requireAuth: register ไม่คืน token ⇒ คนที่เพิ่งสมัครยังล็อกอินไม่ได้
router.post('/verify-email' , validate(verifyEmailSchema) , verifyEmail);
router.post('/resend-verification' , validate(resendVerificationSchema) , resendVerification);
router.post('/forgot-password' , validate(forgotPasswordSchema) , forgotPassword);
router.post('/reset-password' , validate(resetPasswordSchema) , resetPassword);

export default router;