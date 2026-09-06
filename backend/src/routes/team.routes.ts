import express from 'express';
import * as Team from '../controllers/team.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { teamSchema , updateTeamSchema , updateMemberschema} from '../schemas/team.schema.js';
import { requireTeamLeader } from '../middlewares/requireTeamLeader.js';

const router = express.Router();

router.post('/' , requireAuth , validate(teamSchema) , Team.createTeam);
router.get('/:id' , Team.getTeamById);
router.patch('/:id' , requireAuth , requireTeamLeader , validate(updateTeamSchema) , Team.updateTeamById);
router.delete('/:id' , requireAuth , requireTeamLeader , Team.deleteTeamById);

//-- Member
router.get('/:id/members' , requireAuth , Team.getTeamMember);
router.patch('/:id/members/:uid' , requireAuth , requireTeamLeader , validate(updateMemberschema) , Team.updateTeamMember);
router.delete('/:id/members/:uid' , requireAuth , requireTeamLeader , Team.deleteMember);



export default router;
