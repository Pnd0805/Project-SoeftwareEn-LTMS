import express from 'express';
import * as Match from '../controllers/match.controller.js';
import { requireAuth , optionalAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { scheduleMatchSchema, rejectCheckinSchema, rejectCheckinErrorCodes, createBracketSchema, submitCheckinSchema, manualCheckinSchema, roomCodeSchema } from '../schemas/match.schema.js';
import { requireReferee } from '../middlewares/requireReferee.js';
import { requireOrganizer, requireOrganizerOfMatch } from '../middlewares/requireOrganizer.js';

const router = express.Router();

router.post('/tournaments/:id/bracket' , requireAuth , requireOrganizer , validate(createBracketSchema) , Match.createBracket);
router.get('/tournaments/:id/bracket' , Match.getBracket);
router.get('/tournaments/:id/matches' , Match.getTournamentMatches);
router.get('/matches/:id' , optionalAuth , Match.getMatchDetail);   // optionalAuth: roomCode เห็นเฉพาะคนในแมตช์
// B8 — รหัสห้องแมตช์ออนไลน์ (กรรมการของแมตช์/ORG — เช็คใน service)
router.put('/matches/:id/room-code' , requireAuth , validate(roomCodeSchema) , Match.setRoomCode);
// /me/matches — แมตช์ของฉันทั้งผู้เล่นและกรรมการ
router.get('/me/matches' , requireAuth , Match.listMyMatches);
router.patch('/matches/:id/schedule' , requireAuth , requireOrganizerOfMatch , validate(scheduleMatchSchema) , Match.scheduleMatch);
router.post('/matches/:id/open-checkin'  , requireAuth , requireOrganizerOfMatch , Match.openCheckinMatch);
router.post('/matches/:id/start' , requireAuth , requireReferee , Match.startMatch);
// M18 ปิดเช็คอินกลับเป็น scheduled (ฝนตก → ไปเลื่อนด้วย M06) · M17 ORG ตัดสินทีมไม่มาตามนัด — GUIDE/11 §10.5
router.post('/matches/:id/close-checkin' , requireAuth , requireOrganizerOfMatch , Match.closeCheckinMatch);
router.post('/matches/:id/forfeit' , requireAuth , requireOrganizerOfMatch , Match.forfeitMatch);
router.get('/matches/:id/checkins' , requireAuth , Match.getMatchCheckins);
router.post('/matches/:id/checkins/:cid/verify' , requireAuth , requireReferee , Match.verifyCheckin);
router.post('/matches/:id/checkins/:cid/reject' , requireAuth , requireReferee , validate(rejectCheckinSchema, rejectCheckinErrorCodes) , Match.rejectCheckin);
router.get('/matches/:id/checkin-qr' , requireAuth , Match.getCheckinQr);
router.post('/matches/:id/checkins' , requireAuth , validate(submitCheckinSchema) , Match.submitCheckin);
// M20 ผู้เล่นดูเช็คอินตัวเอง · M19 กรรมการเช็คอินแทน (manual_by_referee) — FE gaps 19 ก.ย.
router.get('/matches/:id/checkins/me' , requireAuth , Match.getMyCheckin);
router.post('/matches/:id/checkins/manual' , requireAuth , requireReferee , validate(manualCheckinSchema) , Match.manualCheckin);
export default router;