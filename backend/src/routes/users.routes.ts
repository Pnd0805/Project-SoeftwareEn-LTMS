import express from 'express';
import * as User from '../controllers/user.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { createUserReportSchema } from '../schemas/userReport.schema.js';

const router = express.Router();

router.get('/search' , requireAuth , User.searchUser);
router.get('/:id/followers', User.getFollowers);
router.get('/:id/following', User.getFollowing);
router.get('/:id/career', optionalAuth, User.getCareer);
router.post('/:id/follow', requireAuth, User.followUser);
router.delete('/:id/follow', requireAuth, User.unfollowUser);
router.get('/:id' , optionalAuth, User.getUserById);
// OD-46 — ต้อง optionalAuth เพราะถ้าไม่รู้ว่าใครดู เจ้าตัวที่ปิดสถิติไว้จะดูของตัวเองไม่ได้
router.get('/:id/stats' , optionalAuth, User.getUserStats);
router.post('/:id/report' , requireAuth , validate(createUserReportSchema) , User.fileReport);

export default router;