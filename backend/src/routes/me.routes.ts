import express from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { getMe , patchMe } from '../controllers/user.controller.js';
import { validate } from '../middlewares/validate.js';
import { updateMeSchema } from '../schemas/user.schema.js';
import * as TeamController from '../controllers/team.controller.js';

const router = express.Router();

router.get('/' , requireAuth , getMe)
router.patch('/' , requireAuth , validate(updateMeSchema) , patchMe);
router.get('/teams' , requireAuth , TeamController.getMyTeam);

export default router;
