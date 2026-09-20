/**
 * src/api/team.ts — Person 4 (Teams)
 *
 * แพตเทิร์นเดียวกับ `api/match.ts` และ `api/auth.ts` — สลับ mock ↔ ของจริง
 * ข้างในฟังก์ชัน ตัวเรียกไม่รู้ว่ากำลังคุยกับใคร
 *
 * ── สัญญากับ origin/backend (team.routes.ts · team.schema.ts) ─────────────
 * POST   /teams                           { name, sportTypeId }
 * GET    /teams/:id · PATCH { name } · DELETE
 * GET    /teams/:id/members               403 เมื่อไม่ใช่สมาชิก
 * PATCH  /teams/:id/members/:uid          { position }
 * DELETE /teams/:id/members/:uid          204 · ถอนหัวหน้าทีมได้ 403
 * POST   /teams/:id/invitations           { invitedUserId }
 * GET    /teams/:id/invitations · DELETE /teams/:id/invitations/:iid → 204
 * POST   /teams/:id/official-request      { supportingDocs: string[] }
 * ไม่มีใน backend: โอนสิทธิ์หัวหน้าทีม (SDS FR-TM-08) — นอกโหมด mock ตอบ 501
 *
 * ── Roster lock ───────────────────────────────────────────────────────────
 * backend ยังไม่ตรวจว่าทีมเริ่มแข่งแล้วหรือยังตอนถอน เชิญ หรือรับคำเชิญ
 * โหมด mock บังคับใน mocks/teamWrites.ts (409 ROSTER_LOCKED)
 */
import { ApiError, apiFetch, mockDelay, mockReject, USE_MOCK } from "./client";
import type {
  TeamDto,
  TeamInvitationDto,
  TeamAdminRequestDto,
  PlayerProfileDto,
  CreateTeamRequest,
  UpdateTeamRequest,
  SetMemberPositionRequest,
  InviteMemberRequest,
  RequestOfficialStatusRequest,
  TransferLeaderRequest,
  ReviewTeamRequestRequest,
  BackendMyTeamDto,
  BackendTeamDto,
  BackendTeamMemberDto,
  BackendTeamListResponse,
  BackendMyInvitationDto,
} from "../types/team.dto";
import {
  findStorePlayer, findStoreTeam, myStoreInvitations, myStoreTeams,
  storeTeamAdminRequests, teamStoreInvitations, toTeamDto, type TeamRef,
} from "../mocks/teamBridge";
import { getState } from "../shared/store";
import {
  writeAnswerInvitation, writeCancelInvitation, writeCreateTeam, writeDisbandTeam, writeInviteMember,
  writeKickMember, writeRequestOfficial, writeReviewTeamRequest, writeSetMemberPosition,
  writeTransferLeader, writeUpdateTeam, type WriteBlock,
} from "../mocks/teamWrites";

/** สร้าง TeamDto กลับจาก store หลังเขียนเสร็จ */
const teamDto = (ref: TeamRef): TeamDto | null => {
  const t = findStoreTeam(ref);
  return t ? toTeamDto(getState(), t) : null;
};

const notFound = <T>(what: string): Promise<T> =>
  mockReject<T>(404, { code: "NOT_FOUND", message: `ไม่พบ${what}ที่ต้องการ` });

/** ส่งเหตุผลที่ชั้น mock ปฏิเสธต่อเป็น error รูปเดียวกับ backend */
const rejectWith = <T>(b: WriteBlock): Promise<T> =>
  mockReject<T>(b.status, { code: b.code, message: b.message, details: b.details });

/** backend ยังไม่มี endpoint นี้ — ไม่ยิงไปเส้นทางที่ไม่มีอยู่ */
const unavailable = <T>(what: string): Promise<T> =>
  Promise.reject(new ApiError(501, { code: "ENDPOINT_UNAVAILABLE", message: `${what} ยังไม่มีใน backend` }));

