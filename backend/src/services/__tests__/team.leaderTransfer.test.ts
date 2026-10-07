import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * BR-07 — การเปลี่ยนสถานะทีมเป็น Official หรือการเปลี่ยนหัวหน้าทีม Official ต้องได้รับอนุมัติจาก Admin
 *   ผลต่อการออกแบบ: ต้องมีคิวคำร้องแยกสำหรับ Admin พร้อมบันทึกผลการพิจารณา
 *
 * ครึ่งแรก (คำร้อง Official) มีเทสแล้วใน adminScope.service.test.ts (approveTeamRequest / rejectTeamOfficial)
 * ไฟล์นี้คุมครึ่งหลัง — เปลี่ยนหัวหน้าทีม:
 *   ฝั่งทีม  transferLeader        → สร้าง "คำร้อง" เท่านั้น ห้ามเปลี่ยน leader_id เอง
 *   ฝั่งแอดมิน approveTransferRequest → จุดเดียวที่เปลี่ยน leader_id จริง (SQL → adminScope.transfer.test.ts)
 */

vi.mock('../notification.service.js', () => ({
  notify: vi.fn(), notifyUsers: vi.fn(), notifyMatchAudience: vi.fn(), notifyTournamentTeamLeaders: vi.fn(),
  notifyTeamMembers: vi.fn(), notifyTournamentReferees: vi.fn(), notifyMatchResultParties: vi.fn(),
}));
vi.mock('../upload.service.js', () => ({ getPresignedDownloadUrl: vi.fn(), presignAll: vi.fn() }));
vi.mock('../../repositories/team.repo.js', () => ({
  findById: vi.fn(),
  isMemberOf: vi.fn(),
  // 🆕 BE-10 (7 ต.ค. 2569) — ด่านกันคำขอซ้ำ · ไม่ใส่ = ไฟล์นี้พังทั้งไฟล์
  expireStaleInvitations: vi.fn(() => Promise.resolve(0)),
  findLiveInvitation: vi.fn(() => Promise.resolve(null)),
  findPendingTeamRequest: vi.fn(() => Promise.resolve(null)),
  createTransferRequest: vi.fn(async () => 300),
  findTransferRequestById: vi.fn(),
  update: vi.fn(),
  sweepInactiveTeams: vi.fn(async () => []),
}));
vi.mock('../../repositories/sportType.repo.js', () => ({}));
vi.mock('../../repositories/user.repo.js', () => ({}));
vi.mock('../../repositories/application.repo.js', () => ({}));
vi.mock('../../repositories/adminScope.repo.js', () => ({
  approveTransferRequest: vi.fn(async () => 1),
  transferLeaderByAdmin: vi.fn(async () => 1),
}));
vi.mock('../../repositories/auditLog.repo.js', () => ({}));
vi.mock('../../repositories/faculty.repo.js', () => ({}));
vi.mock('../../repositories/userReport.repo.js', () => ({}));
vi.mock('../../utils/imageUrl.js', () => ({ toPublicImageUrl: (k: string | null) => k }));

import { transferLeader } from '../team.service.js';
import { approveTransferRequest, transferLeaderByAdmin } from '../adminScope.service.js';
import * as TeamRepo from '../../repositories/team.repo.js';
import * as AdminRepo from '../../repositories/adminScope.repo.js';
import type { TeamAdminRequestRow, TeamRow } from '../../types/db.js';

const team = (o: Partial<TeamRow> = {}) => ({
  team_id: 10, name: 'ทีม', sport_type_id: 1, leader_id: 5, readiness_status: 'Ready',
  official_status: 'Official', logo_key: null, visibility: 'public', created_at: new Date(),
  updated_at: null, last_competed_at: null, deleted_at: null, deleted_reason: null, ...o,
}) as TeamRow;

const transferReq = (o: Partial<TeamAdminRequestRow> = {}) => ({
  team_admin_request_id: 300, team_id: 10, request_type: 'leader_transfer', requested_by: 5,
  target_user_id: 8, team_admin_request_status: 'pending', ...o,
}) as TeamAdminRequestRow;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(TeamRepo.findById).mockResolvedValue(team());
  vi.mocked(TeamRepo.isMemberOf).mockResolvedValue(true as never);
  vi.mocked(TeamRepo.findTransferRequestById).mockResolvedValue(transferReq());
});

