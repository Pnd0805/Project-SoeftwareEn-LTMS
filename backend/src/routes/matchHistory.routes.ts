import express from 'express';
import { getMatchHistory } from '../controllers/matchHistory.controller.js';
import { optionalAuth } from '../middlewares/requireAuth.js';

const router = express.Router();
// OD-46 — optionalAuth ไม่ใช่ requireAuth: เส้นนี้ยังเป็นสาธารณะ แค่ต้องรู้ว่าใครดู
// เพื่อให้เจ้าตัวและแอดมินยังเห็นได้เมื่อเจ้าของโปรไฟล์ปิดสถิติไว้
router.get('/:id/match-history', optionalAuth, getMatchHistory);

export default router;
