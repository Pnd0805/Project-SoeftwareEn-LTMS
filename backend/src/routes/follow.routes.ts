import express from 'express';
import { requireAuth, optionalAuth } from '../middlewares/requireAuth.js';
import * as Follow from '../controllers/follow.controller.js';

// C8 — mount ที่ /users · อ่านเป็นสาธารณะ (ล็อกอินแล้วได้ isFollowing) · ติดตาม/เลิกต้องล็อกอิน
export const userFollowRouter = express.Router();
userFollowRouter.post('/:id/follow' , requireAuth , Follow.followUser);
userFollowRouter.delete('/:id/follow' , requireAuth , Follow.unfollowUser);
userFollowRouter.get('/:id/followers' , optionalAuth , Follow.getUserFollowers);
userFollowRouter.get('/:id/following' , Follow.getUserFollowing);
userFollowRouter.get('/:id/career' , Follow.getUserCareer);

// mount ที่ /teams
export const teamFollowRouter = express.Router();
teamFollowRouter.post('/:id/follow' , requireAuth , Follow.followTeam);
teamFollowRouter.delete('/:id/follow' , requireAuth , Follow.unfollowTeam);
teamFollowRouter.get('/:id/followers' , optionalAuth , Follow.getTeamFollowers);

// mount ที่ /me
export const meFollowRouter = express.Router();
meFollowRouter.get('/following' , requireAuth , Follow.getMyFollowing);