describe('transferLeader (ฝั่งทีม) — BR-07 สร้างคำร้อง ไม่เปลี่ยนหัวหน้าเอง', () => {
  it('ทีม Official → สร้างคำร้อง pending รอแอดมิน · หัวหน้ายังเป็นคนเดิม', async () => {
    await expect(transferLeader(5, 10, 8)).resolves.toEqual({
      id: 300, status: 'pending', currentLeaderId: 5, proposedLeaderId: 8,
    });
    expect(TeamRepo.createTransferRequest).toHaveBeenCalledWith(10, 5, 8);
    expect(TeamRepo.update).not.toHaveBeenCalled();
    expect(AdminRepo.approveTransferRequest).not.toHaveBeenCalled();
  });

  it('ทีม Unofficial → 403 NOT_OFFICIAL_TEAM (เส้นนี้มีไว้สำหรับทีม Official เท่านั้น)', async () => {
    vi.mocked(TeamRepo.findById).mockResolvedValue(team({ official_status: 'Unofficial' }));
    await expect(transferLeader(5, 10, 8)).rejects.toMatchObject({ status: 403, code: 'NOT_OFFICIAL_TEAM' });
    expect(TeamRepo.createTransferRequest).not.toHaveBeenCalled();
  });

  it('หัวหน้าใหม่ต้องเป็นสมาชิกทีมอยู่แล้ว → ไม่ใช่ = 422', async () => {
    vi.mocked(TeamRepo.isMemberOf).mockResolvedValue(false as never);
    await expect(transferLeader(5, 10, 99)).rejects.toMatchObject({ status: 422, code: 'NOT_A_TEAM_MEMBER' });
    expect(TeamRepo.createTransferRequest).not.toHaveBeenCalled();
  });

  it('ไม่พบทีม → 404', async () => {
    vi.mocked(TeamRepo.findById).mockResolvedValue(null);
    await expect(transferLeader(5, 10, 8)).rejects.toMatchObject({ status: 404, code: 'TEAM_NOT_FOUND' });
  });
});

describe('approveTransferRequest (ฝั่งแอดมิน) — BR-07 จุดเดียวที่เปลี่ยนหัวหน้าจริง', () => {
  it('คำร้อง pending → เปลี่ยนหัวหน้าเป็นคนที่ถูกเสนอ และบันทึกแอดมินผู้อนุมัติ', async () => {
    await expect(approveTransferRequest(1, 300)).resolves.toEqual({ teamId: 10, newLeaderId: 8 });
    expect(AdminRepo.approveTransferRequest).toHaveBeenCalledWith(1, 300, 10, 8);
  });

  it('หัวหน้าใหม่มาจากคำร้องในฐาน ไม่ใช่จากคนที่กด — แก้เป้าหมายระหว่างทางไม่ได้', async () => {
    vi.mocked(TeamRepo.findTransferRequestById).mockResolvedValue(transferReq({ target_user_id: 42, team_id: 77 }));
    await approveTransferRequest(1, 300);
    expect(AdminRepo.approveTransferRequest).toHaveBeenCalledWith(1, 300, 77, 42);
  });

  it('ไม่พบคำร้อง → 404 และไม่แตะทีม', async () => {
    vi.mocked(TeamRepo.findTransferRequestById).mockResolvedValue(null);
    await expect(approveTransferRequest(1, 300)).rejects.toMatchObject({ status: 404, code: 'TEAM_REQUEST_NOT_FOUND' });
    expect(AdminRepo.approveTransferRequest).not.toHaveBeenCalled();
  });

  it.each(['approved', 'rejected'] as const)('คำร้องที่ %s ไปแล้ว → 409 ALREADY_DECIDED (อนุมัติซ้ำไม่ได้)', async (status) => {
    vi.mocked(TeamRepo.findTransferRequestById).mockResolvedValue(transferReq({ team_admin_request_status: status }));
    await expect(approveTransferRequest(1, 300)).rejects.toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
    expect(AdminRepo.approveTransferRequest).not.toHaveBeenCalled();
  });
});

describe('transferLeaderByAdmin (แอดมินโอนเองตอนหัวหน้าเดิมหายไป) — BR-07 แอดมินคือผู้อนุมัติ', () => {
  it('สมาชิกของทีม → โอนได้ (ผ่านเส้นแอดมินเท่านั้น · route บังคับ requireAdmin_U)', async () => {
    await expect(transferLeaderByAdmin(1, 10, 8)).resolves.toEqual({ teamId: 10, newLeaderId: 8 });
    expect(AdminRepo.transferLeaderByAdmin).toHaveBeenCalledWith(1, 10, 8);
  });

  it('ไม่ใช่สมาชิกทีม → 422 และไม่แตะทีม', async () => {
    vi.mocked(TeamRepo.isMemberOf).mockResolvedValue(false as never);
    await expect(transferLeaderByAdmin(1, 10, 99)).rejects.toMatchObject({ status: 422, code: 'NOT_A_TEAM_MEMBER' });
    expect(AdminRepo.transferLeaderByAdmin).not.toHaveBeenCalled();
  });

  it('ไม่พบทีม → 404', async () => {
    vi.mocked(TeamRepo.findById).mockResolvedValue(null);
    await expect(transferLeaderByAdmin(1, 10, 8)).rejects.toMatchObject({ status: 404, code: 'TEAM_NOT_FOUND' });
    expect(AdminRepo.transferLeaderByAdmin).not.toHaveBeenCalled();
  });
});
