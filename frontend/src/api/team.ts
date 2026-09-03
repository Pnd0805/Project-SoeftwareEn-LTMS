/**
 * src/api/team.ts — Person 4 (Teams)
 *
 * แพตเทิร์นเดียวกับ `api/match.ts` และ `api/auth.ts` — สลับ mock ↔ ของจริง
 * ข้างในฟังก์ชัน ตัวเรียกไม่รู้ว่ากำลังคุยกับใคร
 *
 * ── สถานะ endpoint ────────────────────────────────────────────────────────
 * [ยืนยันแล้ว] `T09/T12/T13` มีอ้างใน schema.sql:143 ว่าเป็นกลุ่มคำเชิญเข้าทีม
 *   แต่ไม่ได้ระบุ path — รู้แค่ว่ามีอยู่
 * [ตั้งไว้ก่อน] ที่เหลืออนุมานจากตารางใน schema.sql + คอนเวนชันของ A01-A03/R01-R03
 *   ทุกตัว mark ด้วย TODO(guide) · signature ตั้งตาม use case ไม่ใช่ตาม URL
 *   พอ GUIDE/06 ส่วน Team มาถึง แก้แค่บรรทัด path ตัวเรียกไม่ต้องแตะ
 */
import { apiFetch, mockDelay, mockReject, USE_MOCK } from "./client";
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
} from "../types/team.dto";
import {
  findStorePlayer, findStoreTeam, myStoreInvitations, myStoreTeams,
  storeTeamAdminRequests, teamStoreInvitations, toTeamDto, type TeamRef,
} from "../mocks/teamBridge";
import { getState } from "../shared/store";

const notFound = <T>(what: string): Promise<T> =>
  mockReject<T>(404, { code: "NOT_FOUND", message: `ไม่พบ${what}ที่ต้องการ` });

const notImplemented = <T>(what: string): Promise<T> =>
  mockReject<T>(501, {
    code: "MOCK_READ_ONLY",
    message: `โหมด mock ยังไม่รองรับ${what} — ต่อ backend จริงก่อน`,
  });

// ══════════════ อ่าน ══════════════

/** TODO(guide): GET /teams?mine=true — หน้า /teams */
export async function getMyTeams(): Promise<{ items: TeamDto[] }> {
  if (USE_MOCK) return mockDelay({ items: myStoreTeams() });
  return apiFetch("/teams?mine=true");
}

/** TODO(guide): GET /teams/:id */
export async function getTeam(teamId: TeamRef): Promise<TeamDto> {
  if (USE_MOCK) {
    const t = findStoreTeam(teamId);
    return t ? mockDelay(toTeamDto(getState(), t)) : notFound<TeamDto>("ทีม");
  }
  return apiFetch(`/teams/${teamId}`);
}

/** T09/T12/T13 — คำเชิญที่รอเราตอบ (FR-TM-03) */
export async function getMyInvitations(): Promise<{ items: TeamInvitationDto[] }> {
  if (USE_MOCK) return mockDelay({ items: myStoreInvitations() });
  return apiFetch("/me/team-invitations");
}

/** T09/T12/T13 — คำเชิญที่ทีมนี้ส่งออกไป พร้อมสถานะ (FR-TM-02) */
export async function getTeamInvitations(teamId: TeamRef): Promise<{ items: TeamInvitationDto[] }> {
  if (USE_MOCK) return mockDelay({ items: teamStoreInvitations(teamId) });
  return apiFetch(`/teams/${teamId}/invitations`);
}

/** TODO(guide): GET /admin/team-requests — คิวของ Admin (FR-TM-06, FR-TM-08) */
export async function getTeamAdminRequests(): Promise<{ items: TeamAdminRequestDto[] }> {
  if (USE_MOCK) return mockDelay({ items: storeTeamAdminRequests() });
  return apiFetch("/admin/team-requests");
}

/** TODO(guide): GET /users/:id/profile — U03 ฝั่งสาธารณะ + player_profile_stats */
export async function getPlayerProfile(userId: TeamRef): Promise<PlayerProfileDto> {
  if (USE_MOCK) {
    const p = findStorePlayer(userId);
    return p ? mockDelay(p) : notFound<PlayerProfileDto>("ผู้เล่น");
  }
  return apiFetch(`/users/${userId}/profile`);
}

// ══════════════ เขียน ══════════════
/*
 * โหมด mock ตอบ 501 ให้ทุกตัว ไม่ใช่แกล้งสำเร็จ
 *
 * สะพานอ่านจาก store ทางเดียว — ถ้าเขียนกลับด้วยจะได้ระบบที่มีสองแหล่งความจริง
 * และเดโมจะเพี้ยนเงียบๆ ตอบ 501 ให้ UI เจอ error state จริงระหว่างพัฒนา
 * ดีกว่าปล่อยให้ดูเหมือนทำงานแล้วมาพังตอนต่อ backend
 */