// ══════════════ อ่าน ══════════════

/**
 * ทีมของฉัน — เส้นจริงคือ GET /me/teams (ไม่ใช่ /teams?mine=true)
 * ⚠️ backend คืนรูปย่อ (id, name, sportTypeId, readinessStatus, officialStatus, memberCount, role)
 * ไม่ใช่ TeamDto เต็มของ prototype — หน้าจอโหมดจริงให้ใช้ getBackendMyTeams()
 */
export async function getMyTeams(): Promise<{ items: TeamDto[] }> {
  if (USE_MOCK) return mockDelay({ items: myStoreTeams() });
  return apiFetch("/me/teams");
}

/** Current backend contract: GET /me/teams. */
export async function getBackendMyTeams(): Promise<BackendTeamListResponse<BackendMyTeamDto>> {
  if (!USE_MOCK) return apiFetch("/me/teams");

  return mockDelay({
    items: myStoreTeams().map((team) => ({
      id: team.id,
      name: team.name,
      sportTypeId: team.sportTypeId,
      readinessStatus: team.readinessStatus,
      officialStatus: team.officialStatus,
      memberCount: team.members.length,
      role: team.viewer.isLeader ? "leader" : "member",
    })),
  });
}

/** Current backend contract: GET /teams/:id. */
export async function getBackendTeam(teamId: number): Promise<BackendTeamDto> {
  if (!USE_MOCK) return apiFetch(`/teams/${teamId}`);

  const team = teamDto(teamId);
  if (!team) return notFound<BackendTeamDto>("ทีม");
  return mockDelay({
    id: team.id,
    name: team.name,
    sportTypeId: team.sportTypeId,
    readinessStatus: team.readinessStatus,
    officialStatus: team.officialStatus,
    leader: team.leader,
    memberCount: team.members.length,
    createdAt: team.createdAt,
  });
}

/** Current backend contract: GET /teams/:id/members. */
export async function getBackendTeamMembers(teamId: number): Promise<BackendTeamListResponse<BackendTeamMemberDto>> {
  if (!USE_MOCK) return apiFetch(`/teams/${teamId}/members`);

  const team = teamDto(teamId);
  if (!team) return notFound<BackendTeamListResponse<BackendTeamMemberDto>>("ทีม");
  return mockDelay({
    items: team.members.map((member) => ({
      userId: member.user.id,
      fullName: member.user.fullName,
      avatarUrl: member.user.avatarUrl,
      joinedAt: member.joinedAt,
    })),
  });
}

/** Current backend contract: GET /me/invitations. */
export async function getBackendMyInvitations(): Promise<BackendTeamListResponse<BackendMyInvitationDto>> {
  if (!USE_MOCK) return apiFetch("/me/invitations");
  return mockDelay({ items: myStoreInvitations().filter(invitation => invitation.status === "pending").map(invitation => ({
    id: invitation.id,
    team: { id: invitation.team.id, name: invitation.team.name, sportTypeId: 0 },
    invitedBy: invitation.invitedBy,
    expiresAt: invitation.expiresAt ?? new Date(Date.now() + 7 * 86400000).toISOString(),
  })) });
}

export async function answerBackendInvitation(invitationId: number, accept: boolean): Promise<void> {
  if (!USE_MOCK) return apiFetch(`/invitations/${invitationId}/${accept ? "accept" : "decline"}`, { method: "POST" });
  await answerInvitation(invitationId, accept);
}

/** TODO(guide): GET /teams/:id */
export async function getTeam(teamId: TeamRef): Promise<TeamDto> {
  if (USE_MOCK) {
    const t = findStoreTeam(teamId);
    return t ? mockDelay(toTeamDto(getState(), t)) : notFound<TeamDto>("ทีม");
  }
  return apiFetch(`/teams/${teamId}`);
}

