import express from 'express';
import * as User from '../controllers/user.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/requireAuth.js';

const router = express.Router();

router.get('/search' , requireAuth , User.searchUser);
router.get('/:id/followers', User.getFollowers);
router.get('/:id/following', User.getFollowing);
router.get('/:id/career', User.getCareer);
router.post('/:id/follow', requireAuth, User.followUser);
router.delete('/:id/follow', requireAuth, User.unfollowUser);
router.get('/:id' , optionalAuth, User.getUserById);
router.get('/:id/stats' , User.getUserStats);

export default router;