/** TODO(guide): POST /teams — FR-TM-01 (ชื่อซ้ำในกีฬาเดียวกันไม่ได้ · เกิน 5 ทีม Unofficial ไม่ได้) */
export async function createTeam(input: CreateTeamRequest): Promise<TeamDto> {
  if (USE_MOCK) return notImplemented<TeamDto>("การสร้างทีม");
  return apiFetch("/teams", { method: "POST", body: JSON.stringify(input) });
}

/** TODO(guide): PATCH /teams/:id — FR-TM-04 */
export async function updateTeam(teamId: TeamRef, input: UpdateTeamRequest): Promise<TeamDto> {
  if (USE_MOCK) return notImplemented<TeamDto>("การแก้ข้อมูลทีม");
  return apiFetch(`/teams/${teamId}`, { method: "PATCH", body: JSON.stringify(input) });
}

/** TODO(guide): PUT /teams/:id/members/:userId/position — FR-TM-04 ตัวจริง/ตัวสำรอง */
export async function setMemberPosition(
  teamId: TeamRef, input: SetMemberPositionRequest,
): Promise<TeamDto> {
  if (USE_MOCK) return notImplemented<TeamDto>("การกำหนดตัวจริง/ตัวสำรอง");
  return apiFetch(`/teams/${teamId}/members/${input.userId}/position`, {
    method: "PUT", body: JSON.stringify({ position: input.position }),
  });
}

/** TODO(guide): DELETE /teams/:id/members/:userId */
export async function kickMember(teamId: TeamRef, userId: number): Promise<TeamDto> {
  if (USE_MOCK) return notImplemented<TeamDto>("การนำสมาชิกออก");
  return apiFetch(`/teams/${teamId}/members/${userId}`, { method: "DELETE" });
}

/** T09/T12/T13 — POST /teams/:id/invitations (FR-TM-02) */
export async function inviteMember(
  teamId: TeamRef, input: InviteMemberRequest,
): Promise<TeamInvitationDto> {
  if (USE_MOCK) return notImplemented<TeamInvitationDto>("การส่งคำเชิญ");
  return apiFetch(`/teams/${teamId}/invitations`, { method: "POST", body: JSON.stringify(input) });
}

/**
 * T09/T12/T13 — ตอบรับหรือปฏิเสธ (FR-TM-03)
 * backend ต้องเช็คกฎจำนวนทีมสูงสุดต่อคน และคำเชิญหมดอายุ ก่อนรับเข้าเป็นสมาชิก
 */
export async function answerInvitation(
  invitationId: TeamRef, accept: boolean,
): Promise<TeamInvitationDto> {
  if (USE_MOCK) return notImplemented<TeamInvitationDto>("การตอบรับคำเชิญ");
  return apiFetch(`/team-invitations/${invitationId}`, {
    method: "POST", body: JSON.stringify({ accept }),
  });
}

/** TODO(guide): DELETE /teams/:id — FR-TM-05 ทีมที่กำลังแข่งต้องถูกปฏิเสธ */
export async function disbandTeam(teamId: TeamRef): Promise<void> {
  if (USE_MOCK) return notImplemented<void>("การลบทีม");
  return apiFetch(`/teams/${teamId}`, { method: "DELETE" });
}

/** TODO(guide): POST /teams/:id/official-request — FR-TM-06 */
export async function requestOfficialStatus(
  teamId: TeamRef, input: RequestOfficialStatusRequest,
): Promise<TeamAdminRequestDto> {
  if (USE_MOCK) return notImplemented<TeamAdminRequestDto>("การยื่นขอเป็นทีม Official");
  return apiFetch(`/teams/${teamId}/official-request`, {
    method: "POST", body: JSON.stringify(input),
  });
}

/** TODO(guide): POST /teams/:id/leader-transfer — FR-TM-08 (ทีม Official ต้องผ่าน Admin) */
export async function transferLeader(
  teamId: TeamRef, input: TransferLeaderRequest,
): Promise<TeamAdminRequestDto> {
  if (USE_MOCK) return notImplemented<TeamAdminRequestDto>("การโอนสิทธิ์หัวหน้าทีม");
  return apiFetch(`/teams/${teamId}/leader-transfer`, {
    method: "POST", body: JSON.stringify(input),
  });
}

/** TODO(guide): POST /admin/team-requests/:id/review — Admin ตัดสิน */
export async function reviewTeamRequest(
  requestId: TeamRef, input: ReviewTeamRequestRequest,
): Promise<TeamAdminRequestDto> {
  if (USE_MOCK) return notImplemented<TeamAdminRequestDto>("การพิจารณาคำร้อง");
  return apiFetch(`/admin/team-requests/${requestId}/review`, {
    method: "POST", body: JSON.stringify(input),
  });
}
