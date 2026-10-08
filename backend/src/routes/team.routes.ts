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
/**
 * 🆕 BE-11 / FE-05 (7 ต.ค. 2569) — สมาชิกออกจากทีมเอง
 * ★ ต้องประกาศ **ก่อน** '/:id/members/:uid' — express จับตามลำดับ ถ้าอยู่หลัง
 *   คำว่า 'me' จะถูกจับเป็น :uid แล้วไปติด requireTeamLeader (403) ซึ่งคือบั๊กเดิม
 * ★ ไม่มี requireTeamLeader โดยเจตนา — คนที่ออกคือเจ้าตัว ไม่ใช่หัวหน้าทีม
 *   (ด่านอื่นทั้งหมดอยู่ใน service ตัวเดียวกับที่หัวหน้าทีมใช้)
 */
router.delete('/:id/members/me' , requireAuth , Team.leaveTeam);
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
