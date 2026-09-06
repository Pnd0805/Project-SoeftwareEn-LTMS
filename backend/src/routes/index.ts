import express from 'express';

import Auth from './auth.routes.js';
import Me from './me.routes.js';
import Reference from './reference.routes.js';
import User from './users.routes.js';
import Team from './team.routes.js';

const router = express.Router();

router.use('/' , Reference);

router.use('/auth' , Auth);
router.use('/me' , Me);
router.use('/users' , User);
router.use('/teams' , Team);

export default router;