/**
 * T09/T12/T13 — คำเชิญที่รอเราตอบ (FR-TM-03)
 * เส้นจริงคือ GET /me/invitations และคืนเฉพาะคำเชิญที่ยัง pending
 */
export async function getMyInvitations(): Promise<{ items: TeamInvitationDto[] }> {
  if (USE_MOCK) return mockDelay({ items: myStoreInvitations() });
  return apiFetch("/me/invitations");
}

/** GET /teams/:id/invitations — คำเชิญที่ทีมนี้ส่งออกไป พร้อมสถานะ (FR-TM-02) */
export async function getTeamInvitations(teamId: TeamRef): Promise<{ items: TeamInvitationDto[] }> {
  if (USE_MOCK) return mockDelay({ items: teamStoreInvitations(teamId) });
  return apiFetch(`/teams/${teamId}/invitations`);
}

/** TODO(guide): GET /admin/team-requests — คิวของ Admin (FR-TM-06, FR-TM-08) */
export async function getTeamAdminRequests(): Promise<{ items: TeamAdminRequestDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeTeamAdminRequests() });
  return apiFetch("/admin/team-requests");
}

/**
 * U03 โปรไฟล์สาธารณะ — เส้นจริงคือ GET /users/:id (ไม่มี /profile ต่อท้าย)
 * backend คืน { id, fullName, avatarUrl, facultyId, departmentId, teams }
 * สถิติผู้เล่นอยู่คนละเส้น: GET /users/:id/stats (ดู api/user.ts)
 */
export async function getPlayerProfile(userId: TeamRef): Promise<PlayerProfileDto> {
  if (USE_MOCK) {
    const p = findStorePlayer(userId);
    return p ? mockDelay(p) : notFound<PlayerProfileDto>("ผู้เล่น");
  }
  return apiFetch(`/users/${userId}`);
}

// ══════════════ เขียน ══════════════
/*
 * โหมด mock เขียนลง store ผ่าน mocks/teamWrites.ts ซึ่งอ่านจากที่เดียวกับสะพาน
 * ทางที่ทำไม่ได้ได้ error code เดียวกับ backend จึงทดสอบ error state ของหน้าจอได้จริง
 */

/** POST /teams — FR-TM-01 (409 TEAM_NAME_TAKEN · 422 TEAM_QUOTA_EXCEEDED) */
export async function createTeam(input: CreateTeamRequest): Promise<TeamDto> {
  if (USE_MOCK) {
    const id = writeCreateTeam(input);
    if (typeof id !== "number") return rejectWith<TeamDto>(id);
    const dto = teamDto(id);
    return dto ? mockDelay(dto) : notFound<TeamDto>("ทีมที่เพิ่งสร้าง");
  }
  /* team.schema.ts รับแค่ name กับ sportTypeId — code/color เป็นของ prototype */
  return apiFetch("/teams", {
    method: "POST",
    body: JSON.stringify({ name: input.name, sportTypeId: input.sportTypeId }),
  });
}

/** PATCH /teams/:id — FR-TM-04 (backend รับแค่ name · โลโก้มีเฉพาะโหมด mock) */
export async function updateTeam(teamId: TeamRef, input: UpdateTeamRequest): Promise<TeamDto> {
  if (USE_MOCK) {
    const blocked = writeUpdateTeam(teamId, input);
    if (blocked) return rejectWith<TeamDto>(blocked);
    const dto = teamDto(teamId);
    return dto ? mockDelay(dto) : notFound<TeamDto>("ทีม");
  }
  /* team.schema.ts updateTeamSchema รับแค่ name — รหัสทีมและโลโก้ยังไม่มีคอลัมน์ใน backend */
  return apiFetch(`/teams/${teamId}`, { method: "PATCH", body: JSON.stringify({ name: input.name }) });
}

