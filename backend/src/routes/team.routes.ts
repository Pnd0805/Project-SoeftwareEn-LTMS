import express from 'express';
import * as Team from '../controllers/team.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { teamSchema , updateTeamSchema , createTeamInvitedSchema, requestSchema, joinRequestSchema, rejectJoinRequestSchema, transferLeaderSchema } from '../schemas/team.schema.js';
import { requireTeamLeader } from '../middlewares/requireTeamLeader.js';

const router = express.Router();

router.post('/' , requireAuth , validate(teamSchema) , Team.createTeam);
// T19 — ค้นหาทีม (มติ 20 ก.ย.) ?q=&sportTypeId=&visibility=&page=
router.get('/' , Team.searchTeams);
// T20–T23 — ขอเข้าร่วมทีมสาธารณะ / หัวหน้าทีมจัดการคำขอ
router.post('/:id/join-requests' , requireAuth , validate(joinRequestSchema) , Team.createJoinRequest);
router.get('/:id/join-requests' , requireAuth , requireTeamLeader , Team.listJoinRequests);
router.post('/:id/join-requests/:rid/approve' , requireAuth , requireTeamLeader , Team.approveJoinRequest);
router.post('/:id/join-requests/:rid/reject' , requireAuth , requireTeamLeader , validate(rejectJoinRequestSchema) , Team.rejectJoinRequest);
router.get('/:id' , Team.getTeamById);
router.patch('/:id' , requireAuth , requireTeamLeader , validate(updateTeamSchema) , Team.updateTeamById);
router.delete('/:id' , requireAuth , requireTeamLeader , Team.deleteTeamById);

//-- Member
router.get('/:id/members' , requireAuth , Team.getTeamMember);
router.delete('/:id/members/:uid' , requireAuth , requireTeamLeader , Team.deleteMember);

//Invitations
router.post('/:id/invitations' , requireAuth , requireTeamLeader , validate(createTeamInvitedSchema) , Team.createTeamInvitation);
router.get('/:id/invitations' , requireAuth , requireTeamLeader , Team.getAllInvitation);
router.delete('/:id/invitations/:iid' , requireAuth , requireTeamLeader , Team.deletePendingInvite);

//Team Request
router.post('/:id/official-request' , requireAuth , requireTeamLeader , validate(requestSchema) , Team.createTeamOfficialRequest);

// C3 — โอนหัวหน้าทีม (T19)
router.post('/:id/transfer-leader' , requireAuth , requireTeamLeader , validate(transferLeaderSchema) , Team.transferLeader);
export default router;
