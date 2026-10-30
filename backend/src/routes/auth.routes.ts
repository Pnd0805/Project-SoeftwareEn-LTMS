import express from 'express';
import { registerSchema , loginSchema , forgotPasswordSchema , resetPasswordSchema , verifyEmailSchema , resendVerificationSchema } from '../schemas/auth.schema.js';

import { register , login , logout , forgotPassword , resetPassword , verifyEmail , resendVerification } from '../controllers/auth.controller.js';

import {validate } from '../middlewares/validate.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { rateLimitLogin } from '../middlewares/rateLimitLogin.js';
import { rateLimitEmail } from '../middlewares/rateLimitEmail.js';

const router = express.Router();

/**
 * QA 30 ต.ค. 2569 ข้อ 1 — สามเส้นที่ทำให้ระบบส่งอีเมลออกต้องมีเพดานต่อ IP
 * ★ วางหลัง `validate` ด้วยเหตุผลเดียวกับ `rateLimitLogin` — คำขอที่รูปแบบผิดตั้งแต่ต้น (400)
 *   ไม่ควรไปกินโควตาของใคร
 */
router.post('/register' , validate(registerSchema) , rateLimitEmail , register );
/**
 * BE-06 (มติ 7 ต.ค. ⑭ ค) — จำกัดจำนวนครั้งที่ล็อกอินผิด (ข้อจำกัดอยู่ในหัวไฟล์ middleware)
 * ★ วางหลัง `validate` — ตัวนับผูกกับอีเมล จึงต้องรู้ว่า payload มีอีเมลที่ใช้ได้ก่อน
 *   คำขอที่รูปแบบผิดตั้งแต่ต้น (400) ไม่ควรไปกินโควตาของใคร
 */
router.post('/login' , validate(loginSchema) , rateLimitLogin , login);
router.post('/logout' , requireAuth , logout);
// OD-53 — ไม่มี requireAuth: register ไม่คืน token ⇒ คนที่เพิ่งสมัครยังล็อกอินไม่ได้
router.post('/verify-email' , validate(verifyEmailSchema) , verifyEmail);
router.post('/resend-verification' , validate(resendVerificationSchema) , rateLimitEmail , resendVerification);
router.post('/forgot-password' , validate(forgotPasswordSchema) , rateLimitEmail , forgotPassword);
router.post('/reset-password' , validate(resetPasswordSchema) , resetPassword);

export default router;