/**
 * FR-TM-04 ตัวจริง/ตัวสำรอง — prototype เท่านั้น
 * `PATCH /teams/:id/members/:uid` ถูกถอดออกพร้อม migration 019 ยิงไปได้ 404 อย่างเดียว
 * จึงตัดที่ต้นทาง หน้าจอโหมดจริงไม่แสดงช่องนี้แล้ว
 */
export async function setMemberPosition(
  teamId: TeamRef, input: SetMemberPositionRequest,
): Promise<TeamDto> {
  if (!USE_MOCK) return unavailable<TeamDto>("การกำหนดตัวจริง/ตัวสำรองระดับทีม");
  const blocked = writeSetMemberPosition(teamId, input.userId, input.position);
  if (blocked) return rejectWith<TeamDto>(blocked);
  const dto = teamDto(teamId);
  return dto ? mockDelay(dto) : notFound<TeamDto>("ทีม");
}

/**
 * DELETE /teams/:id/members/:uid → 204
 * ถอนหัวหน้าทีมไม่ได้ (403) · โหมด mock ถอนไม่ได้เมื่อทีมเริ่มแข่งแล้ว (409 ROSTER_LOCKED)
 */
export async function kickMember(teamId: TeamRef, userId: number): Promise<void> {
  if (USE_MOCK) {
    const blocked = writeKickMember(teamId, userId);
    return blocked ? rejectWith<void>(blocked) : mockDelay(undefined);
  }
  return apiFetch(`/teams/${teamId}/members/${userId}`, { method: "DELETE" });
}

/** POST /teams/:id/invitations { invitedUserId } — FR-TM-02 */
export async function inviteMember(
  teamId: TeamRef, input: InviteMemberRequest,
): Promise<TeamInvitationDto> {
  if (USE_MOCK) {
    const blocked = writeInviteMember(teamId, input.userId);
    if (blocked) return rejectWith<TeamInvitationDto>(blocked);
    const row = teamStoreInvitations(teamId)
      .find((i) => i.invitedUser.id === input.userId && i.status === "pending");
    return row ? mockDelay(row) : notFound<TeamInvitationDto>("คำเชิญที่เพิ่งส่ง");
  }
  /* team.schema.ts createTeamInvitedSchema ใช้ชื่อ invitedUserId ไม่ใช่ userId */
  return apiFetch(`/teams/${teamId}/invitations`, {
    method: "POST", body: JSON.stringify({ invitedUserId: input.userId }),
  });
}

/** DELETE /teams/:id/invitations/:iid → 204 — ยกเลิกคำเชิญที่ยังไม่มีคนตอบ (หัวหน้าทีมเท่านั้น) */
export async function cancelTeamInvitation(teamId: TeamRef, invitationId: number): Promise<void> {
  if (USE_MOCK) {
    const blocked = writeCancelInvitation(teamId, invitationId);
    return blocked ? rejectWith<void>(blocked) : mockDelay(undefined);
  }
  return apiFetch(`/teams/${teamId}/invitations/${invitationId}`, { method: "DELETE" });
}

/**
 * POST /invitations/:id/accept | /decline — FR-TM-03
 * backend ตรวจโควตาทีมและคำเชิญหมดอายุ · โหมด mock ตรวจรายชื่อที่ถูกล็อกเพิ่มด้วย
 */
export async function answerInvitation(
  invitationId: TeamRef, accept: boolean,
): Promise<TeamInvitationDto> {
  if (USE_MOCK) {
    const teamOfInvite = writeAnswerInvitation(invitationId, accept);
    if (typeof teamOfInvite !== "string") return rejectWith<TeamInvitationDto>(teamOfInvite);
    const row = teamStoreInvitations(teamOfInvite).find((i) => i.id === Number(invitationId));
    return row ? mockDelay(row) : notFound<TeamInvitationDto>("คำเชิญหลังตอบ");
  }
  return apiFetch(`/invitations/${invitationId}/${accept ? "accept" : "decline"}`, {
    method: "POST",
  });
}

