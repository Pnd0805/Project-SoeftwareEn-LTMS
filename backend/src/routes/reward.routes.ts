import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { updateRewardDisplaySchema } from '../schemas/reward.schema.js';
import * as Reward from '../controllers/reward.controller.js';

export const rewardsRouter = express.Router();
export const userRewardsRouter = express.Router();
export const meRewardsRouter = express.Router();

rewardsRouter.get('/', Reward.listRewards);
userRewardsRouter.get('/:id/rewards', Reward.listPublicUserRewards);
meRewardsRouter.get('/rewards', requireAuth, Reward.listMyRewards);
meRewardsRouter.patch('/rewards/:id/display', requireAuth, validate(updateRewardDisplaySchema), Reward.setMyRewardDisplayed);
