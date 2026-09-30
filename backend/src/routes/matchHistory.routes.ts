import express from 'express';
import { getMatchHistory } from '../controllers/matchHistory.controller.js';

const router = express.Router();
router.get('/:id/match-history', getMatchHistory);

export default router;