/** DELETE /teams/:id → 204 — FR-TM-05 ลบได้เฉพาะทีมที่ยังไม่เคยลงแข่ง */
export async function disbandTeam(teamId: TeamRef): Promise<void> {
  if (USE_MOCK) {
    const blocked = writeDisbandTeam(teamId);
    return blocked ? rejectWith<void>(blocked) : mockDelay(undefined);
  }
  return apiFetch(`/teams/${teamId}`, { method: "DELETE" });
}

/** POST /teams/:id/official-request { supportingDocs } — FR-TM-06 (400 OFFICIAL_DOCS_REQUIRED) */
export async function requestOfficialStatus(
  teamId: TeamRef, input: RequestOfficialStatusRequest,
): Promise<TeamAdminRequestDto> {
  if (USE_MOCK) {
    const blocked = writeRequestOfficial(teamId, input.supportingDocs);
    if (blocked) return rejectWith<TeamAdminRequestDto>(blocked);
    const rows = storeTeamAdminRequests();
    const row = rows[rows.length - 1];
    return row ? mockDelay(row) : notFound<TeamAdminRequestDto>("คำร้องที่เพิ่งยื่น");
  }
  return apiFetch(`/teams/${teamId}/official-request`, {
    method: "POST", body: JSON.stringify({ supportingDocs: input.supportingDocs }),
  });
}

/**
 * โอนสิทธิ์หัวหน้าทีม — SDS POST /teams/{id}/transfer-leader (FR-TM-08)
 * origin/backend ยังไม่มี route นี้ นอกโหมด mock จึงตอบ 501 แทนการยิงไปเส้นทางที่ไม่มี
 */
export async function transferLeader(
  teamId: TeamRef, input: TransferLeaderRequest,
): Promise<TeamAdminRequestDto> {
  if (USE_MOCK) {
    /* prototype โอนทันที — FR-TM-08 บอกว่าทีม Official ต้องผ่าน Admin ก่อน
       ซึ่ง store ยังไม่มีคำร้องชนิดนั้น จึงคืนสถานะ approved ตรงไปตรงมา */
    if (!writeTransferLeader(teamId, input.targetUserId)) {
      return notFound<TeamAdminRequestDto>("ทีมหรือสมาชิก");
    }
    const t = findStoreTeam(teamId);
    const dto = t ? toTeamDto(getState(), t) : null;
    return dto
      ? mockDelay({
          id: dto.id, team: { id: dto.id, name: dto.name, code: dto.code, color: dto.color },
          requestType: "leader_transfer" as const, requestedBy: dto.leader,
          targetUser: dto.leader, status: "approved" as const,
          requestedAt: new Date(dto.createdAt).toISOString(), reviewedBy: null,
          reviewedAt: null, rejectionReason: null, blockingMembers: [],
        })
      : notFound<TeamAdminRequestDto>("ทีม");
  }
  return unavailable<TeamAdminRequestDto>("การโอนสิทธิ์หัวหน้าทีม");
}

/** TODO(guide): POST /admin/team-requests/:id/review — Admin ตัดสิน */
export async function reviewTeamRequest(
  requestId: TeamRef, input: ReviewTeamRequestRequest,
): Promise<TeamAdminRequestDto> {
  if (USE_MOCK) {
    const id = writeReviewTeamRequest(requestId, input.approve);
    if (!id) return notFound<TeamAdminRequestDto>("คำร้อง");
    const row = storeTeamAdminRequests().find((r) => r.id === Number(requestId));
    return row ? mockDelay(row) : notFound<TeamAdminRequestDto>("คำร้องหลังตัดสิน");
  }
  const action = input.approve ? "approve" : "reject";
  const body = input.approve
    ? undefined
    : JSON.stringify({ reason: input.rejectionReason ?? "ปฏิเสธโดยผู้ดูแลระบบ" });
  return apiFetch(`/admin/team-requests/${requestId}/${action}`, { method: "POST", body });
}
